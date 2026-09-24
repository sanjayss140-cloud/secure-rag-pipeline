import pytest
import io
from PIL import Image
from backend.database.session import SessionLocal, init_db
from backend.rag.agent import run_rag_agent
from backend.rag.vision import analyze_image_bytes


@pytest.fixture(scope="module", autouse=True)
def init_database():
    init_db()


def test_vision_image_analyzer():
    """Verify memory-safe image analysis and OCR heuristic parsing."""
    # Generate simple test image
    img = Image.new("RGB", (200, 100), color=(157, 78, 221))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    img_bytes = buf.getvalue()

    result = analyze_image_bytes(img_bytes, "test_sample.png")
    assert result["filename"] == "test_sample.png"
    assert result["width"] == 200
    assert result["height"] == 100
    assert result["format"] == "PNG"
    assert "visual_summary" in result
    assert len(result["visual_summary"]) > 10


def test_hybrid_agent_greeting():
    """Verify greeting intent returns warm, helpful response."""
    db = SessionLocal()
    try:
        res = run_rag_agent("Hello! Who are you and what can you do?", "test_user_greeting", db)
        assert res.confidence == "high"
        assert "Mayandi AI" in res.answer
        assert len(res.answer) > 50
    finally:
        db.close()


def test_hybrid_agent_list_documents():
    """Verify listing documents intent handles empty knowledge base gracefully."""
    db = SessionLocal()
    try:
        res = run_rag_agent("What documents do I have uploaded?", "user_with_no_docs", db)
        assert res.confidence == "high"
        assert "no documents" in res.answer.lower() or "paperclip" in res.answer.lower()
    finally:
        db.close()
