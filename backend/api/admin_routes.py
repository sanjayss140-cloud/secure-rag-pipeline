from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.security.auth import require_admin
from backend.services.usage_service import get_admin_dashboard_metrics

router = APIRouter(prefix="/api/admin", tags=["Admin Dashboard"])


@router.get("/stats", summary="Get admin dashboard usage metrics and system statistics")
def admin_stats(
    db: Session = Depends(get_db),
    admin_user=Depends(require_admin),
):
    """
    Retrieve real aggregate usage metrics, token costs, user counts, and system performance stats.
    Protected endpoint: Requires ADMIN role.
    """
    metrics = get_admin_dashboard_metrics(db)
    return {"success": True, "metrics": metrics}
