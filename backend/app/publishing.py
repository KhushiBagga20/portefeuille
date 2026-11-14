from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import Project, Publication, Revision
from app.schemas import Content, PublishInput, digest


def project_by_slug(db, slug):
    project = db.scalar(select(Project).where(Project.slug == slug))
    if project is None:
        raise HTTPException(404, "Project not found")
    return project


def latest(db, project):
    return db.scalar(
        select(Publication).where(
            Publication.project_id == project.id, Publication.version == project.version
        )
    )


def revision_view(revision):
    return {
        "id": revision.id,
        "base_version": revision.base_version,
        "parent_id": revision.parent_id,
        "content": revision.content,
        "content_hash": revision.content_hash,
        "source": revision.source,
        "review_notes": revision.review_notes,
        "created_at": revision.created_at,
    }


def publish(db: Session, project: Project, body: PublishInput, owner: str):
    existing = db.scalar(select(Publication).where(Publication.idempotency_key == body.idempotency_key))
    if existing:
        if (
            existing.project_id != project.id
            or existing.revision_id != body.revision_id
            or existing.content_hash != body.content_hash
            or existing.version != body.expected_version + 1
        ):
            raise HTTPException(409, "Idempotency key already used for another request")
        return existing
    revision = db.get(Revision, body.revision_id)
    if revision is None or revision.project_id != project.id:
        raise HTTPException(404, "Revision not found")
    if revision.content_hash != body.content_hash or digest(revision.content) != body.content_hash:
        raise HTTPException(409, "Preview hash does not match the saved revision")
    if revision.base_version != body.expected_version:
        raise HTTPException(409, "Revision is based on a different publication; rebase and review")
    snapshot = Content.model_validate(revision.content).public()
    # Atomic compare-and-swap prevents two editors publishing from the same base.
    changed = db.execute(
        update(Project)
        .where(Project.id == project.id, Project.version == body.expected_version)
        .values(version=body.expected_version + 1)
    )
    if changed.rowcount != 1:
        raise HTTPException(409, "A newer publication exists; rebase and review")
    publication = Publication(
        project_id=project.id,
        revision_id=revision.id,
        version=body.expected_version + 1,
        snapshot=snapshot,
        content_hash=body.content_hash,
        approved_by=owner,
        idempotency_key=body.idempotency_key,
    )
    db.add(publication)
    db.commit()
    db.refresh(publication)
    return publication
