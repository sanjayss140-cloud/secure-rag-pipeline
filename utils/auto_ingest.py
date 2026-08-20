import os
from pathlib import Path

import pytesseract


# Use the system Tesseract binary on Linux/Render.
# Keep Windows support when running locally.
if os.name == "nt":
    windows_tesseract = Path(
        r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    )
    if windows_tesseract.exists():
        pytesseract.pytesseract.tesseract_cmd = str(windows_tesseract)


def extract_text_with_ocr(image_path: str | Path) -> str:
    """Extract text from an image using Tesseract OCR."""
    return pytesseract.image_to_string(str(image_path))


def process_pdf_with_ocr(pdf_path: str | Path) -> str:
    """
    Process a PDF and extract OCR text from its pages.

    Uses PyMuPDF to render pages to images, then Tesseract for OCR.
    """
    import fitz

    pdf_path = Path(pdf_path)

    document = fitz.open(str(pdf_path))
    extracted_text = []

    try:
        for page_number, page in enumerate(document):
            pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2))

            image_path = pdf_path.with_name(
                f"{pdf_path.stem}_page_{page_number + 1}.png"
            )

            pixmap.save(str(image_path))

            try:
                text = extract_text_with_ocr(image_path)
                if text.strip():
                    extracted_text.append(text.strip())
            finally:
                image_path.unlink(missing_ok=True)
    finally:
        document.close()

    return "\n\n".join(extracted_text)