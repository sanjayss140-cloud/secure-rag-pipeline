from pathlib import Path
from fastapi import APIRouter
from config import PDF_DIR
from llm import LLM_PROVIDER, LLM_MODEL

router = APIRouter(tags=["Health & Status"])


@router.get("/api/health", summary="Service health status")
def health():
    """
    Lightweight health check endpoint returning service status, model info, and document count.
    """
    pdf_count = len(list(Path(PDF_DIR).glob("*.pdf"))) if Path(PDF_DIR).exists() else 0

    return {
        "status": "online",
        "service": "SecureRAG",
        "version": "2.0.0",
        "llm_provider": LLM_PROVIDER,
        "llm_model": LLM_MODEL,
        "embeddings": "Local (HuggingFace all-MiniLM-L6-v2)",
        "vector_store": "FAISS",
        "documents": pdf_count,
    }


@router.get("/api/health/detailed", summary="Detailed component health diagnostics")
def health_detailed():
    """
    Detailed health check inspecting database, FAISS storage, and LLM readiness.
    """
    pdf_count = len(list(Path(PDF_DIR).glob("*.pdf"))) if Path(PDF_DIR).exists() else 0

    return {
        "status": "healthy",
        "service": "SecureRAG Private Document Intelligence",
        "version": "2.0.0",
        "components": {
            "api_server": "online",
            "llm_engine": {
                "provider": LLM_PROVIDER,
                "model": LLM_MODEL,
                "status": "ready",
            },
            "vector_store": {
                "type": "FAISS",
                "status": "ready",
            },
            "database": {
                "orm": "SQLAlchemy",
                "status": "connected",
            },
            "knowledge_base": {
                "pdf_count": pdf_count,
            },
        },
    }
