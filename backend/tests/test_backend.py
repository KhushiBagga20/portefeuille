import copy
import hashlib
import hmac
import json
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import engine
from app.models import Delivery, Evidence, Job, OwnerSession, Project, Publication, now
from app.schemas import AIProposal
from app.worker import run_once

ROOT = "/api/v1/studio/projects"
SLUG = "test-project"


def create(client, content):
    r = client.post(ROOT, json={"content": content, "base_version": 0})
    assert r.status_code == 201, r.text
    return r.json()


def publish(client, revision, key="idempotency-test-0001"):
    return client.post(
        f"{ROOT}/{SLUG}/publications",
        json={
            "revision_id": revision["id"],
            "content_hash": revision["content_hash"],
            "expected_version": revision["base_version"],
            "idempotency_key": key,
        },
    )


def test_private_until_approval_and_exact_public_shape(client, content):
    revision = create(client, content)
    assert client.get("/api/v1/projects").json() == []
    assert client.get(f"/api/v1/projects/{SLUG}/case-study").status_code == 404
    assert publish(client, revision).status_code == 200
    public = client.get(f"/api/v1/projects/{SLUG}/case-study")
    assert public.json() == content["caseStudy"]
    assert "review_notes" not in public.text
    assert public.headers["cache-control"] == "no-store"
    assert publish(client, revision).json()["version"] == 1
    with Session(engine()) as db:
        assert db.scalar(select(func.count()).select_from(Publication)) == 1


def test_stale_candidate_and_wrong_hash_rejected(client, content):
    first = create(client, content)
    second = client.post(f"{ROOT}/{SLUG}/revisions", json={"content": content, "base_version": 0}).json()
    wrong = dict(first, content_hash="wrong")
    assert publish(client, wrong).status_code == 409
    assert publish(client, first).status_code == 200
    assert publish(client, second, "idempotency-test-0002").status_code == 409
    assert (
        client.post(f"{ROOT}/{SLUG}/revisions", json={"content": content, "base_version": 0}).status_code
        == 409
    )


def test_rollback_is_a_new_reviewed_publication(client, content):
    initial = create(client, content)
    publish(client, initial)
    changed = copy.deepcopy(content)
    changed["caseStudy"]["intro"] = {"problem": ["Changed"]}
    second = client.post(f"{ROOT}/{SLUG}/revisions", json={"content": changed, "base_version": 1}).json()
    assert publish(client, second, "idempotency-test-0002").status_code == 200
    restored = client.post(
        f"{ROOT}/{SLUG}/revisions", json={"content": initial["content"], "base_version": 2}
    ).json()
    assert publish(client, restored, "idempotency-test-0003").json()["version"] == 3
    assert client.get(f"/api/v1/projects/{SLUG}/case-study").json()["intro"] == {}


def test_login_csrf_and_expiration(client, content):
    client.headers["X-CSRF-Token"] = "bad"
    assert client.post(ROOT, json={"content": content, "base_version": 0}).status_code == 403
    client.headers["X-CSRF-Token"] = "test-csrf"
    client.headers["Origin"] = "https://evil.example"
    assert client.post(ROOT, json={"content": content, "base_version": 0}).status_code == 403
    client.headers["Origin"] = "http://localhost:4321"
    with Session(engine()) as db:
        row = db.scalar(select(OwnerSession))
        row.expires_at = now() - timedelta(seconds=1)
        db.commit()
    assert client.get(ROOT).status_code == 401
    client.cookies.clear()
    assert client.get(ROOT).status_code == 401


def test_private_fields_and_script_urls_rejected(client, content):
    content["project"]["todo"] = ["private notes"]
    assert client.post(ROOT, json={"content": content, "base_version": 0}).status_code == 422
    del content["project"]["todo"]
    content["project"]["links"]["demo"] = "javascript:alert(1)"
    assert client.post(ROOT, json={"content": content, "base_version": 0}).status_code == 422


def setup_repo(client, content, allow_ai=True):
    revision = create(client, content)
    publish(client, revision)
    response = client.post(
        f"{ROOT}/{SLUG}/repositories",
        json={"github_id": "456", "full_name": "owner/project", "allow_ai": allow_ai},
    )
    assert response.status_code == 201
    return response.json()


