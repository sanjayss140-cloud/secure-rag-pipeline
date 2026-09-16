import os
import uuid
import logging
from pathlib import Path
from typing import List, Dict, Any
import io
try:
    import fitz
except Exception:
    try:
        import pymupdf as fitz
    except Exception:
        fitz = None
from sqlalchemy.orm import Session

from langchain_core.documents import Document as LCDocument
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS

from config import PDF_DIR, VECTOR_STORE_DIR, CHUNK_SIZE, CHUNK_OVERLAP, MAX_FILE_SIZE_BYTES
from retriever import get_embeddings, reset_vector_db, get_vector_db
from backend.database.models import Document as DBDocument, DocumentChunkMetadata
from backend.security.sanitizer import sanitize_filename

logger = logging.getLogger("securerag-document-service")


def get_unique_stored_filename(original_filename: str) -> str:
    """Generate safe unique filename on disk."""
    safe_name = sanitize_filename(original_filename)
    path = Path(safe_name)
    stem, suffix = path.stem, path.suffix
    unique_id = uuid.uuid4().hex[:8]
    return f"{stem}_{unique_id}{suffix}"


from typing import List, Dict, Any, Tuple

def extract_pdf_chunks(
    pdf_bytes: bytes,
    document_id: str,
    user_id: str,
    filename: str,
) -> Tuple[List[LCDocument], int]:
    """Extract text from PDF pages using PyMuPDF or pypdf and split into chunks with metadata."""
    extracted_docs = []
    page_count = 0

    if fitz is not None:
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            page_count = len(doc)
            for page_num in range(page_count):
                page = doc[page_num]
                text = page.get_text("text").strip()
                if text:
                    extracted_docs.append(
                        LCDocument(
                            page_content=text,
                            metadata={
                                "user_id": user_id,
                                "document_id": document_id,
                                "filename": filename,
                                "page": page_num,
                            },
                        )
                    )
            doc.close()
        except Exception as e:
            logger.warning("fitz extraction failed (%s), trying pypdf fallback", str(e))
            extracted_docs = []

    if not extracted_docs:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(pdf_bytes))
        page_count = len(reader.pages)
        for page_num, page in enumerate(reader.pages):
            text = (page.extract_text() or "").strip()
            if text:
                extracted_docs.append(
                    LCDocument(
                        page_content=text,
                        metadata={
                            "user_id": user_id,
                            "document_id": document_id,
                            "filename": filename,
                            "page": page_num,
                        },
                    )
                )

    if not extracted_docs:
        raise ValueError("No readable text could be extracted from the PDF.")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
    )

    chunks = splitter.split_documents(extracted_docs)
    usable_chunks = [c for c in chunks if c.page_content.strip()]

    # Assign chunk_id in metadata
    for idx, chunk in enumerate(usable_chunks):
        chunk.metadata["chunk_id"] = f"{document_id}_{idx}"

    return usable_chunks, page_count


SUPPORTED_EXTENSIONS = {
    # Documents
    ".pdf", ".docx", ".txt", ".md", ".rtf",
    # Structured Data & Config
    ".csv", ".tsv", ".json", ".xml", ".yaml", ".yml", ".sql", ".log",
    # Code & Scripts
    ".py", ".js", ".jsx", ".ts", ".tsx", ".html", ".css", ".java", ".c", ".cpp", ".go", ".rs", ".sh",
    # Images (OCR Text Extraction)
    ".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff",
}


def extract_docx_chunks(
    docx_bytes: bytes,
    document_id: str,
    user_id: str,
    filename: str,
) -> Tuple[List[LCDocument], int]:
    """Extract paragraphs from Word (.docx) document and split into chunks."""
    import zipfile
    import xml.etree.ElementTree as ET

    try:
        with zipfile.ZipFile(io.BytesIO(docx_bytes)) as z:
            xml_content = z.read("word/document.xml")
            tree = ET.fromstring(xml_content)
            namespaces = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
            paragraphs = []
            for p in tree.findall(".//w:p", namespaces):
                texts = [node.text for node in p.findall(".//w:t", namespaces) if node.text]
                if texts:
                    paragraphs.append("".join(texts))
            full_text = "\n\n".join(paragraphs).strip()
    except Exception as e:
        raise ValueError(f"Failed to extract text from DOCX file: {e}")

    if not full_text:
        raise ValueError("No readable text found in DOCX file.")

    splitter = RecursiveCharacterTextSplitter(chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP)
    docs = [
        LCDocument(
            page_content=full_text,
            metadata={"user_id": user_id, "document_id": document_id, "filename": filename, "page": 0},
        )
    ]
    chunks = splitter.split_documents(docs)
    for idx, c in enumerate(chunks):
        c.metadata["chunk_id"] = f"{document_id}_{idx}"
    return chunks, 1


def extract_image_chunks(
    image_bytes: bytes,
    document_id: str,
    user_id: str,
    filename: str,
) -> Tuple[List[LCDocument], int]:
    """Extract visible text from image using Tesseract OCR and split into chunks."""
    try:
        from PIL import Image
        import pytesseract

        image = Image.open(io.BytesIO(image_bytes))
        ocr_text = pytesseract.image_to_string(image).strip()
    except Exception as e:
        logger.warning("OCR processing warning on image %s: %s", filename, str(e))
        ocr_text = ""

    if not ocr_text:
        ocr_text = f"Uploaded image: {filename}. (No distinct printed text detected via OCR)."

    splitter = RecursiveCharacterTextSplitter(chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP)
    docs = [
        LCDocument(
            page_content=ocr_text,
            metadata={"user_id": user_id, "document_id": document_id, "filename": filename, "page": 0},
        )
    ]
    chunks = splitter.split_documents(docs)
    for idx, c in enumerate(chunks):
        c.metadata["chunk_id"] = f"{document_id}_{idx}"
    return chunks, 1


