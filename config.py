from pathlib import Path


# ---------------------------
# Project Paths
# ---------------------------

BASE_DIR = Path(__file__).resolve().parent

PDF_DIR = BASE_DIR / "data" / "pdfs"

VECTOR_STORE_DIR = BASE_DIR / "vector_store"


# Make sure required directories exist
PDF_DIR.mkdir(parents=True, exist_ok=True)
VECTOR_STORE_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------
# Embedding Settings
# ---------------------------

EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


# ---------------------------
# Chunk Settings
# ---------------------------

CHUNK_SIZE = 500
CHUNK_OVERLAP = 100


# ---------------------------
# Retrieval Settings
# ---------------------------

TOP_K = 8