from pathlib import Path
from dotenv import load_dotenv


# =========================================================
# ENVIRONMENT
# =========================================================

BASE_DIR = Path(__file__).resolve().parent

# Load .env BEFORE any module reads environment variables.
load_dotenv(BASE_DIR / ".env")


# =========================================================
# PROJECT PATHS
# =========================================================

PDF_DIR = BASE_DIR / "data" / "pdfs"
VECTOR_STORE_DIR = BASE_DIR / "vector_store"


PDF_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

VECTOR_STORE_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


# =========================================================
# UPLOAD SETTINGS
# =========================================================

MAX_FILE_SIZE_MB = 10
MAX_FILE_SIZE_BYTES = (
    MAX_FILE_SIZE_MB
    * 1024
    * 1024
)


# =========================================================
# EMBEDDING SETTINGS
# =========================================================

EMBEDDING_MODEL = (
    "sentence-transformers/"
    "all-MiniLM-L6-v2"
)


# =========================================================
# CHUNK SETTINGS
# =========================================================

CHUNK_SIZE = 500

CHUNK_OVERLAP = 100


# =========================================================
# RETRIEVAL SETTINGS
# =========================================================

TOP_K = 8