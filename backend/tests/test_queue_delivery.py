import asyncio
from datetime import timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session
from vercel.queue import RetryAfter
from vercel.queue.embedded import embedded_queue_service

from app import queue_delivery, queue_subscriber, worker
from app.config import settings
from app.db import engine
from app.models import Job, now


def test_consumer_targets_one_job_and_duplicate_delivery_is_safe(client, monkeypatch):
    calls = []
    monkeypatch.setattr(queue_subscriber, "worker_engine", engine)
    monkeypatch.setattr(worker, "request_rebuild", lambda db, payload: calls.append(payload["marker"]))
    with Session(engine()) as db:
        earlier = Job(kind="rebuild", dedupe_key="earlier", payload={"marker": "earlier"})
        target = Job(kind="rebuild", dedupe_key="target", payload={"marker": "target"})
        db.add_all([earlier, target])
        db.commit()
        job_id = target.id
    queue_subscriber.process_job({"job_id": job_id})
    queue_subscriber.process_job({"job_id": job_id})
    assert calls == ["target"]
    with Session(engine()) as db:
        assert db.scalar(select(Job).where(Job.dedupe_key == "earlier")).status == "queued"
        assert db.get(Job, job_id).status == "done"


def test_consumer_retries_backoff_and_stops_at_database_attempt_limit(client, monkeypatch):
    monkeypatch.setattr(queue_subscriber, "worker_engine", engine)

    def unavailable(db, payload):
        raise RuntimeError("secret provider details must not be stored")

    monkeypatch.setattr(worker, "request_rebuild", unavailable)
    with Session(engine()) as db:
        job = Job(kind="rebuild", dedupe_key="retry", payload={})
        db.add(job)
        db.commit()
        job_id = job.id
    for attempt in (1, 2):
        with pytest.raises(RetryAfter):
            queue_subscriber.process_job({"job_id": job_id})
        # Redelivery during backoff cannot prematurely consume another attempt.
        with pytest.raises(RetryAfter):
            queue_subscriber.process_job({"job_id": job_id})
        with Session(engine()) as db:
            job = db.get(Job, job_id)
            assert job.attempts == attempt
            assert job.error == "RuntimeError"
            job.available_at = now() - timedelta(seconds=1)
            db.commit()
    queue_subscriber.process_job({"job_id": job_id})
    with Session(engine()) as db:
        assert db.get(Job, job_id).status == "failed"
        assert db.get(Job, job_id).attempts == 3


def test_queue_outage_leaves_outbox_recoverable_and_cron_requires_secret(client, monkeypatch):
    monkeypatch.setenv("QUEUE_ENABLED", "true")
    monkeypatch.setenv("CRON_SECRET", "cron-secret-for-test")
    settings.cache_clear()

    class UnavailableQueue:
        def __init__(self, **kwargs):
            pass

        def send(self, *args, **kwargs):
            raise RuntimeError("unavailable")

    monkeypatch.setattr(queue_delivery, "QueueClient", UnavailableQueue)
    with Session(engine()) as db:
        job = Job(kind="rebuild", dedupe_key="recoverable", payload={})
        db.add(job)
        db.commit()
        job_id = job.id
        assert not queue_delivery.dispatch_job(job)
    endpoint = "/api/internal/jobs/reconcile"
    assert client.get(endpoint).status_code == 401
    assert client.get(endpoint, headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert client.get(endpoint, headers={"Authorization": "Bearer cron-secret-for-test"}).status_code == 503
    sent = []

    class WorkingQueue(UnavailableQueue):
        def send(self, topic, payload, **kwargs):
            sent.append((topic, payload))

    monkeypatch.setattr(queue_delivery, "QueueClient", WorkingQueue)
    response = client.get(endpoint, headers={"Authorization": "Bearer cron-secret-for-test"})
    assert response.json() == {"attempted": 1, "dispatched": 1}
    assert sent == [("portfolio-jobs", {"job_id": job_id})]
    with Session(engine()) as db:
        assert db.get(Job, job_id).status == "queued"


def test_dispatch_endpoint_requires_owner_and_csrf(client):
    client.headers["X-CSRF-Token"] = "wrong"
    assert client.post("/api/v1/studio/jobs/dispatch").status_code == 403
    client.cookies.clear()
    assert client.post("/api/v1/studio/jobs/dispatch").status_code == 401


def test_sdk_push_delivery_runs_registered_consumer(client, monkeypatch):
    calls = []
    monkeypatch.setattr(queue_subscriber, "worker_engine", engine)
    monkeypatch.setattr(worker, "request_rebuild", lambda db, payload: calls.append("rebuilt"))
    with Session(engine()) as db:
        job = Job(kind="rebuild", dedupe_key="sdk-push", payload={})
        db.add(job)
        db.commit()
        job_id = job.id

    async def deliver():
        async with embedded_queue_service() as service:
            await service.get_async_client().send("portfolio-jobs", {"job_id": job_id})
            async with asyncio.timeout(5):
                while True:
                    with Session(engine()) as db:
                        if db.get(Job, job_id).status == "done":
                            break
                    await asyncio.sleep(0.02)

    asyncio.run(deliver())
    assert calls == ["rebuilt"]
