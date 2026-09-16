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

import torch
torch.set_num_threads(1)
try:
    torch.set_grad_enabled(False)
except Exception:
    pass

from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings

from config import EMBEDDING_MODEL, VECTOR_STORE_DIR


_embeddings = None
_vector_db = None


def get_embeddings():
    global _embeddings

    if _embeddings is None:
        print("Loading embedding model in low-memory inference mode...")
        gc.collect()

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
        gc.collect()
        print("Embedding model loaded successfully.")

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


def get_relevant_documents(question: str, score_threshold: float = 1.35, k: int = 6):
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