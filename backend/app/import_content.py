"""Import a reviewed local JSON export as private revisions, never publications."""

import argparse
import json
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import engine
from app.models import Project, Revision
from app.schemas import Content, digest


def import_content(path):
    contents = [Content.model_validate(item) for item in json.loads(Path(path).read_text())]
    count = 0
    with Session(engine()) as db:
        for item in contents:
            if db.scalar(select(Project).where(Project.slug == item.project.slug)):
                continue  # Never replace existing editorial work.
            project = Project(slug=item.project.slug)
            db.add(project)
            db.flush()
            value = item.public()
            db.add(
                Revision(
                    project_id=project.id,
                    base_version=0,
                    content=value,
                    content_hash=digest(value),
                    source="import",
                )
            )
            count += 1
        db.commit()
    return count


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("file")
    args = parser.parse_args()
    print(f"Imported {import_content(args.file)} private drafts. Nothing published.")
