from pathlib import Path
import re


MAX_FILE_SIZE_MB = 10
ALLOWED_EXTENSION = ".pdf"


def validate_pdf(uploaded_file):
    """
    Validate an uploaded PDF before saving it.
    """

    if uploaded_file is None:
        raise ValueError("No file was uploaded.")

    filename = Path(uploaded_file.name).name

    if not filename.lower().endswith(ALLOWED_EXTENSION):
        raise ValueError("Only PDF files are allowed.")

    file_size_mb = uploaded_file.size / (1024 * 1024)

    if file_size_mb > MAX_FILE_SIZE_MB:
        raise ValueError(
            f"File is too large. Maximum size is "
            f"{MAX_FILE_SIZE_MB} MB."
        )

    return sanitize_filename(filename)


def sanitize_filename(filename):
    """
    Remove unsafe characters from filenames.
    """

    cleaned = re.sub(
        r"[^a-zA-Z0-9._ -]",
        "_",
        filename,
    )

    cleaned = cleaned.strip()

    if not cleaned:
        cleaned = "document.pdf"

    return cleaned