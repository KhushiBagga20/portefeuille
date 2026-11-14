from functools import lru_cache

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session

from app.config import settings


@lru_cache
def engine():
    cfg = settings()
    url = (
        cfg.worker_database_url
        if cfg.process_role == "worker" and cfg.worker_database_url
        else cfg.database_url
    )
    options = {"pool_pre_ping": True}
    if url.startswith("postgresql"):
        # Small pools per process; disable prepared statements for transaction poolers.
        options.update(
            pool_size=2,
            max_overflow=0,
            pool_timeout=10,
            pool_recycle=300,
            connect_args={"prepare_threshold": None, "connect_timeout": 10},
        )
    db = create_engine(url, **options)
    if db.dialect.name == "sqlite":

        @event.listens_for(db, "connect")
        def foreign_keys(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")

    return db


def get_db():
    with Session(engine()) as session:
        yield session
