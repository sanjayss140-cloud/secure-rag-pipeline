import logging
from typing import Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.database.models import User, Document, Conversation, Message, UsageEvent

logger = logging.getLogger("securerag-usage-service")


def get_admin_dashboard_metrics(db: Session) -> Dict[str, Any]:
    """
    Compute aggregate usage analytics for the admin dashboard.
    """
    total_users = db.query(User).count()
    total_documents = db.query(Document).count()
    total_conversations = db.query(Conversation).count()
    total_questions = db.query(Message).filter(Message.sender == "user").count()

    token_stats = db.query(
        func.sum(UsageEvent.total_tokens).label("sum_tokens"),
        func.sum(UsageEvent.estimated_cost).label("sum_cost"),
        func.avg(UsageEvent.latency_ms).label("avg_latency"),
    ).first()

    sum_tokens = token_stats.sum_tokens if token_stats and token_stats.sum_tokens else 0
    sum_cost = round(token_stats.sum_cost if token_stats and token_stats.sum_cost else 0.0, 4)
    avg_latency = round(token_stats.avg_latency if token_stats and token_stats.avg_latency else 0.0, 2)

    failed_requests = db.query(UsageEvent).filter(UsageEvent.status_code >= 400).count()
    total_requests = db.query(UsageEvent).count()

    return {
        "total_users": total_users,
        "total_documents": total_documents,
        "total_conversations": total_conversations,
        "total_questions": total_questions,
        "total_tokens_used": sum_tokens,
        "total_estimated_cost_usd": sum_cost,
        "average_latency_ms": avg_latency,
        "failed_requests": failed_requests,
        "total_requests": total_requests,
        "system_status": "healthy",
    }
