import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.database.session import init_db
from backend.middleware.logging import StructuredLoggingMiddleware
from backend.api.auth_routes import router as auth_router
from backend.api.document_routes import router as document_router
from backend.api.chat_routes import router as chat_router
from backend.api.admin_routes import router as admin_router
from backend.api.health_routes import router as health_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("securerag-main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager: initialize database tables on startup."""
    logger.info("Initializing SecureRAG database tables...")
    init_db()
    logger.info("SecureRAG backend initialized successfully.")
    yield
    logger.info("SecureRAG backend shutting down.")


app = FastAPI(
    title="SecureRAG — Private Document Intelligence API",
    version="2.0.0",
    description="Production-grade private multi-document AI knowledge assistant with prompt injection defenses, JWT auth, and vector retrieval.",
    lifespan=lifespan,
)

# Structured request/response logging
app.add_middleware(StructuredLoggingMiddleware)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(document_router)
app.include_router(chat_router)
app.include_router(admin_router)


@app.get("/", tags=["Root"])
def root():
    return {
        "message": "SecureRAG API is operational.",
        "version": "2.0.0",
        "docs_url": "/docs",
        "health_url": "/api/health",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)