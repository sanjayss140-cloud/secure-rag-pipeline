import re
from pathlib import Path
from typing import Tuple

# Common prompt injection pattern signatures
PROMPT_INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|rules)",
    r"disregard\s+(all\s+)?(previous|prior|above)\s+(instructions|rules)",
    r"bypass\s+(system|safety|security)\s+(filter|prompt|rules)",
    r"reveal\s+(the\s+)?(system\s+prompt|secret|api\s+key|password|admin)",
    r"you\s+are\s+now\s+a\s+DAN",
    r"do\s+anything\s+now",
    r"forget\s+(everything|all\s+rules|previous\s+instructions)",
    r"system\s*:\s*you\s+are",
    r"system\s+override",
    r"print\s+(internal|secret|system|admin)\s+(passwords|keys|tokens)",
    r"\[system\s*prompt\]",
]

COMPILED_INJECTION_REGEX = [
    re.compile(pattern, re.IGNORECASE) for pattern in PROMPT_INJECTION_PATTERNS
]


def sanitize_filename(filename: str) -> str:
    """
    Sanitize uploaded filenames to prevent path traversal and unsafe characters.
    """
    safe_name = Path(filename).name
    cleaned = re.sub(r"[^a-zA-Z0-9._ -]", "_", safe_name).strip()
    if not cleaned or cleaned.startswith("."):
        cleaned = "document.pdf"
    return cleaned


def detect_prompt_injection(user_input: str) -> Tuple[bool, str]:
    """
    Check string input for known prompt injection attack vectors.
    Returns (is_suspicious, reason).
    """
    if not user_input or not isinstance(user_input, str):
        return False, ""

    clean_text = user_input.strip()

    for regex in COMPILED_INJECTION_REGEX:
        if regex.search(clean_text):
            return True, "Potential prompt injection or system instruction override attempt detected."

    return False, ""


def sanitize_text_input(text: str) -> str:
    """
    Strip control characters and excess whitespace from string input.
    """
    if not text:
        return ""
    # Strip null bytes and non-printable control characters except newline and tab
    cleaned = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", text)
    return cleaned.strip()
