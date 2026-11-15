import hashlib
import hmac
import json

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app import auth
from app.config import settings
from app.db import get_db
from app.github_projects import catalog, prepare_projects
from app.models import Delivery, Evidence, Job, OwnerSession, Project, Publication, Repository, Revision
from app.publishing import latest, project_by_slug, publish, revision_view
from app.queue_delivery import dispatch_job, dispatch_pending
from app.repository_scan import ScanError, enqueue_scan, scan_allowed, schedule_scans
from app.schemas import (
    GenerateInput,
    ImportRepositoriesInput,
    PublishInput,
    RepositoryInput,
    RevisionInput,
    digest,
)

app = FastAPI(title="Portfolio editorial API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings().frontend_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-CSRF-Token"],
)
app.include_router(auth.router)


@app.middleware("http")
async def private_cache_and_size(request: Request, call_next):
    # Buffer bounded bodies before JSON parsing (including chunked requests).
    if request.method in ("POST", "PUT", "PATCH"):
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 1_000_000:
                return Response("Request too large", status_code=413)
        request._body = bytes(body)
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}


@app.get("/api/v1/projects")
def public_projects(db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Publication)
        .join(Project, Publication.project_id == Project.id)
        .where(Publication.version == Project.version)
        .order_by(Project.slug)
    )
    return [row.snapshot["project"] for row in rows]


@app.get("/api/v1/projects/{slug}")
def public_project(slug: str, db: Session = Depends(get_db)):
    publication = latest(db, project_by_slug(db, slug))
    if not publication:
        raise HTTPException(404, "Project has not been published")
    return publication.snapshot["project"]


@app.get("/api/v1/projects/{slug}/case-study")
def public_case(slug: str, db: Session = Depends(get_db)):
    publication = latest(db, project_by_slug(db, slug))
    if not publication:
        raise HTTPException(404, "Project has not been published")
    return publication.snapshot["caseStudy"]


@app.get("/api/v1/studio/projects", dependencies=[Depends(auth.require_owner)])
def studio_projects(db: Session = Depends(get_db)):
    return [
        {"id": p.id, "slug": p.slug, "version": p.version}
        for p in db.scalars(select(Project).order_by(Project.slug))
    ]


@app.post("/api/v1/studio/projects", status_code=201, dependencies=[Depends(auth.require_owner)])
def create_project(body: RevisionInput, db: Session = Depends(get_db)):
    if body.base_version != 0 or body.parent_id is not None:
        raise HTTPException(422, "A new project must start at version 0 without a parent")
    project = Project(slug=body.content.project.slug)
    db.add(project)
    try:
        db.flush()
        content = body.content.public()
        revision = Revision(
            project_id=project.id, base_version=0, content=content, content_hash=digest(content)
        )
        db.add(revision)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Project slug already exists") from None
    return revision_view(revision)


@app.get("/api/v1/studio/github/repositories", dependencies=[Depends(auth.require_owner)])
def github_catalog(db: Session = Depends(get_db)):
    try:
        return catalog(db)
    except ScanError as exc:
        raise HTTPException(503, str(exc)) from None


@app.post("/api/v1/studio/github/project-drafts", dependencies=[Depends(auth.require_owner)])
def import_github_projects(body: ImportRepositoriesInput, db: Session = Depends(get_db)):
    try:
        result = prepare_projects(db, body.repository_ids)
        db.commit()
        return result
    except ScanError as exc:
        db.rollback()
        raise HTTPException(422, str(exc)) from None
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "A project already exists; refresh the repository list") from None


@app.post(
    "/api/v1/studio/projects/{slug}/revisions", status_code=201, dependencies=[Depends(auth.require_owner)]
)
def create_revision(slug: str, body: RevisionInput, db: Session = Depends(get_db)):
    project = project_by_slug(db, slug)
    if body.content.project.slug != slug:
        raise HTTPException(422, "Slug cannot be changed through a revision")
    if body.base_version != project.version:
        raise HTTPException(409, "Base version is stale")
    if body.parent_id:
        parent = db.get(Revision, body.parent_id)
        if not parent or parent.project_id != project.id:
            raise HTTPException(422, "Parent revision must belong to this project")
    content = body.content.public()
    revision = Revision(
        project_id=project.id,
        parent_id=body.parent_id,
        base_version=body.base_version,
        content=content,
        content_hash=digest(content),
    )
    db.add(revision)
    db.commit()
    return revision_view(revision)


