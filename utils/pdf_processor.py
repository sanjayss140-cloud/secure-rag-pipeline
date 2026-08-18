from langchain_community.document_loaders import PyPDFDirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

from config import PDF_DIR, CHUNK_SIZE, CHUNK_OVERLAP


def load_and_split_documents():
    loader = PyPDFDirectoryLoader(str(PDF_DIR))
    documents = loader.load()

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
    )

    return splitter.split_documents(documents)