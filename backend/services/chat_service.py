import json
import time
import logging
from typing import Dict, Any, List, Optional, AsyncGenerator
from sqlalchemy.orm import Session

from backend.database.models import Conversation, Message, UsageEvent
from backend.rag.agent import run_rag_agent, RAGResponseSchema
from backend.security.sanitizer import detect_prompt_injection

logger = logging.getLogger("securerag-chat-service")


def get_or_create_conversation(
    db: Session,
    user_id: str,
    conversation_id: Optional[str] = None,
    title: str = "New Chat",
) -> Conversation:
    """Retrieve existing conversation or create a new persistent conversation."""
    if conversation_id:
        conv = (
            db.query(Conversation)
            .filter(Conversation.id == conversation_id, Conversation.user_id == user_id)
            .first()
        )
        if conv:
            return conv

    conv = Conversation(
        user_id=user_id,
        title=title[:100],
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def list_user_conversations(db: Session, user_id: str) -> List[Dict[str, Any]]:
    """List all saved conversations for a specific user ordered by update time."""
    convs = (
        db.query(Conversation)
        .filter(Conversation.user_id == user_id)
        .order_by(Conversation.updated_at.desc())
        .all()
    )
    results = []
    for c in convs:
        message_count = db.query(Message).filter(Message.conversation_id == c.id).count()
        results.append({
            "id": c.id,
            "title": c.title,
            "message_count": message_count,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        })
    return results


def get_conversation_messages(db: Session, conversation_id: str, user_id: str) -> List[Dict[str, Any]]:
    """Fetch all messages for a specific conversation owned by user."""
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == user_id)
        .first()
    )
    if not conv:
        return []

    msgs = (
        db.query(Message)
        .filter(Message.conversation_id == conv.id)
        .order_by(Message.created_at.asc())
        .all()
    )

    results = []
    for m in msgs:
        sources = json.loads(m.sources_json) if m.sources_json else []
        results.append({
            "id": m.id,
            "sender": m.sender,
            "content": m.content,
            "sources": sources,
            "confidence": m.confidence,
            "grounded": m.grounded,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        })
    return results


def process_chat_message(
    db: Session,
    user_id: str,
    question: str,
    conversation_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Execute complete chat request, save messages to DB, record usage metrics.
    """
    start_time = time.time()
    conv = get_or_create_conversation(db, user_id, conversation_id, title=question[:40])

    # Save User Message to Database
    user_msg = Message(
        conversation_id=conv.id,
        sender="user",
        content=question,
    )
    db.add(user_msg)
    db.commit()

    # Load history for context
    history_records = (
        db.query(Message)
        .filter(Message.conversation_id == conv.id)
        .order_by(Message.created_at.asc())
        .all()
    )
    history = [{"role": m.sender, "content": m.content} for m in history_records[:-1]]

    # Run Agent Workflow
    agent_response: RAGResponseSchema = run_rag_agent(question, user_id, db, history=history)

    sources_dicts = [s.model_dump() for s in agent_response.sources]
    sources_json_str = json.dumps(sources_dicts)

    # Save Assistant Response to Database
    assistant_msg = Message(
        conversation_id=conv.id,
        sender="assistant",
        content=agent_response.answer,
        sources_json=sources_json_str,
        confidence=agent_response.confidence,
        grounded=agent_response.grounded,
    )
    db.add(assistant_msg)
    conv.title = question[:40]
    db.commit()

    latency_ms = round((time.time() - start_time) * 1000, 2)
    prompt_tokens = max(10, len(question.split()) * 2 + 150)
    completion_tokens = max(5, len(agent_response.answer.split()) * 2)
    total_tokens = prompt_tokens + completion_tokens
    estimated_cost = round(total_tokens * 0.0000005, 6)

    # Record Usage Event for Admin Observability
    usage_event = UsageEvent(
        user_id=user_id,
        endpoint="/api/chat",
        llm_provider="Groq",
        model_name="qwen/qwen3.8-27b",
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        estimated_cost=estimated_cost,
        latency_ms=latency_ms,
        status_code=200,
    )
    db.add(usage_event)
    db.commit()

    return {
        "success": True,
        "conversation_id": conv.id,
        "answer": agent_response.answer,
        "confidence": agent_response.confidence,
        "sources": sources_dicts,
        "grounded": agent_response.grounded,
        "latency_ms": latency_ms,
    }


async def stream_chat_response(
    db: Session,
    user_id: str,
    question: str,
    conversation_id: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """
    Server-Sent Events (SSE) generator for real-time response streaming.
    """
    # 1. Send status event: thinking / analyzing
    yield f"data: {json.dumps({'event': 'status', 'status': 'Analyzing question & searching knowledge base...'})}\n\n"

    # Execute RAG Agent
    result = process_chat_message(db, user_id, question, conversation_id)

    # 2. Yield token chunks of the answer to client
    full_answer = result["answer"]
    words = full_answer.split(" ")
    chunk_buffer = []

    for word in words:
        chunk_buffer.append(word)
        if len(chunk_buffer) >= 2:
            chunk_str = " ".join(chunk_buffer) + " "
            yield f"data: {json.dumps({'event': 'token', 'token': chunk_str})}\n\n"
            chunk_buffer = []

    if chunk_buffer:
        yield f"data: {json.dumps({'event': 'token', 'token': ' '.join(chunk_buffer)})}\n\n"

    # 3. Send final status event with sources and metadata
    yield f"data: {json.dumps({'event': 'done', 'conversation_id': result['conversation_id'], 'sources': result['sources'], 'confidence': result['confidence']})}\n\n"
