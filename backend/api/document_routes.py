from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.database.models import User, Document as DBDocument
from backend.security.auth import get_current_user, get_current_user_optional
from backend.services.document_service import process_and_save_document, delete_document_by_id
from backend.middleware.rate_limiter import rate_limit_dependency

router = APIRouter(tags=["Documents"])


def _get_user_id(current_user: Optional[User]) -> str:
    """Helper returning current user ID or fallback default user for unauthenticated mode."""
    if current_user:
        return current_user.id
    return "anonymous_default_user"


@router.post(
    "/api/documents/upload",
    status_code=status.HTTP_201_CREATED,
    summary="Upload multiple PDF documents to private knowledge base",
    dependencies=[Depends(rate_limit_dependency(max_requests=60, window_seconds=60))],
)
@router.post(
    "/api/upload",
    status_code=status.HTTP_201_CREATED,
    summary="Upload PDF files (backward compatible endpoint)",
    dependencies=[Depends(rate_limit_dependency(max_requests=60, window_seconds=60))],
)
async def upload_documents(
    files: Optional[List[UploadFile]] = File(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Upload and index multiple PDF files in the private RAG knowledge base.
    Supports both multi-file ('files') and single-file ('file') form field keys.
    """
    upload_list = []
    if files:
        upload_list.extend(files)
    if file:
        upload_list.append(file)

    if not upload_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files were provided for upload.",
        )

    user_id = _get_user_id(current_user)
    uploaded_records = []
    failed_records = []
    total_chunks = 0

    for file_item in upload_list:
        if not file_item.filename:
            failed_records.append({"filename": "Unknown", "error": "Missing filename."})
            continue

        try:
            content = await file_item.read()
            if not content:
                failed_records.append({"filename": file_item.filename, "error": "Uploaded file is empty."})
                continue

            doc_rec = process_and_save_document(content, file_item.filename, user_id, db)
            total_chunks += doc_rec.chunk_count

            uploaded_records.append({
                "document_id": doc_rec.id,
                "filename": doc_rec.filename,
                "size_bytes": doc_rec.file_size_bytes,
                "size_mb": doc_rec.file_size_mb,
                "page_count": doc_rec.page_count,
                "chunk_count": doc_rec.chunk_count,
            })

        except Exception as exc:
            failed_records.append({"filename": file_item.filename, "error": str(exc)})

    if not uploaded_records:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "No documents could be uploaded.", "failed_files": failed_records},
        )

    # Return structure matching frontend expectation (with filename and size_mb at top level for first file)
    first_file = uploaded_records[0]
    return {
        "success": True,
        "filename": first_file["filename"],
        "size_mb": first_file["size_mb"],
        "chunks": total_chunks,
        "uploaded_count": len(uploaded_records),
        "failed_count": len(failed_records),
        "uploaded": uploaded_records,
        "failed": failed_records,
        "message": f"Successfully indexed {len(uploaded_records)} document(s) ({total_chunks} chunks).",
    }


@router.get("/api/documents", summary="List uploaded PDF documents")
def list_documents(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    List all uploaded documents in the user's private knowledge base.
    """
    user_id = _get_user_id(current_user)
    docs = (
        db.query(DBDocument)
        .filter(DBDocument.user_id == user_id)
        .order_by(DBDocument.upload_timestamp.desc())
        .all()
    )

    documents_data = []
    for d in docs:
        documents_data.append({
            "document_id": d.id,
            "filename": d.filename,
            "size_bytes": d.file_size_bytes,
            "size_mb": d.file_size_mb,
            "page_count": d.page_count,
            "chunk_count": d.chunk_count,
            "uploaded_at": d.upload_timestamp.isoformat() if d.upload_timestamp else None,
            "status": d.processing_status,
        })

    return {
        "success": True,
        "count": len(documents_data),
        "documents": documents_data,
    }


@router.get("/api/documents/{document_id}", summary="Get metadata of a specific document")
def get_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Retrieve document metadata by document ID.
    """
    user_id = _get_user_id(current_user)
    doc = (
        db.query(DBDocument)
        .filter(DBDocument.id == document_id, DBDocument.user_id == user_id)
        .first()
    )

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied.",
        )

    return {
        "success": True,
        "document": {
            "document_id": doc.id,
            "filename": doc.filename,
            "size_bytes": doc.file_size_bytes,
            "size_mb": doc.file_size_mb,
            "page_count": doc.page_count,
            "chunk_count": doc.chunk_count,
            "uploaded_at": doc.upload_timestamp.isoformat() if doc.upload_timestamp else None,
            "status": doc.processing_status,
        },
    }


@router.delete("/api/documents/{document_id}", summary="Delete document from knowledge base")
def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Delete a document from the private knowledge base and update FAISS index.
    """
    user_id = _get_user_id(current_user)
    success = delete_document_by_id(document_id, user_id, db)

    if not success:
        # Try matching by filename for backward compatibility
        doc_by_name = (
            db.query(DBDocument)
            .filter(DBDocument.filename == document_id, DBDocument.user_id == user_id)
            .first()
        )
        if doc_by_name:
            success = delete_document_by_id(doc_by_name.id, user_id, db)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied.",
        )

    return {
        "success": True,
        "message": "Document deleted successfully from knowledge base.",
    }
