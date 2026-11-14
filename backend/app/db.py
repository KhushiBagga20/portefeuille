from functools import lru_cache

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session

from app.config import settings


@lru_cache
def engine():
    db = create_engine(settings().database_url, pool_pre_ping=True)
    if db.dialect.name == "sqlite":

        @event.listens_for(db, "connect")
        def foreign_keys(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")

    return db


def get_db():
    with Session(engine()) as session:
        yield session