def deliver(client, delivery="delivery-1", signature=True, repo_id=456):
    body = json.dumps(
        {
            "repository": {"id": repo_id, "default_branch": "main"},
            "action": "closed",
            "pull_request": {
                "number": 7,
                "title": "Reconnect handling",
                "body": "Adds retries",
                "merged": True,
                "merged_at": "2026-11-14T00:00:00Z",
                "base": {"ref": "main"},
                "html_url": "https://github.com/owner/project/pull/7",
            },
        }
    )
    sig = "sha256=" + hmac.new(b"test-webhook-secret", body.encode(), hashlib.sha256).hexdigest()
    return client.post(
        "/webhooks/github",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-GitHub-Delivery": delivery,
            "X-GitHub-Event": "pull_request",
            "X-Hub-Signature-256": sig if signature else "bad",
        },
    )


def test_webhook_verification_dedup_and_worker(client, content):
    setup_repo(client, content)
    assert deliver(client, signature=False).status_code == 401
    assert deliver(client, repo_id=999).status_code == 403
    assert deliver(client).status_code == 202
    assert deliver(client).json()["status"] == "duplicate"
    assert run_once()
    assert deliver(client, delivery="delivery-2").status_code == 202
    assert run_once()
    with Session(engine()) as db:
        assert db.scalar(select(func.count()).select_from(Evidence)) == 1
        assert db.scalar(select(func.count()).select_from(Delivery)) == 2
    assert not run_once()


def test_ai_draft_never_publishes(client, content, monkeypatch):
    setup_repo(client, content)
    deliver(client)
    run_once()
    evidence = client.get(f"{ROOT}/{SLUG}/evidence").json()

    def fake_ai(items, model):
        return AIProposal(
            title="Reconnect handling",
            body="Added retry handling.",
            evidence_ids=[items[0]["id"]],
            questions=["Was this tested on a device?"],
        )

    monkeypatch.setattr("app.worker.ask_ai", fake_ai)
    request = {"base_version": 1, "evidence_ids": [evidence[0]["id"]]}
    first = client.post(f"{ROOT}/{SLUG}/generations", json=request)
    assert first.status_code == 202
    assert client.post(f"{ROOT}/{SLUG}/generations", json=request).json()["job_id"] == first.json()["job_id"]
    assert run_once()
    assert "updates" not in client.get(f"/api/v1/projects/{SLUG}/case-study").json()
    revisions = client.get(f"{ROOT}/{SLUG}/revisions").json()
    draft = next(r for r in revisions if r["source"] == "ai")
    assert draft["review_notes"]["questions"]
    assert publish(client, draft, "idempotency-test-ai-2").status_code == 200
    assert len(client.get(f"/api/v1/projects/{SLUG}/case-study").json()["updates"]) == 1


def test_repository_requires_explicit_ai_consent(client, content):
    setup_repo(client, content, allow_ai=False)
    deliver(client)
    run_once()
    evidence = client.get(f"{ROOT}/{SLUG}/evidence").json()
    assert (
        client.post(
            f"{ROOT}/{SLUG}/generations", json={"base_version": 1, "evidence_ids": [evidence[0]["id"]]}
        ).status_code
        == 422
    )


def test_failed_jobs_retry_without_leaking_provider_errors(client, content, monkeypatch):
    setup_repo(client, content)
    deliver(client)

    def broken(*args):
        raise RuntimeError("SECRET must never enter stored error")

    monkeypatch.setattr("app.worker.ingest", broken)
    assert run_once()
    with Session(engine()) as db:
        job = db.scalar(select(Job))
        assert job.status == "queued"
        assert job.error == "RuntimeError"
        job.attempts = 2
        job.available_at = now() - timedelta(seconds=1)
        db.commit()
    assert run_once()
    with Session(engine()) as db:
        assert db.scalar(select(Job)).status == "failed"


def test_large_request_rejected_before_parse(client):
    assert client.post("/webhooks/github", content=b"x" * 1_000_001).status_code == 413


def test_publication_cannot_use_another_projects_revision(client, content):
    revision = create(client, content)
    other = copy.deepcopy(content)
    other["project"]["slug"] = other["caseStudy"]["slug"] = "another-project"
    create(client, other)
    response = client.post(
        f"{ROOT}/another-project/publications",
        json={
            "revision_id": revision["id"],
            "content_hash": revision["content_hash"],
            "expected_version": 0,
            "idempotency_key": "cross-project-test-0001",
        },
    )
    assert response.status_code == 404


