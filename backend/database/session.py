import os
import logging
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

logger = logging.getLogger("securerag-db")

BASE_DIR = Path(__file__).resolve().parents[2]

# Load DATABASE_URL from env, default to SQLite fallback if Postgres is not configured locally
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL or DATABASE_URL.startswith("prisma"):
    db_path = BASE_DIR / "securerag.db"
    DATABASE_URL = f"sqlite:///{db_path}"
    logger.info("Using SQLite database at: %s", db_path)

# Handle Postgres dialect format if starting with postgres://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
    echo=False,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db():
    """
    FastAPI dependency that yields a database session.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Create database tables if they do not exist.
    """
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized successfully.")
