from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def now():
    return datetime.now(UTC)


def uid():
    return str(uuid4())


class Base(DeclarativeBase):
    pass


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    version: Mapped[int] = mapped_column(Integer, default=0)
    # Version 0 means unpublished. Publications are uniquely keyed by project and version.


class Revision(Base):
    __tablename__ = "revisions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    parent_id: Mapped[str | None] = mapped_column(ForeignKey("revisions.id"))
    base_version: Mapped[int] = mapped_column(Integer)
    content: Mapped[dict] = mapped_column(JSON)
    content_hash: Mapped[str] = mapped_column(String(64))
    source: Mapped[str] = mapped_column(String(20), default="manual")
    review_notes: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Publication(Base):
    __tablename__ = "publications"
    __table_args__ = (UniqueConstraint("project_id", "version"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    revision_id: Mapped[str] = mapped_column(ForeignKey("revisions.id"))
    version: Mapped[int] = mapped_column(Integer)
    snapshot: Mapped[dict] = mapped_column(JSON)
    content_hash: Mapped[str] = mapped_column(String(64))
    approved_by: Mapped[str] = mapped_column(String(50))
    idempotency_key: Mapped[str] = mapped_column(String(100), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Repository(Base):
    __tablename__ = "repositories"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    github_id: Mapped[str] = mapped_column(String(30), unique=True)
    full_name: Mapped[str] = mapped_column(String(200))
    allow_ai: Mapped[bool] = mapped_column(default=False)


class Delivery(Base):
    __tablename__ = "deliveries"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    repository_id: Mapped[str] = mapped_column(ForeignKey("repositories.id"))
    event: Mapped[str] = mapped_column(String(50))
    payload: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Evidence(Base):
    __tablename__ = "evidence"
    __table_args__ = (UniqueConstraint("repository_id", "external_key"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    repository_id: Mapped[str] = mapped_column(ForeignKey("repositories.id"))
    external_key: Mapped[str] = mapped_column(String(150))
    title: Mapped[str] = mapped_column(Text)
    excerpt: Mapped[str] = mapped_column(Text)
    source_url: Mapped[str] = mapped_column(Text)
    occurred_at: Mapped[str] = mapped_column(String(50))


class RevisionEvidence(Base):
    __tablename__ = "revision_evidence"
    revision_id: Mapped[str] = mapped_column(ForeignKey("revisions.id"), primary_key=True)
    evidence_id: Mapped[str] = mapped_column(ForeignKey("evidence.id"), primary_key=True)


class Job(Base):
    __tablename__ = "jobs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    kind: Mapped[str] = mapped_column(String(30))
    dedupe_key: Mapped[str] = mapped_column(String(200), unique=True)
    payload: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(20), default="queued", index=True)
    attempts: Mapped[int] = mapped_column(default=0)
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    lease_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    lease_token: Mapped[str | None] = mapped_column(String(36))
    error: Mapped[str | None] = mapped_column(Text)


class OwnerSession(Base):
    __tablename__ = "owner_sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(String(50))
    csrf: Mapped[str] = mapped_column(String(100))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
