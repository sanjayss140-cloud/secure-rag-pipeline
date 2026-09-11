from typing import Any
import logging

from langchain_core.documents import Document

from llm import llm
from retriever import get_relevant_documents


# =========================================================
# LOGGING
# =========================================================

logger = logging.getLogger(
    "secure-rag-chain"
)


# =========================================================
# FALLBACK
# =========================================================

FALLBACK_RESPONSE = (
    "I couldn't find enough information "
    "in the uploaded documents."
)


# =========================================================
# CLEAN RESPONSE
# =========================================================

def _clean_llm_response(
    content: Any,
) -> str:

    if content is None:
        return ""

    answer = str(content).strip()

    # Remove complete reasoning block
    if (
        "<think>" in answer
        and "</think>" in answer
    ):
        answer = answer.split(
            "</think>",
            1,
        )[1].strip()

    # If only an unfinished think block exists,
    # remove the tag but keep anything after it.
    elif "<think>" in answer:

        parts = answer.split(
            "<think>",
            1,
        )

        answer = (
            parts[1].strip()
            if len(parts) > 1
            else ""
        )

    return answer.strip()


# =========================================================
# FORMAT CONTEXT
# =========================================================

def _format_context(
    docs: list[Document],
) -> str:

    if not docs:
        return ""

    context_parts = []

    for index, doc in enumerate(
        docs,
        start=1,
    ):

        metadata = doc.metadata or {}

        source = metadata.get(
            "source",
            "Unknown source",
        )

        page = metadata.get(
            "page",
            metadata.get(
                "page_number",
                "Unknown",
            ),
        )

        context_parts.append(
            f"""
--- DOCUMENT CHUNK {index} ---

Source: {source}
Page: {page}

Content:
{doc.page_content}
""".strip()
        )

    return "\n\n".join(
        context_parts
    )


# =========================================================
# ASK QUESTION
# =========================================================

def ask_question(
    question: str,
    history: list[dict[str, str]] | None = None,
):

    logger.info(
        "STARTING RAG QUESTION"
    )

    logger.info(
        "QUESTION: %s",
        question,
    )

    history = history or []


    # -----------------------------------------------------
    # RETRIEVE DOCUMENTS
    # -----------------------------------------------------

    docs = get_relevant_documents(
        question
    )

    logger.info(
        "DOCUMENTS RETRIEVED: %s",
        len(docs),
    )

    if not docs:

        logger.warning(
            "NO RELEVANT DOCUMENTS FOUND"
        )

        return (
            FALLBACK_RESPONSE,
            [],
        )


    # -----------------------------------------------------
    # BUILD CONTEXT
    # -----------------------------------------------------

    context = _format_context(
        docs
    )


    # -----------------------------------------------------
    # HISTORY
    # -----------------------------------------------------

    history_text = ""

    if history:

        history_lines = []

        for message in history:

            role = message.get(
                "role",
                "user",
            )

            content = message.get(
                "content",
                "",
            )

            if content:

                history_lines.append(
                    f"{role.upper()}: "
                    f"{content}"
                )

        history_text = "\n".join(
            history_lines
        )


    # -----------------------------------------------------
    # PROMPT
    # -----------------------------------------------------

    prompt = f"""
You are a document question-answering assistant.

Your job is to answer the user's question using the uploaded document context.

IMPORTANT RULES:

1. Use the document context as your primary source.
2. Answer clearly and directly.
3. For summary questions, summarize the relevant document content.
4. For questions such as "What is the main topic?", identify the overall subject of the retrieved document content.
5. Do not invent facts that are not supported by the document.
6. If the answer truly cannot be found, say exactly:
"I couldn't find enough information in the uploaded documents."
7. Do not expose chain-of-thought.
8. Do not output <think> tags.
9. Give the final answer only.

CONVERSATION HISTORY:
{history_text}

DOCUMENT CONTEXT:
{context}

USER QUESTION:
{question}

FINAL ANSWER:
"""


    # -----------------------------------------------------
    # CALL LLM
    # -----------------------------------------------------

    logger.info(
        "CALLING LLM"
    )

    response = llm.invoke(
        prompt
    )

    logger.info(
        "LLM RESPONSE RECEIVED"
    )


    # -----------------------------------------------------
    # EXTRACT ANSWER
    # -----------------------------------------------------

    response_content = getattr(
        response,
        "content",
        response,
    )

    answer = _clean_llm_response(
        response_content
    )


    logger.info(
        "ANSWER LENGTH: %s",
        len(answer),
    )

    if not answer:

        logger.warning(
            "LLM RETURNED EMPTY RESPONSE"
        )

        answer = FALLBACK_RESPONSE


    return answer, docs