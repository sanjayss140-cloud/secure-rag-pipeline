import time
import logging
from pathlib import Path
from config import PDF_DIR

logger = logging.getLogger("securerag-scheduled-tasks")


def run_daily_cleanup_job():
    """
    Scheduled job: Cleans orphaned temporary upload files older than 24 hours
    and logs periodic maintenance events.
    """
    logger.info("Executing scheduled maintenance cleanup job...")
    now = time.time()
    cleaned_files_count = 0

    if PDF_DIR.exists():
        for item in PDF_DIR.glob("*.tmp"):
            if now - item.stat().st_mtime > 86400:
                try:
                    item.unlink()
                    cleaned_files_count += 1
                except Exception as e:
                    logger.warning("Could not delete temp file %s: %s", item, str(e))

    logger.info("Scheduled maintenance complete. Cleaned %d temporary files.", cleaned_files_count)
    return cleaned_files_count
