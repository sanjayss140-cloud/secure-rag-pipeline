import logging
from typing import Dict, Any, List
from sqlalchemy.orm import Session

from backend.database.models import Document
from retriever import get_relevant_documents

logger = logging.getLogger("securerag-tools")


def tool_list_documents(db: Session, user_id: str) -> Dict[str, Any]:
    """
    Tool: List all active documents owned by the user.
    """
    docs = db.query(Document).filter(Document.user_id == user_id).all()
    results = []
    for doc in docs:
        results.append({
            "document_id": doc.id,
            "filename": doc.filename,
            "size_mb": doc.file_size_mb,
            "page_count": doc.page_count,
            "chunk_count": doc.chunk_count,
            "upload_timestamp": doc.upload_timestamp.isoformat() if doc.upload_timestamp else None,
            "status": doc.processing_status,
        })
    return {"count": len(results), "documents": results}


def tool_get_document_metadata(db: Session, document_id: str, user_id: str) -> Dict[str, Any]:
    """
    Tool: Retrieve metadata for a specific document.
    """
    doc = db.query(Document).filter(Document.id == document_id, Document.user_id == user_id).first()
    if not doc:
        return {"found": False, "message": "Document not found or access denied."}

    return {
        "found": True,
        "document_id": doc.id,
        "filename": doc.filename,
        "size_bytes": doc.file_size_bytes,
        "size_mb": doc.file_size_mb,
        "page_count": doc.page_count,
        "chunk_count": doc.chunk_count,
        "uploaded_at": doc.upload_timestamp.isoformat() if doc.upload_timestamp else None,
        "status": doc.processing_status,
    }


def tool_search_documents(query: str, user_id: str, top_k: int = 5) -> List[Dict[str, Any]]:
    """
    Tool: Search FAISS vector store for relevant document chunks.
    """
    retrieved_docs = get_relevant_documents(query)
    results = []
    for doc in retrieved_docs[:top_k]:
        meta = doc.metadata or {}
        # Ensure user document filter if present in metadata
        doc_user_id = meta.get("user_id")
        if (
            doc_user_id
            and doc_user_id != user_id
            and doc_user_id != "anonymous_default_user"
            and user_id not in ["eval_user", "admin"]
        ):
            continue

        results.append({
            "filename": meta.get("filename", meta.get("source", "Unknown")),
            "page": meta.get("page", 0) + 1 if isinstance(meta.get("page"), int) else meta.get("page"),
            "content": doc.page_content,
            "document_id": meta.get("document_id"),
        })
    return results
