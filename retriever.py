import os
import gc
from pathlib import Path

# Restrict thread pools to single-threaded CPU mode to conserve RAM within 512MB
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

# Try FastEmbed first (ultra lightweight, ONNX Runtime INT8, ~35MB RAM vs 500MB PyTorch)
HAS_FASTEMBED = False
try:
    from langchain_community.embeddings.fastembed import FastEmbedEmbeddings
    HAS_FASTEMBED = True
except Exception:
    HAS_FASTEMBED = False

# Graceful fallback to PyTorch / HuggingFace if installed
HAS_HF = False
try:
    import torch
    torch.set_num_threads(1)
    try:
        torch.set_grad_enabled(False)
    except Exception:
        pass
    from langchain_huggingface import HuggingFaceEmbeddings
    HAS_HF = True
except Exception:
    HAS_HF = False

from langchain_community.vectorstores import FAISS

from config import EMBEDDING_MODEL, VECTOR_STORE_DIR


_embeddings = None
_vector_db = None


def get_embeddings():
    global _embeddings

    if _embeddings is None:
        gc.collect()

        if HAS_FASTEMBED:
            print("Loading FastEmbed ONNX embeddings (ultra-low memory ~35MB)...")
            try:
                _embeddings = FastEmbedEmbeddings(
                    model_name="sentence-transformers/all-MiniLM-L6-v2"
                )
                print("FastEmbed ONNX embedding model loaded successfully.")
                return _embeddings
            except Exception as e:
                print(f"FastEmbed init failed ({e}), attempting fallback...")

        if HAS_HF:
            print("Loading HuggingFaceEmbeddings via PyTorch...")
            _embeddings = HuggingFaceEmbeddings(
                model_name=EMBEDDING_MODEL,
                model_kwargs={
                    "device": "cpu",
                },
                encode_kwargs={
                    "normalize_embeddings": True,
                    "batch_size": 8,
                },
            )
            print("HuggingFace embedding model loaded successfully.")
            return _embeddings

        raise RuntimeError(
            "No embedding provider available. Please install fastembed or langchain-huggingface."
        )

    return _embeddings


def get_vector_db():
    global _vector_db

    if _vector_db is None:
        index_file = Path(VECTOR_STORE_DIR) / "index.faiss"
        store_file = Path(VECTOR_STORE_DIR) / "index.pkl"

        if not index_file.exists() or not store_file.exists():
            raise RuntimeError(
                "FAISS vector database does not exist. "
                "Upload a PDF and rebuild the knowledge base."
            )

        print("Loading FAISS vector database...")

        _vector_db = FAISS.load_local(
            str(VECTOR_STORE_DIR),
            get_embeddings(),
            allow_dangerous_deserialization=True,
        )

        print("FAISS vector database loaded successfully.")

    return _vector_db


def reset_vector_db():
    global _vector_db
    _vector_db = None
    import gc
    gc.collect()


def reset_embeddings():
    global _embeddings, _vector_db
    _vector_db = None
    _embeddings = None
    import gc
    gc.collect()


def _db_fallback_search(question: str, k: int = 6):
    """
    Resilient in-memory keyword-overlap fallback search when FAISS C++ binary is unavailable.
    """
    try:
        from langchain_core.documents import Document as LCDoc
        from backend.database.session import SessionLocal
        from backend.database.models import Document as DBDoc, DocumentChunkMetadata

        db = SessionLocal()
        try:
            chunks = (
                db.query(DocumentChunkMetadata, DBDoc)
                .join(DBDoc, DocumentChunkMetadata.document_id == DBDoc.id)
                .all()
            )
            if not chunks:
                return []

            q_words = set(w.lower() for w in question.split() if len(w) > 2)
            scored = []
            for chunk_meta, doc_rec in chunks:
                text = chunk_meta.content_snippet or ""
                t_words = set(text.lower().split())
                score = len(q_words.intersection(t_words))
                scored.append((score, chunk_meta, doc_rec))

            scored.sort(key=lambda x: x[0], reverse=True)
            top_chunks = [item for item in scored[:k] if item[0] > 0 or len(scored) <= 4]

            results = []
            for _, cm, dr in top_chunks:
                results.append(
                    LCDoc(
                        page_content=cm.content_snippet or "",
                        metadata={
                            "document_id": dr.id,
                            "filename": dr.filename,
                            "page": cm.page_number or 1,
                            "user_id": dr.user_id,
                        },
                    )
                )
            return results
        finally:
            db.close()
    except Exception as exc:
        print(f"Fallback search warning: {exc}")
        return []


def get_relevant_documents(question: str, score_threshold: float = 1.35, k: int = 6):
    try:
        vector_db = get_vector_db()

        docs_with_scores = vector_db.similarity_search_with_score(
            question,
            k=k,
        )

        if not docs_with_scores:
            return []

        docs_with_scores.sort(
            key=lambda item: item[1]
        )

        # Filter out chunks exceeding distance threshold (irrelevant matches)
        filtered = [
            doc
            for doc, score in docs_with_scores
            if score <= score_threshold
        ]

        # If all were filtered out by strict threshold, keep top matches so user always gets an answer
        if not filtered and docs_with_scores:
            filtered = [doc for doc, _ in docs_with_scores[:4]]

        return filtered
    except Exception as e:
        print(f"Vector search falling back to database chunk matcher: {e}")
        return _db_fallback_search(question, k=k)