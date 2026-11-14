import os
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth import token_hash
from app.config import settings
from app.db import engine
from app.models import Base, OwnerSession, now


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", os.environ.get("TEST_DATABASE_URL", f"sqlite:///{tmp_path}/test.db"))
    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.setenv("OWNER_GITHUB_ID", "123")
    monkeypatch.setenv("GITHUB_WEBHOOK_SECRET", "test-webhook-secret")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_MODEL", "test-model")
    settings.cache_clear()
    engine.cache_clear()
    Base.metadata.create_all(engine())
    with Session(engine()) as db:
        db.add(
            OwnerSession(
                token_hash=token_hash("owner-token"),
                owner_id="123",
                csrf="test-csrf",
                expires_at=now() + timedelta(hours=1),
            )
        )
        db.commit()
    from app.main import app

    with TestClient(app) as client:
        client.cookies.set("portfolio_session", "owner-token")
        client.headers.update({"Origin": "http://localhost:4321", "X-CSRF-Token": "test-csrf"})
        yield client
    Base.metadata.drop_all(engine())
    engine().dispose()
    engine.cache_clear()
    settings.cache_clear()


@pytest.fixture
def content():
    return {
        "project": {
            "slug": "test-project",
            "name": "Test",
            "type": "Personal project",
            "labels": [],
            "disk": {"tone": "sky", "scribble": "test"},
            "links": {},
        },
        "caseStudy": {"slug": "test-project", "status": "published", "intro": {}},
    }
