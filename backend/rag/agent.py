import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from llm import llm
from backend.rag.prompts import SYSTEM_RAG_PROMPT, USER_QUERY_TEMPLATE
from backend.rag.tools import tool_list_documents, tool_search_documents
from backend.security.sanitizer import detect_prompt_injection, sanitize_text_input

logger = logging.getLogger("securerag-agent")

FALLBACK_ANSWER = "I couldn't find enough information in the uploaded documents to answer that."


class SourceCitationSchema(BaseModel):
    file: str
    page: Optional[int] = None
    document_id: Optional[str] = None


class RAGResponseSchema(BaseModel):
    answer: str
    confidence: str = Field(description="high, medium, or low")
    sources: List[SourceCitationSchema] = Field(default_factory=list)
    grounded: bool = True


def _clean_llm_response(text: str) -> str:
    """Strip chain-of-thought tags (<think>...</think>) if present."""
    if not text:
        return ""
    clean = str(text).strip()
    if "<think>" in clean and "</think>" in clean:
        clean = clean.split("</think>", 1)[1].strip()
    elif "<think>" in clean:
        parts = clean.split("<think>", 1)
        clean = parts[1].strip() if len(parts) > 1 else ""
    return clean.strip()


def run_rag_agent(
    question: str,
    user_id: str,
    db: Session,
    history: Optional[List[Dict[str, str]]] = None,
) -> RAGResponseSchema:
    """
    Bounded multi-step agent workflow:
    1. Input sanitization & prompt injection check
    2. Intent classification (list documents vs document query)
    3. Tool retrieval (FAISS search)
    4. Evidence evaluation & query refinement
    5. Structured response generation & guardrail check
    """
    clean_question = sanitize_text_input(question)
    if not clean_question:
        return RAGResponseSchema(
            answer="Question cannot be empty.",
            confidence="high",
            sources=[],
            grounded=False,
        )

    # Security check: Prompt injection guardrail
    is_suspicious, reason = detect_prompt_injection(clean_question)
    if is_suspicious:
        logger.warning("Prompt injection detected for user %s: %s", user_id, clean_question)
        return RAGResponseSchema(
            answer="Security Warning: Your input contains patterns that attempt to override system instructions. Request declined.",
            confidence="high",
            sources=[],
            grounded=False,
        )

    # Step 1: Intent Classification
    lower_q = clean_question.lower()
    if any(phrase in lower_q for phrase in ["what documents", "list documents", "show my files", "my uploaded files"]):
        doc_list_res = tool_list_documents(db, user_id)
        docs = doc_list_res.get("documents", [])
        if not docs:
            ans = "You currently have no documents uploaded in your knowledge base."
        else:
            file_names = [f"• {d['filename']} ({d['size_mb']} MB, {d['page_count']} pages)" for d in docs]
            ans = f"You have {len(docs)} document(s) in your private knowledge base:\n" + "\n".join(file_names)
        return RAGResponseSchema(answer=ans, confidence="high", sources=[], grounded=True)

    # Step 2: Tool Retrieval
    search_results = tool_search_documents(clean_question, user_id, top_k=6)

    # Step 3: Evidence Evaluation & Refinement Loop
    if not search_results:
        # Refine query keywords once
        refined_keywords = " ".join([w for w in clean_question.split() if len(w) > 3])
        if refined_keywords and refined_keywords != clean_question:
            search_results = tool_search_documents(refined_keywords, user_id, top_k=5)

    if not search_results:
        return RAGResponseSchema(
            answer=FALLBACK_ANSWER,
            confidence="low",
            sources=[],
            grounded=False,
        )

    # Build context string & extract unique citations
    context_chunks = []
    sources_dict = {}

    for idx, item in enumerate(search_results, start=1):
        filename = item["filename"]
        page = item["page"]
        content = item["content"]
        doc_id = item.get("document_id")

        context_chunks.append(
            f"--- CHUNK {idx} (File: {filename}, Page: {page}) ---\n{content}"
        )
        sources_dict[(filename, page)] = doc_id

    context_str = "\n\n".join(context_chunks)

    # Build history string
    history_str = ""
    if history:
        history_lines = [f"{msg.get('role', 'user').upper()}: {msg.get('content', '')}" for msg in history[-6:]]
        history_str = "\n".join(history_lines)

    sources_list = [
        SourceCitationSchema(file=fname, page=pg, document_id=did)
        for (fname, pg), did in sources_dict.items()
    ]

    # Step 4: Prompt Construction & LLM Call
    full_prompt = f"{SYSTEM_RAG_PROMPT}\n\n" + USER_QUERY_TEMPLATE.format(
        history_text=history_str if history_str else "None",
        context_text=context_str,
        question=clean_question,
    )

    try:
        raw_response = llm.invoke(full_prompt)
        response_text = getattr(raw_response, "content", str(raw_response))
        answer = _clean_llm_response(response_text)

        if not answer or FALLBACK_ANSWER in answer:
            return RAGResponseSchema(
                answer=FALLBACK_ANSWER,
                confidence="low",
                sources=[],
                grounded=False,
            )

        return RAGResponseSchema(
            answer=answer,
            confidence="high",
            sources=sources_list,
            grounded=True,
        )

    except Exception as exc:
        logger.error("LLM execution error: %s", str(exc), exc_info=True)
        # Check if error is provider connection refusal (Ollama/Groq offline)
        err_msg = str(exc)
        if "connection" in err_msg.lower() or "refused" in err_msg.lower() or "connect" in err_msg.lower():
            fallback_answer = (
                "⚠️ LLM service is currently offline or unreachable. "
                "Document evidence was retrieved successfully from the knowledge base, "
                "but text generation requires Groq API key or running Ollama service."
            )
        else:
            fallback_answer = "An error occurred while generating the answer from the model."

        return RAGResponseSchema(
            answer=fallback_answer,
            confidence="medium" if sources_list else "low",
            sources=sources_list,
            grounded=bool(sources_list),
        )
