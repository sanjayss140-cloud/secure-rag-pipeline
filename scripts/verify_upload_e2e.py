import sys
import os
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from fastapi.testclient import TestClient
from backend.main import app
from backend.database.session import init_db

def run_test():
    print("=== Step 1: Initializing Database ===")
    init_db()
    client = TestClient(app)

    pdf_path = ROOT_DIR / "data" / "pdfs" / "m1-L05-sanjay.pdf.pdf"
    if not pdf_path.exists():
        print(f"ERROR: PDF file not found at {pdf_path}")
        return False

    print(f"Found test PDF: {pdf_path} ({pdf_path.stat().st_size} bytes)")

    print("\n=== Step 2: Testing POST /api/documents/upload ===")
    with open(pdf_path, "rb") as f:
        response = client.post(
            "/api/documents/upload",
            files={"files": ("m1-L05-sanjay.pdf.pdf", f, "application/pdf")},
        )
    print(f"Status Code: {response.status_code}")
    data = response.json()
    print("Response JSON:", data)
    assert response.status_code == 201, f"Expected 201, got {response.status_code}"
    assert data["success"] is True
    assert len(data["uploaded"]) > 0
    doc_id = data["uploaded"][0]["document_id"]
    print(f"Uploaded Document ID: {doc_id}")

    print("\n=== Step 3: Testing GET /api/documents ===")
    list_resp = client.get("/api/documents")
    assert list_resp.status_code == 200
    list_data = list_resp.json()
    print(f"Found {len(list_data['documents'])} documents in knowledge base.")
    matching = [d for d in list_data["documents"] if d["document_id"] == doc_id]
    assert len(matching) > 0, "Uploaded document not in documents list!"
    print("Document details:", matching[0])

    print("\n=== Step 4: Testing POST /api/chat with uploaded document context ===")
    chat_resp = client.post(
        "/api/chat",
        json={"question": "What is this document about? Summarize it briefly."},
    )
    print(f"Status Code: {chat_resp.status_code}")
    chat_data = chat_resp.json()
    print("Chat Answer:", chat_data.get("answer"))
    print("Sources:", chat_data.get("sources"))
    print("Confidence:", chat_data.get("confidence"))
    print("Grounded:", chat_data.get("grounded"))
    assert chat_resp.status_code == 200

    print("\n=== Step 5: Testing DELETE /api/documents/{doc_id} ===")
    del_resp = client.delete(f"/api/documents/{doc_id}")
    print(f"Delete Status Code: {del_resp.status_code}")
    assert del_resp.status_code == 200
    print("Delete Response:", del_resp.json())

    # Verify document is gone
    list_resp2 = client.get("/api/documents")
    remaining = [d for d in list_resp2.json()["documents"] if d["document_id"] == doc_id]
    assert len(remaining) == 0, "Document was not removed from DB!"
    print("Document successfully removed from DB and FAISS index.")

    print("\n>>> ALL 5 END-TO-END UPLOAD AND RAG STEPS PASSED SUCCESSFULLY! <<<")
    return True

if __name__ == "__main__":
    success = run_test()
    if not success:
        sys.exit(1)