@app.get("/api/v1/studio/projects/{slug}/revisions", dependencies=[Depends(auth.require_owner)])
def revisions(slug: str, db: Session = Depends(get_db)):
    project = project_by_slug(db, slug)
    return [
        revision_view(r)
        for r in db.scalars(
            select(Revision)
            .where(Revision.project_id == project.id)
            .order_by(Revision.created_at.desc())
            .limit(100)
        )
    ]


@app.post("/api/v1/studio/projects/{slug}/publications")
def publish_revision(
    slug: str,
    body: PublishInput,
    owner: OwnerSession = Depends(auth.require_owner),
    db: Session = Depends(get_db),
):
    publication = publish(db, project_by_slug(db, slug), body, owner.owner_id)
    dispatch_job(
        db.scalar(
            select(Job).where(Job.dedupe_key == f"rebuild:{publication.project_id}:{publication.version}")
        )
    )
    return {"id": publication.id, "version": publication.version, "published_at": publication.created_at}


@app.get("/api/v1/studio/projects/{slug}/publications", dependencies=[Depends(auth.require_owner)])
def publications(slug: str, db: Session = Depends(get_db)):
    project = project_by_slug(db, slug)
    return [
        {
            "id": p.id,
            "revision_id": p.revision_id,
            "content_hash": p.content_hash,
            "version": p.version,
            "snapshot": p.snapshot,
            "published_at": p.created_at,
        }
        for p in db.scalars(
            select(Publication)
            .where(Publication.project_id == project.id)
            .order_by(Publication.version.desc())
            .limit(100)
        )
    ]


@app.post(
    "/api/v1/studio/projects/{slug}/repositories", status_code=201, dependencies=[Depends(auth.require_owner)]
)
def connect_repo(slug: str, body: RepositoryInput, db: Session = Depends(get_db)):
    repo = Repository(project_id=project_by_slug(db, slug).id, **body.model_dump())
    db.add(repo)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Repository already connected") from None
    return {"id": repo.id, **body.model_dump()}


@app.get("/api/v1/studio/projects/{slug}/evidence", dependencies=[Depends(auth.require_owner)])
def evidence(slug: str, db: Session = Depends(get_db)):
    project = project_by_slug(db, slug)
    rows = db.scalars(
        select(Evidence)
        .join(Repository)
        .where(Repository.project_id == project.id)
        .order_by(Evidence.occurred_at.desc())
        .limit(100)
    )
    return [
        {
            "id": e.id,
            "title": e.title,
            "excerpt": e.excerpt,
            "source_url": e.source_url,
            "occurred_at": e.occurred_at,
        }
        for e in rows
    ]


@app.get("/api/v1/studio/projects/{slug}/repositories", dependencies=[Depends(auth.require_owner)])
def repositories(slug: str, db: Session = Depends(get_db)):
    project = project_by_slug(db, slug)
    return [
        {"id": r.id, "full_name": r.full_name, "scan_enabled": scan_allowed(r)}
        for r in db.scalars(select(Repository).where(Repository.project_id == project.id))
    ]


@app.post(
    "/api/v1/studio/projects/{slug}/repositories/{repository_id}/scan",
    status_code=202,
    dependencies=[Depends(auth.require_owner)],
)
def scan_repository(slug: str, repository_id: str, db: Session = Depends(get_db)):
    project = project_by_slug(db, slug)
    repo = db.get(Repository, repository_id)
    if not repo or repo.project_id != project.id:
        raise HTTPException(404, "Repository not found for this project")
    try:
        job = enqueue_scan(db, repo)
        # Only an explicit owner request retries a failed scan; scheduled checks do not.
        if job.status == "failed":
            job.status, job.attempts, job.error = "queued", 0, None
        db.commit()
    except ScanError as exc:
        raise HTTPException(422, str(exc)) from None
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Scan already queued; refresh to see its status") from None
    dispatch_job(job)
    return {"job_id": job.id, "status": job.status}


