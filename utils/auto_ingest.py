from pathlib import Path

import fitz
import os
import pytesseract

from PIL import Image, ImageEnhance, ImageFilter, ImageOps

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

from config import (
    PDF_DIR,
    VECTOR_STORE_DIR,
    EMBEDDING_MODEL,
    CHUNK_SIZE,
    CHUNK_OVERLAP,
)


TESSERACT_PATH = r"C:\Program Files\Tesseract-OCR\tesseract.exe" if os.name == "nt" else "tesseract"
pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH


def preprocess_image(image):
    """
    Improve scanned PDF images before OCR.
    """
    image = ImageOps.grayscale(image)

    image = ImageEnhance.Contrast(image).enhance(1.6)

    image = ImageEnhance.Sharpness(image).enhance(1.4)

    image = image.filter(ImageFilter.SHARPEN)

    return image


def extract_documents_with_ocr():
    pdf_files = list(Path(PDF_DIR).glob("*.pdf"))

    if not pdf_files:
        raise ValueError("No PDF files were found.")

    documents = []

    for pdf_path in pdf_files:

        pdf = fitz.open(pdf_path)

        for page_number, page in enumerate(pdf):

            # First try normal PDF text extraction.
            text = page.get_text("text").strip()

            if text:

                documents.append(
                    Document(
                        page_content=text,
                        metadata={
                            "source": str(pdf_path),
                            "page": page_number,
                            "method": "text",
                        },
                    )
                )

                continue

            # OCR fallback.
            pix = page.get_pixmap(
                matrix=fitz.Matrix(3, 3),
                alpha=False,
            )

            image = Image.frombytes(
                "RGB",
                [pix.width, pix.height],
                pix.samples,
            )

            image = preprocess_image(image)

            ocr_text = pytesseract.image_to_string(
                image,
                config="--psm 6",
            ).strip()

            if ocr_text:

                documents.append(
                    Document(
                        page_content=ocr_text,
                        metadata={
                            "source": str(pdf_path),
                            "page": page_number,
                            "method": "ocr",
                        },
                    )
                )

        pdf.close()

    return documents


def rebuild_vector_database():

    documents = extract_documents_with_ocr()

    if not documents:
        raise ValueError(
            "No readable text could be extracted from the PDF."
        )

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
    )

    chunks = splitter.split_documents(documents)

    chunks = [
        chunk
        for chunk in chunks
        if chunk.page_content.strip()
    ]

    if not chunks:
        raise ValueError(
            "No usable text was found after OCR/text extraction."
        )

    embeddings = HuggingFaceEmbeddings(
        model_name=EMBEDDING_MODEL
    )

    vector_db = FAISS.from_documents(
        chunks,
        embeddings,
    )

    vector_db.save_local(
        str(VECTOR_STORE_DIR)
    )

    return len(chunks)
