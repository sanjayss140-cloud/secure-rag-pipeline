from langchain_community.document_loaders import PyPDFDirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

from config import (
    PDF_DIR,
    VECTOR_STORE_DIR,
    CHUNK_SIZE,
    CHUNK_OVERLAP,
    EMBEDDING_MODEL,
)

print("Loading PDFs...")

loader = PyPDFDirectoryLoader(str(PDF_DIR))
documents = loader.load()

print(f"Loaded {len(documents)} document(s).")

splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP
)

chunks = splitter.split_documents(documents)

print(f"Created {len(chunks)} chunks.")

embeddings = HuggingFaceEmbeddings(
    model_name=EMBEDDING_MODEL
)

vector_db = FAISS.from_documents(chunks, embeddings)

vector_db.save_local(str(VECTOR_STORE_DIR))

print("✅ Vector database created successfully!")