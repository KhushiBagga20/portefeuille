import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from test_backend import create, publish

from app.config import settings
from app.db import engine
from app.models import Project, Repository, Revision
from app.repository_scan import ScanError


@pytest.fixture
def repositories(monkeypatch):
    rows = [
        {
            "id": 77,
            "name": "New-Project",
            "full_name": "owner/New-Project",
            "private": False,
            "owner": {"id": 123},
            "description": "A factual description",
            "language": "TypeScript",
            "fork": True,
            "archived": False,
        }
    ]
    monkeypatch.setattr("app.github_projects.public_repositories", lambda: rows)
    return rows


def test_selected_repo_private_until_exact_approval(client, repositories):
    result = client.post("/api/v1/studio/github/project-drafts", json={"repository_ids": ["77"]})
    assert result.status_code == 200
    card = result.json()[0]
    assert card["slug"] == "new-project"
    assert card["revision"]["content"]["project"]["type"] == "Forked repository"
    assert client.get("/api/v1/projects").json() == []
    repeated = client.post("/api/v1/studio/github/project-drafts", json={"repository_ids": ["77"]})
    assert repeated.json()[0]["revision"]["id"] == card["revision"]["id"]
    with Session(engine()) as db:
        assert db.scalar(select(func.count()).select_from(Project)) == 1
        assert db.scalar(select(func.count()).select_from(Revision)) == 1
        assert not db.scalar(select(Repository)).allow_ai
    r = card["revision"]
    approved = client.post(
        "/api/v1/studio/projects/new-project/publications",
        json={
            "revision_id": r["id"],
            "content_hash": r["content_hash"],
            "expected_version": 0,
            "idempotency_key": "github-card-approved-test",
        },
    )
    assert approved.status_code == 200
    assert client.get("/api/v1/projects").json()[0]["slug"] == "new-project"
    assert client.get("/api/v1/studio/github/repositories").json()[0]["published"]


def test_reject_unknown_selection_and_require_owner_csrf(client, repositories):
    url = "/api/v1/studio/github/project-drafts"
    assert client.post(url, json={"repository_ids": ["77", "999"]}).status_code == 422
    with Session(engine()) as db:
        assert db.scalar(select(func.count()).select_from(Project)) == 0
    client.headers["X-CSRF-Token"] = "wrong"
    assert client.post(url, json={"repository_ids": ["77"]}).status_code == 403
    client.cookies.clear()
    assert client.get("/api/v1/studio/github/repositories").status_code == 401


def test_existing_publication_never_overwritten(client, content, repositories):
    revision = create(client, content)
    publish(client, revision)
    repositories[0]["name"] = "test-project"
    result = client.post("/api/v1/studio/github/project-drafts", json={"repository_ids": ["77"]}).json()
    assert result[0]["published"] and result[0]["revision"] is None
    assert client.get("/api/v1/projects").json()[0]["name"] == "Test"


def test_catalog_checks_owner_and_excludes_private(client, monkeypatch):
    from app.github_projects import public_repositories

    monkeypatch.setenv("GITHUB_OWNER_LOGIN", "owner")
    settings.cache_clear()
    monkeypatch.setattr("app.github_projects.github_json", lambda path: {"id": 999})
    with pytest.raises(ScanError, match="does not match"):
        public_repositories()

    def api(path):
        if path == "/users/owner":
            return {"id": 123}
        return [
            {"id": 1, "private": False, "owner": {"id": 123}},
            {"id": 2, "private": True, "owner": {"id": 123}},
            {"id": 3, "private": False, "owner": {"id": 999}},
        ]

    monkeypatch.setattr("app.github_projects.github_json", api)
    assert [r["id"] for r in public_repositories()] == [1]
