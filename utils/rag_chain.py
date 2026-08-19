from typing import Any

from langchain_core.documents import Document

from llm import llm
from retriever import get_relevant_documents


FALLBACK_RESPONSE = (
    "I couldn't find enough information in the uploaded documents."
)


def _clean_llm_response(content: Any) -> str:
    """Remove model reasoning blocks and return only the final answer."""
    answer = str(content).strip()

    # Remove <think>...</think> reasoning returned by some hosted models.
    if "<think>" in answer and "</think>" in answer:
        answer = answer.split("</think>", 1)[1].strip()

    # Handle an opening <think> tag without a closing tag defensively.
    elif "<think>" in answer:
        answer = answer.split("<think>", 1)[0].strip()

    return answer


def _format_context(docs: list[Document]) -> str:
    """Build a clean context string from retrieved documents."""
    if not docs:
        return ""

    context_parts = []

    for index, doc in enumerate(docs, start=1):
        metadata = doc.metadata or {}

        source = metadata.get("source", "Unknown source")
        page = metadata.get("page", metadata.get("page_number", "Unknown"))
        score = metadata.get("score", "N/A")

        context_parts.append(
            f"""
--- Document Chunk {index} ---
Source: {source}
Page: {page}
Score: {score}
ID: {metadata.get("id", "N/A")}

{doc.page_content}
""".strip()
        )

    return "\n\n".join(context_parts)


def ask_question(
    question: str,
    history: list[dict[str, str]] | None = None,
):
    """
    Answer a question using retrieved document context.

    Returns:
        tuple[str, list[Document]]: cleaned answer and retrieved documents.
    """
    history = history or []

    docs = get_relevant_documents(question)

    if not docs:
        return FALLBACK_RESPONSE, []

    context = _format_context(docs)

    history_text = ""

    if history:
        history_lines = []

        for message in history:
            role = message.get("role", "user")
            content = message.get("content", "")

            if content:
                history_lines.append(f"{role.upper()}: {content}")

        history_text = "\n".join(history_lines)

    prompt = f"""
You are a private document question-answering assistant.

Answer the user's question ONLY using the supplied document context.

Rules:
1. Use only information contained in the document context.
2. For exact-value questions, extract the exact value from the context.
3. Do not replace a value with a guess.
4. Do not invent information.
5. For explanation or summary questions, synthesize the supplied context.
6. If the required information is genuinely absent from the context, reply exactly:
"I couldn't find enough information in the uploaded documents."
7. Give only the final answer.
8. Do not reveal your reasoning process.
9. Do not output <think> blocks.

Conversation history:
{history_text}

Document context:
{context}

User question:
{question}

Answer:
"""

    response = llm.invoke(prompt)

    answer = _clean_llm_response(response.content)

    if not answer:
        answer = FALLBACK_RESPONSE

    return answer, docs