import os
import logging
import asyncio
import urllib.request
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

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


async def _self_keep_alive_worker():
    """
    Continuous heartbeat loop: Sends an outbound HTTP request to the public URL
    every 7 minutes so Render's 15-minute inactivity timer never triggers sleep.
    """
    # Wait 45 seconds after container startup for uvicorn to settle
    await asyncio.sleep(45)
    logger.info("Starting automated self-keep-alive heartbeat...")

    while True:
        try:
            public_url = os.environ.get("RENDER_EXTERNAL_URL", "https://mayandi.onrender.com")
            ping_url = f"{public_url.rstrip('/')}/ping"
            req = urllib.request.Request(
                ping_url,
                headers={"User-Agent": "Mayandi-Internal-Heartbeat/2.0"},
            )
            # Execute in thread to avoid blocking asyncio event loop
            await asyncio.to_thread(urllib.request.urlopen, req, timeout=20)
            logger.info("Self-keep-alive heartbeat successfully pinged %s", ping_url)
        except Exception as exc:
            logger.debug("Keep-alive heartbeat attempt: %s", str(exc))

        # 7 minutes = 420 seconds (well before Render's 15-minute 900s timeout)
        await asyncio.sleep(420)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager: initialize database tables on startup and start keep-alive heartbeat."""
    logger.info("Initializing SecureRAG database tables...")
    init_db()
    logger.info("SecureRAG backend initialized successfully.")

    # Start the continuous keep-alive task in background
    keep_alive_task = asyncio.create_task(_self_keep_alive_worker())

    yield

    keep_alive_task.cancel()
    logger.info("SecureRAG backend shutting down.")


app = FastAPI(
    title="SecureRAG — Private Document Intelligence API",
    version="2.0.0",
    description="Production-grade private multi-document AI knowledge assistant with prompt injection defenses, JWT auth, and vector retrieval.",
    lifespan=lifespan,
)


@app.get("/ping")
def ping():
    """Ultra-fast, zero-overhead endpoint for keep-alive pings."""
    return {"status": "ok", "service": "mayandi-ai"}

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
        "https://secure-rag-pipeline.vercel.app",
        "https://sanjayss140-cloud.github.io",
    ],
    allow_origin_regex=r"^https:\/\/.*(\.github\.io|\.vercel\.app|\.onrender\.com)$",
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


frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist")

if os.path.isdir(frontend_dist):
    logger.info("Mounting frontend SPA from %s", frontend_dist)
    assets_path = os.path.join(frontend_dist, "assets")
    if os.path.isdir(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path in ("docs", "redoc", "openapi.json"):
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Not Found")
        file_path = os.path.join(frontend_dist, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
else:
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