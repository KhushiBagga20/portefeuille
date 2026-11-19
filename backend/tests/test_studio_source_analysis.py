import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from test_backend import ROOT, SLUG, create, publish
from test_repository_scan import fake_complete

from app.config import settings
from app.db import engine
from app.models import Job, Publication, Repository, Revision
from app.repository_scan import ScanError, schedule_scans
from app.worker import run_once


@pytest.fixture
def connected(client, content, monkeypatch):
    card = create(client, content)
    repo = client.post(
        f"{ROOT}/{SLUG}/repositories",
        json={
            "github_id": "77",
            "full_name": "owner/new-project",
            "allow_ai": False,
        },
    ).json()
    monkeypatch.setenv("GITHUB_SCAN_REPOSITORIES", "")
    settings.cache_clear()
    monkeypatch.setattr("app.main.repository_metadata", lambda repo: {"owner": {"id": 123}, "private": False})
    monkeypatch.setattr("app.repository_scan.repository_metadata", lambda repo: {"private": False})
    monkeypatch.setattr("app.repository_scan.repository_head", lambda repo: "a" * 40)
    monkeypatch.setattr(
        "app.repository_scan.download_sources",
        lambda repo, sha: (
            [
                {
                    "path": "main.swift",
                    "content": "struct App {}",
                    "hash": "source-hash",
                }
            ],
            [],
        ),
    )
    monkeypatch.setattr("app.repository_scan.complete", fake_complete)
    return card, repo["id"], f"{ROOT}/{SLUG}/repositories/{repo['id']}/scan"


def test_new_project_can_generate_privately_without_env_edit(client, connected):
    card, repo_id, url = connected
    assert client.post(url, json={}).status_code == 422
    response = client.post(url, json={"enable_source_analysis": True})
    assert response.status_code == 202
    job_id = response.json()["job_id"]
    with Session(engine()) as db:
        repo = db.get(Repository, repo_id)
        assert repo.allow_ai and repo.allow_source_ai
        assert db.get(Job, job_id).payload["base_revision_id"] == card["id"]
    assert client.get(f"{ROOT}/{SLUG}/repositories").json()[0]["scan_enabled"]
    for _ in range(3):
        run_once(job_id)
    with Session(engine()) as db:
        draft = db.scalar(select(Revision).where(Revision.source == "ai-repository"))
        assert draft.base_version == 0
        assert draft.content["caseStudy"]["diagrams"]
        assert draft.content["caseStudy"]["mindmap"]["decisions"]
        assert db.scalar(select(func.count()).select_from(Publication)) == 0
        assert schedule_scans(db) == {"checked": 1, "failed": 0}
        assert db.scalar(select(func.count()).select_from(Job)) == 1
    assert client.get("/api/v1/projects").json() == []
    assert client.post(url, json={}).json()["job_id"] == job_id
    revisions = client.get(f"{ROOT}/{SLUG}/revisions").json()
    full = next(r for r in revisions if r["source"] == "ai-repository")
    assert publish(client, full).status_code == 200
    assert client.get(f"/api/v1/projects/{SLUG}/case-study").json()["diagrams"]


def test_source_consent_requires_owner_csrf_and_correct_project(client, connected):
    _, repo_id, url = connected
    client.headers["X-CSRF-Token"] = "wrong"
    assert client.post(url, json={"enable_source_analysis": True}).status_code == 403
    client.headers["X-CSRF-Token"] = "test-csrf"
    assert (
        client.post(
            f"{ROOT}/{SLUG}/repositories/not-this-repo/scan", json={"enable_source_analysis": True}
        ).status_code
        == 404
    )
    with Session(engine()) as db:
        assert not db.get(Repository, repo_id).allow_source_ai
    client.cookies.clear()
    assert client.post(url, json={"enable_source_analysis": True}).status_code == 401


@pytest.mark.parametrize("failure", ["foreign-owner", "private", "provider-unavailable"])
def test_rejected_enable_does_not_save_consent(client, connected, monkeypatch, failure):
    _, repo_id, url = connected
    if failure == "foreign-owner":
        monkeypatch.setattr("app.main.repository_metadata", lambda repo: {"owner": {"id": 999}})
    elif failure == "private":

        def reject(repo):
            raise ScanError("Repository must match its connected ID and be public")

        monkeypatch.setattr("app.main.repository_metadata", reject)
    else:
        monkeypatch.setenv("OPENAI_API_KEY", "")
        settings.cache_clear()
    assert client.post(url, json={"enable_source_analysis": True}).status_code == 422
    with Session(engine()) as db:
        repo = db.get(Repository, repo_id)
        assert not repo.allow_source_ai and not repo.allow_ai
        assert db.scalar(select(func.count()).select_from(Job)) == 0
