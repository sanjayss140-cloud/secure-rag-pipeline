from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.database.models import User, Conversation
from backend.security.auth import get_current_user, get_current_user_optional
from backend.services.chat_service import (
    process_chat_message,
    stream_chat_response,
    list_user_conversations,
    get_conversation_messages,
)
from backend.middleware.rate_limiter import rate_limit_dependency

router = APIRouter(tags=["Chat & RAG"])


class ChatRequest(BaseModel):
    question: str
    conversation_id: Optional[str] = None
    history: Optional[List[dict]] = None


def _get_user_id(current_user: Optional[User]) -> str:
    if current_user:
        return current_user.id
    return "anonymous_default_user"


@router.post(
    "/api/chat",
    summary="Submit question to RAG knowledge assistant",
    dependencies=[Depends(rate_limit_dependency(max_requests=20, window_seconds=60))],
)
def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Process RAG question, retrieve context, enforce prompt injection safety, and return answer with citations.
    """
    question = request.question.strip()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question cannot be empty.",
        )

    user_id = _get_user_id(current_user)
    result = process_chat_message(db, user_id, question, request.conversation_id)

    return {
        "success": True,
        "conversation_id": result["conversation_id"],
        "answer": result["answer"],
        "confidence": result["confidence"],
        "sources": result["sources"],
        "grounded": result["grounded"],
        "latency_ms": result["latency_ms"],
    }


@router.get(
    "/api/chat/stream",
    summary="Stream RAG answer using Server-Sent Events (SSE)",
    dependencies=[Depends(rate_limit_dependency(max_requests=20, window_seconds=60))],
)
async def chat_stream(
    question: str = Query(..., description="User question"),
    conversation_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Stream RAG answer tokens and status events via SSE.
    """
    if not question.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question cannot be empty.",
        )

    user_id = _get_user_id(current_user)
    return StreamingResponse(
        stream_chat_response(db, user_id, question.strip(), conversation_id),
        media_type="text/event-stream",
    )


@router.get("/api/conversations", summary="List chat conversations history")
def list_conversations(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Retrieve list of saved chat conversations for user.
    """
    user_id = _get_user_id(current_user)
    conversations = list_user_conversations(db, user_id)
    return {"success": True, "conversations": conversations}


@router.get("/api/conversations/{conversation_id}", summary="Get messages in conversation")
def get_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Retrieve message history for a specific conversation.
    """
    user_id = _get_user_id(current_user)
    messages = get_conversation_messages(db, conversation_id, user_id)
    return {"success": True, "conversation_id": conversation_id, "messages": messages}


@router.delete("/api/conversations/{conversation_id}", summary="Delete conversation")
def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Delete a conversation and its messages.
    """
    user_id = _get_user_id(current_user)
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == user_id)
        .first()
    )
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or access denied.",
        )

    db.delete(conv)
    db.commit()
    return {"success": True, "message": "Conversation deleted successfully."}
