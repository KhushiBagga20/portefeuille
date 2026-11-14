"""Compiled by Vercel into a private push consumer, with no public API route."""

from sqlalchemy.orm import Session
from vercel.queue import RetryAfter, subscribe

from app.db import worker_engine
from app.models import Job
from app.queue_delivery import TOPIC
from app.worker import run_once


def process_job(payload):
    job_id = payload.get("job_id")
    if not isinstance(job_id, str) or len(job_id) != 36:
        raise ValueError("Invalid job ID")
    connection = worker_engine()
    run_once(job_id=job_id, db_engine=connection)
    with Session(connection) as db:
        job = db.get(Job, job_id)
        if job is not None and job.status in ("queued", "running"):
            # Includes DB backoff and an unexpired lease held by another delivery.
            raise RetryAfter(5 if job.kind == "repository_scan" and not job.error else 60)


@subscribe(topic=TOPIC, consumer_group="portfolio-worker", retry_after=60, max_concurrency=2, max_attempts=50)
def consume_job(payload: dict[str, str]) -> None:
    process_job(payload)
