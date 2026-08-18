from pathlib import Path

from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings

from config import EMBEDDING_MODEL, VECTOR_STORE_DIR


_embeddings = None
_vector_db = None


def get_embeddings():
    global _embeddings

    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(
            model_name=EMBEDDING_MODEL
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

        _vector_db = FAISS.load_local(
            str(VECTOR_STORE_DIR),
            get_embeddings(),
            allow_dangerous_deserialization=True,
        )

    return _vector_db


def reset_vector_db():
    global _vector_db
    _vector_db = None


def get_relevant_documents(question: str):
    vector_db = get_vector_db()

    # Retrieve more candidates first.
    docs_with_scores = vector_db.similarity_search_with_score(
        question,
        k=10,
    )

    if not docs_with_scores:
        return []

    # FAISS L2 distance:
    # lower score = more similar.
    docs_with_scores.sort(
        key=lambda item: item[1]
    )

    selected_docs = []

    for doc, score in docs_with_scores[:5]:
        selected_docs.append(doc)

    return selected_docs