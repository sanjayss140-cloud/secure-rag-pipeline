from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import PDF_DIR
from retriever import reset_vector_db
from utils.auto_ingest import rebuild_vector_database
from utils.rag_chain import ask_question
from utils.security import validate_pdf


# =========================================================
# FASTAPI APP
# =========================================================

app = FastAPI(
    title="Secure RAG API",
    version="1.0.0",
    description="Private document RAG backend",
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# REQUEST MODELS
# =========================================================

class ChatRequest(BaseModel):
    question: str
    history: list[dict] = []


# =========================================================
# ROOT
# =========================================================

@app.get("/")
def root():
    return {
        "message": "Secure RAG API is running."
    }


# =========================================================
# HEALTH
# =========================================================

@app.get("/api/health")
def health():
    return {
        "status": "online",
        "service": "Secure RAG",
        "llm": "Qwen 2.5 3B",
        "vector_store": "FAISS",
    }


# =========================================================
# PDF UPLOAD
# =========================================================

@app.post("/api/upload")
async def upload_document(
    file: UploadFile = File(...),
):
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file was provided.",
        )

    # -----------------------------------------------------
    # Read upload
    # -----------------------------------------------------

    content = await file.read()

    if not content:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty.",
        )

    # -----------------------------------------------------
    # Validate PDF + size + filename
    # -----------------------------------------------------

    class UploadedFileAdapter:
        def __init__(self, name, size, data):
            self.name = name
            self.size = size
            self._data = data

        def getbuffer(self):
            return self._data

    upload_adapter = UploadedFileAdapter(
        file.filename,
        len(content),
        content,
    )

    try:
        safe_filename = validate_pdf(
            upload_adapter
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    # -----------------------------------------------------
    # Ensure PDF directory exists
    # -----------------------------------------------------

    pdf_dir = Path(PDF_DIR)

    pdf_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    # -----------------------------------------------------
    # Single-document mode
    # Remove old PDFs
    # -----------------------------------------------------

    for old_pdf in pdf_dir.glob("*.pdf"):
        try:
            old_pdf.unlink()
        except OSError as exc:
            raise HTTPException(
                status_code=500,
                detail=(
                    f"Could not remove old document: "
                    f"{old_pdf.name}"
                ),
            ) from exc

    # -----------------------------------------------------
    # Save new PDF
    # -----------------------------------------------------

    output_path = pdf_dir / safe_filename

    try:
        output_path.write_bytes(content)
    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail="Could not save the uploaded PDF.",
        ) from exc

    # -----------------------------------------------------
    # OCR/text extraction + chunking + FAISS
    # -----------------------------------------------------

    try:
        total_chunks = rebuild_vector_database()

        # Force retriever to load the fresh FAISS index.
        reset_vector_db()

    except Exception as exc:

        # Remove failed document.
        try:
            if output_path.exists():
                output_path.unlink()
        except OSError:
            pass

        raise HTTPException(
            status_code=500,
            detail=f"Document processing failed: {exc}",
        ) from exc

    # -----------------------------------------------------
    # Return metadata to React
    # -----------------------------------------------------

    return {
        "success": True,
        "filename": safe_filename,
        "size_bytes": len(content),
        "size_mb": round(
            len(content) / (1024 * 1024),
            2,
        ),
        "chunks": total_chunks,
        "message": "Document uploaded and indexed successfully.",
    }


# =========================================================
# CHAT
# =========================================================

@app.post("/api/chat")
def chat(request: ChatRequest):

    question = request.question.strip()

    if not question:
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty.",
        )

    try:

        answer, docs = ask_question(
            question,
            request.history,
        )

        sources = []

        for doc in docs:

            source = doc.metadata.get(
                "source",
                "Unknown document",
            )

            page = doc.metadata.get(
                "page",
            )

            item = {
                "file": Path(source).name,
                "page": (
                    page + 1
                    if page is not None
                    else None
                ),
            }

            if item not in sources:
                sources.append(item)

        return {
            "success": True,
            "answer": answer,
            "sources": sources,
        }

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        ) from exc
