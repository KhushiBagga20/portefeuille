"""Owner-selected public repositories become private project-card drafts."""

import re

from sqlalchemy import select

from app.config import settings
from app.models import Project, Repository, Revision
from app.publishing import revision_view
from app.repository_scan import ScanError, github_json
from app.schemas import Content, digest


def public_repositories():
    cfg = settings()
    login = cfg.github_owner_login
    if not re.fullmatch(r"[A-Za-z0-9-]{1,39}", login):
        raise ScanError("GitHub account is not configured")
    user = github_json(f"/users/{login}")
    if user["id"] != cfg.owner_github_id:
        raise ScanError("GitHub account does not match the portfolio owner")
    repos = []
    for page in range(1, 4):
        rows = github_json(f"/users/{login}/repos?type=owner&sort=updated&per_page=100&page={page}")
        repos.extend(
            r for r in rows if not r.get("private", True) and r["owner"]["id"] == cfg.owner_github_id
        )
        if len(rows) < 100:
            return repos
    raise ScanError("More than 300 repositories; narrow the catalog before importing")


def slug_for(name):
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:90].rstrip("-")
    if not slug:
        raise ScanError("Repository name cannot form a project address")
    return slug


def matched_project(db, metadata):
    repo = db.scalar(select(Repository).where(Repository.github_id == str(metadata["id"])))
    if repo:
        return db.get(Project, repo.project_id)
    return db.scalar(select(Project).where(Project.slug == slug_for(metadata["name"])))


def catalog(db):
    result = []
    for item in public_repositories():
        project = matched_project(db, item)
        result.append(
            {
                "github_id": str(item["id"]),
                "name": item["name"],
                "full_name": item["full_name"],
                "description": item.get("description") or "",
                "fork": bool(item.get("fork")),
                "archived": bool(item.get("archived")),
                "project_slug": project.slug if project else None,
                "published": bool(project and project.version),
            }
        )
    return result


def prepare_projects(db, ids):
    metadata = {str(r["id"]): r for r in public_repositories()}
    if not set(ids).issubset(metadata):
        raise ScanError("Select public repositories owned by your GitHub account")
    result = []
    for github_id in dict.fromkeys(ids):
        item = metadata[github_id]
        project = matched_project(db, item)
        if project:
            revision = db.scalar(
                select(Revision)
                .where(
                    Revision.project_id == project.id,
                    Revision.base_version == project.version,
                    Revision.source == "github-import",
                )
                .order_by(Revision.created_at.desc())
            )
            result.append(
                {
                    "slug": project.slug,
                    "published": bool(project.version),
                    "revision": revision_view(revision) if revision and not project.version else None,
                }
            )
            continue
        project = Project(slug=slug_for(item["name"]))
        db.add(project)
        db.flush()
        info = {
            "slug": project.slug,
            "name": item["name"],
            "type": "Forked repository" if item.get("fork") else "Software project",
            "labels": [],
            "disk": {"tone": "sky", "scribble": item["name"][:30]},
            "links": {"github": f"https://github.com/{item['full_name']}"},
        }
        if item.get("description"):
            info["oneLiner"] = item["description"]
        if item.get("language"):
            info["stack"] = [item["language"]]
        content = Content.model_validate(
            {
                "project": info,
                "caseStudy": {
                    "slug": project.slug,
                    "intro": {},
                },
            }
        ).public()
        revision = Revision(
            project_id=project.id,
            base_version=0,
            content=content,
            content_hash=digest(content),
            source="github-import",
            review_notes={
                "warning": "Project card from public GitHub metadata. Review the title and description. "
                "No source-code analysis or full case study has been generated."
            },
        )
        db.add(revision)
        db.add(
            Repository(
                project_id=project.id, github_id=github_id, full_name=item["full_name"], allow_ai=False
            )
        )
        db.flush()
        result.append({"slug": project.slug, "published": False, "revision": revision_view(revision)})
    return result
