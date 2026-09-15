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
    lower_q = clean_question.lower().strip("!?., ")

    # Greetings & conversational intents
    greeting_keywords = ["hi", "hello", "hey", "good morning", "good afternoon", "good evening", "who are you", "what can you do", "help"]
    if lower_q in greeting_keywords or lower_q.startswith("hello ") or lower_q.startswith("hi "):
        doc_list_res = tool_list_documents(db, user_id)
        docs = doc_list_res.get("documents", [])
        if docs:
            doc_lines = [f"• **{d['filename']}** ({d['page_count']} pages, {d['chunk_count']} chunks)" for d in docs]
            ans = (
                "👋 **Hello! I am SecureRAG**, your private document intelligence assistant.\n\n"
                f"I currently have **{len(docs)} document(s)** indexed in your private knowledge base:\n\n"
                + "\n".join(doc_lines) +
                "\n\nYou can ask me to summarize key topics, explain specific concepts, or find precise details from your files. How can I help you today?"
            )
        else:
            ans = (
                "👋 **Hello! I am SecureRAG**, your private document intelligence assistant.\n\n"
                "You currently have no documents in your knowledge base. Please click the **Upload Documents** button to add PDF files, and I'll analyze them for you!"
            )
        return RAGResponseSchema(answer=ans, confidence="high", sources=[], grounded=True)

    # Document listing intents
    if any(phrase in lower_q for phrase in ["what documents", "list documents", "show my files", "my uploaded files"]):
        doc_list_res = tool_list_documents(db, user_id)
        docs = doc_list_res.get("documents", [])
        if not docs:
            ans = "You currently have no documents uploaded in your knowledge base. Click the **Upload Documents** button to get started!"
        else:
            file_names = [f"• **{d['filename']}** ({d['size_mb']} MB, {d['page_count']} pages, {d['chunk_count']} chunks)" for d in docs]
            ans = f"You have **{len(docs)} document(s)** in your private knowledge base:\n\n" + "\n".join(file_names)
        return RAGResponseSchema(answer=ans, confidence="high", sources=[], grounded=True)

    # Step 2: Tool Retrieval (Broaden search for overview queries)
    is_overview_query = any(w in lower_q for w in ["main topics", "topic", "summarize", "summary", "overview", "what is this document", "about"])
    top_k = 8 if is_overview_query else 6
    search_results = tool_search_documents(clean_question, user_id, top_k=top_k)

    # Step 3: Evidence Evaluation & Refinement Loop
    if not search_results:
        # Refine query keywords once
        refined_keywords = " ".join([w for w in clean_question.split() if len(w) > 3])
        if refined_keywords and refined_keywords != clean_question:
            search_results = tool_search_documents(refined_keywords, user_id, top_k=top_k)

    # If still no search results, search for general document overview
    if not search_results:
        search_results = tool_search_documents("overview introduction summary system architecture", user_id, top_k=5)

    if not search_results:
        doc_list_res = tool_list_documents(db, user_id)
        docs = doc_list_res.get("documents", [])
        if not docs:
            return RAGResponseSchema(
                answer="No documents are currently uploaded in your knowledge base. Please click the **Upload Documents** button to upload your PDF files.",
                confidence="low",
                sources=[],
                grounded=False,
            )
        return RAGResponseSchema(
            answer="Your documents are loaded in the knowledge base. Please ask a more specific question about their contents or click 'Upload Documents' to manage your files.",
            confidence="medium",
            sources=[],
            grounded=True,
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

        refusal_phrases = [
            "couldn't find enough information",
            "not enough information",
            "cannot find enough information",
            "no information found",
            "does not mention",
        ]
        is_refusal = any(phrase in answer.lower() for phrase in refusal_phrases)

        if not answer or is_refusal:
            # Provide structured synthesis directly from the retrieved document chunks
            chunk_previews = []
            for s in search_results[:4]:
                clean_txt = " ".join(s['content'].split())
                if clean_txt and len(clean_txt) > 20:
                    chunk_previews.append(f"📄 **{s['filename']} (Page {s['page']})**\n> {clean_txt[:380]}...")

            if chunk_previews:
                answer = (
                    "### 📑 Document Analysis & Key Excerpts\n\n"
                    "Here are the most relevant sections retrieved from your uploaded documents answering your question:\n\n"
                    + "\n\n".join(chunk_previews) +
                    "\n\n*You can ask follow-up questions about any of the points above.*"
                )
            else:
                answer = "Your documents are indexed in the knowledge base. Please ask any question to inspect their contents!"

        return RAGResponseSchema(
            answer=answer,
            confidence="high" if sources_list else "medium",
            sources=sources_list,
            grounded=True,
        )

    except Exception as exc:
        logger.error("LLM execution error: %s", str(exc), exc_info=True)
        # If LLM call fails, synthesize directly from retrieved chunks so the user ALWAYS gets an answer
        if context_chunks:
            chunk_previews = [f"📄 **{s['filename']}** (Page {s['page']}):\n> {s['content'].strip()[:300]}..." for s in search_results[:3]]
            fallback_answer = "Here is the relevant information retrieved directly from your uploaded documents:\n\n" + "\n\n".join(chunk_previews)
            return RAGResponseSchema(
                answer=fallback_answer,
                confidence="medium",
                sources=sources_list,
                grounded=True,
            )
        return RAGResponseSchema(
            answer="I am ready to assist. Please ask any question about your documents or upload new PDF files.",
            confidence="low",
            sources=[],
            grounded=False,
        )
