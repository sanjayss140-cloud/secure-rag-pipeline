import os
import logging

# IMPORTANT:
# Import config first.
# config.py loads the .env file.
import config


# =========================================================
# LOGGING
# =========================================================

logging.basicConfig(
    level=logging.INFO,
)

logger = logging.getLogger(
    "secure-rag-llm"
)


# =========================================================
# CONFIGURATION
# =========================================================

GROQ_API_KEY = os.getenv(
    "GROQ_API_KEY"
)


# =========================================================
# GROQ
# =========================================================

if GROQ_API_KEY:

    LLM_PROVIDER = "Groq"

    # Keep this as your currently configured model.
    LLM_MODEL = "qwen/qwen3.8-27b"


    logger.info(
        "LLM PROVIDER: %s",
        LLM_PROVIDER,
    )

    logger.info(
        "LLM MODEL: %s",
        LLM_MODEL,
    )


    from langchain_openai import ChatOpenAI


    llm = ChatOpenAI(
        model=LLM_MODEL,

        temperature=0,

        api_key=GROQ_API_KEY,

        base_url=(
            "https://api.groq.com/openai/v1/"
        ),

        timeout=60,

        max_retries=2,
    )


# =========================================================
# OLLAMA FALLBACK
# =========================================================

else:

    LLM_PROVIDER = "Ollama"

    LLM_MODEL = "qwen2.5:3b"


    logger.warning(
        "GROQ_API_KEY was not found."
    )

    logger.info(
        "LLM PROVIDER: %s",
        LLM_PROVIDER,
    )

    logger.info(
        "LLM MODEL: %s",
        LLM_MODEL,
    )


    from langchain_ollama import ChatOllama


    llm = ChatOllama(
        model=LLM_MODEL,

        temperature=0,
    )