def extract_plain_text_chunks(
    text_bytes: bytes,
    document_id: str,
    user_id: str,
    filename: str,
) -> Tuple[List[LCDocument], int]:
    """Decode text, code, markdown, csv, or data files and split into chunks."""
    text = ""
    for enc in ["utf-8", "latin-1", "utf-16", "cp1252"]:
        try:
            text = text_bytes.decode(enc).strip()
            break
        except Exception:
            continue

    if not text:
        text = text_bytes.decode("utf-8", errors="ignore").strip()

    if not text:
        raise ValueError("File is empty or contains no readable characters.")

    splitter = RecursiveCharacterTextSplitter(chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP)
    docs = [
        LCDocument(
            page_content=text,
            metadata={"user_id": user_id, "document_id": document_id, "filename": filename, "page": 0},
        )
    ]
    chunks = splitter.split_documents(docs)
    for idx, c in enumerate(chunks):
        c.metadata["chunk_id"] = f"{document_id}_{idx}"
    return chunks, 1


def process_and_save_document(
    file_bytes: bytes,
    original_filename: str,
    user_id: str,
    db: Session,
) -> DBDocument:
    """Process uploaded document (PDF, Word, Text, Code, Image), save to disk, record in DB, and update FAISS index."""
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise ValueError("File exceeds maximum allowed size (10 MB).")

    ext = Path(original_filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(
            f"Unsupported file type '{ext}'. Supported: PDF (.pdf), Word (.docx), Text/Markdown (.txt, .md), Code (.py, .js, .html), Data (.csv, .json), and Images (.png, .jpg, .webp)."
        )

    stored_name = get_unique_stored_filename(original_filename)
    document_id = str(uuid.uuid4())
    disk_path = PDF_DIR / stored_name

    # Save PDF file to storage directory
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    disk_path.write_bytes(file_bytes)

    size_bytes = len(file_bytes)
    size_mb = round(size_bytes / (1024 * 1024), 2)

    try:
        # Extract chunks and page count based on file type
        if ext == ".pdf":
            chunks, page_count = extract_pdf_chunks(file_bytes, document_id, user_id, original_filename)
        elif ext == ".docx":
            chunks, page_count = extract_docx_chunks(file_bytes, document_id, user_id, original_filename)
        elif ext in {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"}:
            chunks, page_count = extract_image_chunks(file_bytes, document_id, user_id, original_filename)
        else:
            chunks, page_count = extract_plain_text_chunks(file_bytes, document_id, user_id, original_filename)

        # Create Database Record
        db_doc = DBDocument(
            id=document_id,
            user_id=user_id,
            filename=original_filename,
            stored_filename=stored_name,
            file_size_bytes=size_bytes,
            file_size_mb=size_mb,
            page_count=page_count,
            chunk_count=len(chunks),
            processing_status="indexed",
        )
        db.add(db_doc)

        # Add chunk metadata records
        for idx, chunk in enumerate(chunks):
            db_chunk = DocumentChunkMetadata(
                document_id=document_id,
                chunk_index=idx,
                page_number=chunk.metadata.get("page", 0) + 1,
                content_snippet=chunk.page_content[:200],
            )
            db.add(db_chunk)

        db.commit()
        db.refresh(db_doc)

        # Update FAISS Index
        embeddings = get_embeddings()
        index_file = VECTOR_STORE_DIR / "index.faiss"

        if index_file.exists():
            try:
                vector_db = get_vector_db()
                vector_db.add_documents(chunks)
                vector_db.save_local(str(VECTOR_STORE_DIR))
            except Exception:
                vector_db = FAISS.from_documents(chunks, embeddings)
                vector_db.save_local(str(VECTOR_STORE_DIR))
        else:
            vector_db = FAISS.from_documents(chunks, embeddings)
            vector_db.save_local(str(VECTOR_STORE_DIR))

        reset_vector_db()
        return db_doc

    except Exception as exc:
        db.rollback()
        if disk_path.exists():
            disk_path.unlink()
        logger.error("Failed to process document %s: %s", original_filename, str(exc), exc_info=True)
        raise exc


def delete_document_by_id(document_id: str, user_id: str, db: Session) -> bool:
    """Delete a document owned by the user from database and disk."""
    doc = db.query(DBDocument).filter(DBDocument.id == document_id, DBDocument.user_id == user_id).first()
    if not doc:
        return False

    disk_path = PDF_DIR / doc.stored_filename
    if disk_path.exists():
        disk_path.unlink()

    db.delete(doc)
    db.commit()

    # Rebuild vector database with remaining documents if any exist
    rebuild_vector_store_from_db(db)
    return True


def rebuild_vector_store_from_db(db: Session):
    """Rebuild the FAISS index cleanly from all indexed PDFs in the database."""
    docs = db.query(DBDocument).filter(DBDocument.processing_status == "indexed").all()
    all_chunks = []

    for doc_rec in docs:
        disk_path = PDF_DIR / doc_rec.stored_filename
        if disk_path.exists():
            try:
                bytes_data = disk_path.read_bytes()
                chunks, _ = extract_pdf_chunks(bytes_data, doc_rec.id, doc_rec.user_id, doc_rec.filename)
                all_chunks.extend(chunks)
            except Exception as e:
                logger.warning("Could not read stored document %s: %s", doc_rec.filename, str(e))

    embeddings = get_embeddings()
    if all_chunks:
        vector_db = FAISS.from_documents(all_chunks, embeddings)
        vector_db.save_local(str(VECTOR_STORE_DIR))
    else:
        # Clear vector store directory files if empty
        for f in VECTOR_STORE_DIR.glob("*"):
            if f.is_file():
                f.unlink()

    reset_vector_db()
