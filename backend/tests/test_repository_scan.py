import io
import tarfile

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from test_backend import ROOT, SLUG, setup_repo

from app.config import settings
from app.db import engine
from app.models import Job, Publication, Repository, Revision
from app.repository_scan import (
    RepositoryDraft,
    ScanError,
    SectionAnalysis,
    batches,
    read_archive,
    scan_step,
)
from app.worker import run_once


def archive(entries):
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:gz") as tar:
        for path, data in entries.items():
            item = tarfile.TarInfo("root/" + path)
            raw = data.encode()
            item.size = len(raw)
            tar.addfile(item, io.BytesIO(raw))
        link = tarfile.TarInfo("root/linked.py")
        link.type, link.linkname = tarfile.SYMTYPE, "/etc/passwd"
        tar.addfile(link)
    return buffer.getvalue()


def test_archive_exclusions_and_full_large_file_chunks():
    files, skipped = read_archive(
        archive(
            {
                "src/main.swift": "a" * 100000,
                "../bad.py": "bad",
                ".env.production": "secret",
                "node_modules/module.js": "vendor",
                "binary.png": "image",
                "src/token.py": 'api_key = "' + "a" * 40 + '"',
                "empty.md": "",
            }
        )
    )
    assert [f["path"] for f in files] == ["src/main.swift"]
    assert len(skipped) == 7
    chunks = batches(files)
    assert len(chunks) == 2
    assert "".join(f["content"] for c in chunks for f in c) == "a" * 100000


def configure(client, content, monkeypatch):
    setup_repo(client, content)
    with Session(engine()) as db:
        repo = db.scalar(select(Repository))
        repo_id, github_id = repo.id, repo.github_id
    monkeypatch.setenv("GITHUB_SCAN_REPOSITORIES", github_id)
    settings.cache_clear()
    monkeypatch.setattr("app.repository_scan.repository_head", lambda repo: "a" * 40)
    monkeypatch.setattr(
        "app.repository_scan.download_sources",
        lambda repo, sha: ([{"path": "main.swift", "content": "struct App {}", "hash": "source-hash"}], []),
    )
    return repo_id


def fake_complete(model_type, prompt, data, provider, model):
    finding = {
        "statement": "The application defines its entry point.",
        "files": ["main.swift"],
        "basis": "implementation",
    }
    if model_type is SectionAnalysis:
        return SectionAnalysis(findings=[finding], questions=["Who tested it?"])
    return RepositoryDraft(
        built=[finding],
        features=[dict(finding, title="Entry point")],
        deep_dives=[],
        architecture={
            "id": "app",
            "title": "App structure",
            "basis": "built",
            "nodes": [{"id": "app", "label": "App", "kind": "app", "col": 0, "row": 0}],
            "edges": [],
        },
        architecture_files=["main.swift"],
        questions=["What motivated this project?"],
    )


def test_scan_checkpoint_private_draft_and_incremental_reuse(client, content, monkeypatch):
    repo_id = configure(client, content, monkeypatch)
    calls = []

    def completion(*args):
        calls.append(args[0])
        return fake_complete(*args)

    monkeypatch.setattr("app.repository_scan.complete", completion)
    url = f"{ROOT}/{SLUG}/repositories/{repo_id}/scan"
    response = client.post(url, json={})
    assert response.status_code == 202
    job_id = response.json()["job_id"]
    assert client.post(url, json={}).json()["job_id"] == job_id
    for stage in ("analyze", "compose", "done"):
        assert run_once(job_id)
        with Session(engine()) as db:
            job = db.get(Job, job_id)
            assert job.payload["stage"] == stage
            assert job.attempts == (1 if stage == "done" else 0)
    assert calls == [SectionAnalysis, RepositoryDraft]
    with Session(engine()) as db:
        assert db.scalar(select(func.count()).select_from(Publication)) == 1
        draft = db.scalar(select(Revision).where(Revision.source == "ai-repository"))
        assert draft.review_notes["coverage"]["commit"] == "a" * 40
        assert "/blob/" + "a" * 40 in draft.review_notes["citations"][0]["sources"][0]
        assert "files" not in db.get(Job, job_id).payload["sections"][0]
    assert client.get(f"/api/v1/projects/{SLUG}/case-study").json()["intro"] == {}
    monkeypatch.setattr("app.repository_scan.repository_head", lambda repo: "b" * 40)
    next_job = client.post(url, json={}).json()["job_id"]
    assert next_job != job_id
    for _ in range(3):
        run_once(next_job)
    assert calls == [SectionAnalysis, RepositoryDraft, RepositoryDraft]


def test_source_consent_revocation_and_scope(client, content, monkeypatch):
    repo_id = configure(client, content, monkeypatch)
    url = f"{ROOT}/{SLUG}/repositories/{repo_id}/scan"
    client.headers["X-CSRF-Token"] = "wrong"
    assert client.post(url, json={}).status_code == 403
    client.headers["X-CSRF-Token"] = "test-csrf"
    assert client.post(f"{ROOT}/{SLUG}/repositories/other/scan", json={}).status_code == 404
    job_id = client.post(url, json={}).json()["job_id"]
    monkeypatch.setenv("GITHUB_SCAN_REPOSITORIES", "")
    settings.cache_clear()
    assert client.post(url, json={}).status_code == 422
    with Session(engine()) as db:
        with pytest.raises(ScanError, match="permission was removed"):
            scan_step(db, db.get(Job, job_id))


def test_unknown_citations_never_commit(client, content, monkeypatch):
    repo_id = configure(client, content, monkeypatch)
    job_id = client.post(f"{ROOT}/{SLUG}/repositories/{repo_id}/scan", json={}).json()["job_id"]
    run_once(job_id)
    monkeypatch.setattr(
        "app.repository_scan.complete",
        lambda *args: SectionAnalysis(
            findings=[{"statement": "Invented", "files": ["missing.py"], "basis": "implementation"}],
            questions=[],
        ),
    )
    run_once(job_id)
    with Session(engine()) as db:
        job = db.get(Job, job_id)
        assert job.status == "queued" and job.attempts == 1
        assert job.payload["sections"][0]["analysis"] is None
        assert "outside" in job.error
        assert db.scalar(select(func.count()).select_from(Publication)) == 1


def test_daily_checks_deduplicate_completed_commit(client, content, monkeypatch):
    configure(client, content, monkeypatch)
    monkeypatch.setenv("CRON_SECRET", "cron-test")
    settings.cache_clear()
    monkeypatch.setattr("app.main.dispatch_pending", lambda db: {"attempted": 1, "dispatched": 1})
    for _ in range(2):
        assert (
            client.get(
                "/api/internal/jobs/reconcile", headers={"Authorization": "Bearer cron-test"}
            ).status_code
            == 200
        )
    with Session(engine()) as db:
        assert db.scalar(select(func.count()).select_from(Job)) == 1


def test_private_or_mismatched_repository_rejected(monkeypatch):
    from types import SimpleNamespace

    from app.repository_scan import repository_head

    repo = SimpleNamespace(full_name="owner/repo", github_id="123")
    for meta in ({"id": 123, "private": True}, {"id": 999, "private": False}):
        monkeypatch.setattr("app.repository_scan.github_json", lambda *args: meta)
        with pytest.raises(ScanError, match="public"):
            repository_head(repo)
