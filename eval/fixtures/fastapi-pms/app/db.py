"""Database engine, session factory, and the FastAPI session dependency."""

from collections.abc import Iterator

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

# Load .env so SEAM_API_KEY (and anything else) is available via os.environ.
load_dotenv()

DATABASE_URL = "sqlite:///./pms.db"

engine = create_engine(
    DATABASE_URL,
    # SQLite + FastAPI's threadpool means a connection can move between threads.
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    """Yield a request-scoped session, closing it when the request finishes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
