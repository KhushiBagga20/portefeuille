"""Postgres is the durable outbox; Vercel Queues wakes a restricted job consumer."""

import logging
import os

from sqlalchemy import and_, or_, select
from vercel.queue import DuplicateIdempotencyKeyError
from vercel.queue.sync import QueueClient

from app.config import settings
from app.models import Job, now

TOPIC = "portfolio-jobs"
logger = logging.getLogger(__name__)


def dispatch_job(job):
    if not settings().queue_enabled or job is None or job.status in ("done", "failed"):
        return False
    try:
        QueueClient(region="iad1").send(
            TOPIC,
            {"job_id": job.id},
            retention=7 * 24 * 3600,
            # Daily reconciliation can recover a lost/expired delivery. DB leases fence duplicates.
            idempotency_key=(
                f"job:{job.id}:{os.environ.get('VERCEL_DEPLOYMENT_ID', 'local')}:{now().date().isoformat()}"
            ),
        )
    except DuplicateIdempotencyKeyError:
        return True
    except Exception as exc:
        # The committed outbox row survives a queue outage or a crash before send.
        logger.warning("Queue dispatch deferred (%s)", type(exc).__name__)
        return False
    return True


def dispatch_pending(db, limit=100):
    instant = now()
    rows = db.scalars(
        select(Job)
        .where(
            or_(
                and_(Job.status == "queued", Job.available_at <= instant),
                and_(Job.status == "running", Job.lease_until < instant),
            )
        )
        .order_by(Job.available_at)
        .limit(limit)
    )
    attempted = sent = 0
    for job in rows:
        attempted += 1
        sent += int(dispatch_job(job))
    return {"attempted": attempted, "dispatched": sent}