def test_expired_job_lease_is_recovered(client, content):
    setup_repo(client, content)
    deliver(client)
    with Session(engine()) as db:
        job = db.scalar(select(Job))
        job.status = "running"
        job.attempts = 1
        job.lease_token = "abandoned"
        job.lease_until = now() - timedelta(minutes=1)
        db.commit()
    assert run_once()
    with Session(engine()) as db:
        job = db.scalar(select(Job))
        assert job.status == "done"
        assert job.attempts == 2


def test_oauth_rejects_invalid_state_and_other_accounts(client, monkeypatch):
    import httpx

    from app.auth import signer
    from app.config import settings

    monkeypatch.setenv("SESSION_SECRET", "x" * 48)
    monkeypatch.setenv("GITHUB_CLIENT_ID", "test-client")
    monkeypatch.setenv("GITHUB_CLIENT_SECRET", "test-secret")
    settings.cache_clear()
    assert client.get("/auth/github/callback?code=fake&state=bad").status_code == 400
    client.cookies.set("portfolio_oauth", signer().dumps({"state": "test-state", "verifier": "verifier"}))

    def fake_post(self, url, **kwargs):
        return httpx.Response(200, json={"access_token": "fake"}, request=httpx.Request("POST", url))

    def fake_get(self, url, **kwargs):
        return httpx.Response(200, json={"id": 999}, request=httpx.Request("GET", url))

    monkeypatch.setattr(httpx.Client, "post", fake_post)
    monkeypatch.setattr(httpx.Client, "get", fake_get)
    # Call TestClient.request so the monkeypatched HTTP transport methods only affect GitHub calls.
    response = client.request("GET", "/auth/github/callback?code=fake&state=test-state")
    assert response.status_code == 403


def test_initial_import_is_private_and_idempotent(client, content, tmp_path):
    from app.import_content import import_content

    file = tmp_path / "content.json"
    file.write_text(json.dumps([content]))
    assert import_content(file) == 1
    assert import_content(file) == 0
    assert client.get("/api/v1/projects").json() == []


def test_concurrent_publishing_has_one_winner(client, content):
    import pytest

    if engine().dialect.name != "postgresql":
        pytest.skip("Concurrency semantics are tested against PostgreSQL")
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    from fastapi import HTTPException

    from app.publishing import publish as publish_service
    from app.schemas import PublishInput

    first = create(client, content)
    second = client.post(f"{ROOT}/{SLUG}/revisions", json={"content": content, "base_version": 0}).json()
    barrier = Barrier(2)

    def attempt(revision):
        with Session(engine()) as db:
            project = db.scalar(select(Project).where(Project.slug == SLUG))
            barrier.wait(timeout=5)
            try:
                publish_service(
                    db,
                    project,
                    PublishInput(
                        revision_id=revision["id"],
                        content_hash=revision["content_hash"],
                        expected_version=0,
                        idempotency_key=revision["id"],
                    ),
                    "123",
                )
                return 200
            except HTTPException as exc:
                db.rollback()
                return exc.status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(attempt, [first, second]))
    assert sorted(statuses) == [200, 409]


def test_ai_provider_output_requires_known_evidence(client, monkeypatch):
    import httpx
    import pytest

    from app.worker import ask_ai

    def response(self, url, **kwargs):
        return httpx.Response(
            200,
            request=httpx.Request("POST", url),
            json={
                "choices": [
                    {
                        "finish_reason": "stop",
                        "message": {
                            "content": json.dumps(
                                {
                                    "title": "Update",
                                    "body": "Something changed",
                                    "evidence_ids": ["invented"],
                                    "questions": [],
                                }
                            )
                        },
                    }
                ]
            },
        )

    monkeypatch.setattr(httpx.Client, "post", response)
    with pytest.raises(ValueError, match="outside this request"):
        ask_ai([{"id": "real", "title": "Change", "description": "Description"}], "test-model")


def test_diagram_requires_valid_nodes(client, content):
    content["caseStudy"]["diagrams"] = [
        {
            "id": "system",
            "title": "System",
            "basis": "built",
            "nodes": [],
            "edges": [{"from": "missing", "to": "other", "flow": "forward"}],
        }
    ]
    assert client.post(ROOT, json={"content": content, "base_version": 0}).status_code == 422