@app.post(
    "/api/v1/studio/projects/{slug}/generations", status_code=202, dependencies=[Depends(auth.require_owner)]
)
def generate(slug: str, body: GenerateInput, db: Session = Depends(get_db)):
    cfg = settings()
    if not cfg.ai_ready:
        raise HTTPException(503, "AI provider is not configured")
    project = project_by_slug(db, slug)
    if project.version != body.base_version:
        raise HTTPException(409, "Publish the baseline first and use the current version")
    ids = sorted(set(body.evidence_ids))
    rows = list(
        db.scalars(
            select(Evidence)
            .join(Repository)
            .where(Repository.project_id == project.id, Repository.allow_ai.is_(True), Evidence.id.in_(ids))
        )
    )
    if len(rows) != len(ids):
        raise HTTPException(422, "Evidence must belong to this project and its repository must allow AI")
    payload = {
        "project_id": project.id,
        "base_version": body.base_version,
        "evidence_ids": ids,
        "provider": cfg.ai_provider,
        "model": cfg.ai_model,
        "prompt_version": "1",
    }
    key = "generate:" + digest(payload)
    existing = db.scalar(select(Job).where(Job.dedupe_key == key))
    if existing:
        dispatch_job(existing)
        return {"job_id": existing.id, "status": existing.status}
    job = Job(kind="generate", dedupe_key=key, payload=payload)
    db.add(job)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        job = db.scalar(select(Job).where(Job.dedupe_key == key))
    dispatch_job(job)
    return {"job_id": job.id, "status": job.status}


@app.get("/api/v1/studio/jobs", dependencies=[Depends(auth.require_owner)])
def jobs(db: Session = Depends(get_db)):
    return [
        {
            "id": j.id,
            "kind": j.kind,
            "status": j.status,
            "attempts": j.attempts,
            "error": j.error,
            "project_id": j.payload.get("project_id"),
            "version": j.payload.get("version"),
            "progress": j.payload.get("progress", ""),
        }
        for j in db.scalars(select(Job).order_by(Job.available_at.desc()).limit(100))
    ]


@app.post("/api/v1/studio/jobs/dispatch", dependencies=[Depends(auth.require_owner)])
def redispatch_jobs(db: Session = Depends(get_db)):
    return dispatch_pending(db)


@app.get("/api/internal/jobs/reconcile")
def reconcile_jobs(request: Request, db: Session = Depends(get_db)):
    secret = settings().cron_secret
    if not secret or not hmac.compare_digest(request.headers.get("authorization", ""), f"Bearer {secret}"):
        raise HTTPException(401, "Unauthorized")
    scan_failed = False
    try:
        scan_result = schedule_scans(db)
        scan_failed = bool(scan_result["failed"])
        db.commit()
    except Exception:
        db.rollback()
        scan_failed = True
    result = dispatch_pending(db)
    if result["dispatched"] != result["attempted"]:
        raise HTTPException(503, "Queue delivery deferred")
    if scan_failed:
        raise HTTPException(503, "Repository check deferred; existing jobs dispatched")
    return result


@app.post("/webhooks/github", status_code=202)
async def webhook(request: Request, db: Session = Depends(get_db)):
    secret = settings().github_webhook_secret
    if not secret:
        raise HTTPException(503, "Webhook is not configured")
    raw = await request.body()
    expected = "sha256=" + hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(request.headers.get("x-hub-signature-256", ""), expected):
        raise HTTPException(401, "Invalid signature")
    delivery_id = request.headers.get("x-github-delivery", "")
    event = request.headers.get("x-github-event", "")
    if not delivery_id or len(delivery_id) > 100:
        raise HTTPException(400, "Missing or invalid delivery ID")
    try:
        data = json.loads(raw)
        repo_id = str(data["repository"]["id"])
    except (ValueError, KeyError, TypeError):
        raise HTTPException(400, "Invalid payload") from None
    repo = db.scalar(select(Repository).where(Repository.github_id == repo_id))
    if not repo:
        raise HTTPException(403, "Repository is not connected")
    if event == "ping":
        return {"status": "ok"}
    # This first release intentionally handles merged PRs and published releases only.
    if event not in ("pull_request", "release"):
        return {"status": "ignored"}
    if event == "pull_request" and (
        data.get("action") != "closed" or not data.get("pull_request", {}).get("merged")
    ):
        return {"status": "ignored"}
    if event == "release" and data.get("action") != "published":
        return {"status": "ignored"}
    db.add(Delivery(id=delivery_id, repository_id=repo.id, event=event, payload=data))
    db.add(Job(kind="ingest", dedupe_key="delivery:" + delivery_id, payload={"delivery_id": delivery_id}))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if not db.get(Delivery, delivery_id):
            raise
        await run_in_threadpool(
            dispatch_job, db.scalar(select(Job).where(Job.dedupe_key == "delivery:" + delivery_id))
        )
        return {"status": "duplicate"}
    await run_in_threadpool(
        dispatch_job, db.scalar(select(Job).where(Job.dedupe_key == "delivery:" + delivery_id))
    )
    return {"status": "queued"}
