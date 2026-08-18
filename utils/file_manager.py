from pathlib import Path

from config import PDF_DIR
from utils.security import validate_pdf


def save_uploaded_files(uploaded_files):
    pdf_dir = Path(PDF_DIR)
    pdf_dir.mkdir(parents=True, exist_ok=True)

    # Single-document mode:
    # remove previously uploaded PDFs.
    for old_pdf in pdf_dir.glob("*.pdf"):
        old_pdf.unlink()

    saved_files = []

    for uploaded_file in uploaded_files:
        safe_name = validate_pdf(uploaded_file)

        file_path = pdf_dir / safe_name

        with open(file_path, "wb") as f:
            f.write(uploaded_file.getbuffer())

        saved_files.append(file_path)

    return saved_files