import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from llm import llm, LLM_MODEL, GROQ_API_KEY
from backend.rag.prompts import (
    SYSTEM_CHATGPT_PROMPT,
    SYSTEM_DOCUMENT_RAG_PROMPT,
    SYSTEM_VISION_PROMPT,
    USER_QUERY_TEMPLATE,
    USER_GENERAL_QUERY_TEMPLATE,
)
from backend.rag.tools import tool_list_documents, tool_search_documents
from backend.security.sanitizer import detect_prompt_injection, sanitize_text_input

logger = logging.getLogger("securerag-agent")


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
    """Strip reasoning/chain-of-thought tags (<think>...</think>) if present."""
    if not text:
        return ""
    clean = str(text).strip()
    if "<think>" in clean and "</think>" in clean:
        clean = clean.split("</think>", 1)[1].strip()
    elif "<think>" in clean:
        parts = clean.split("<think>", 1)
        clean = parts[1].strip() if len(parts) > 1 else ""
    return clean.strip()


def _invoke_llm_with_fallback(prompt: str) -> str:
    """
    Invoke LLM with resilient error handling and model fallback.
    """
    try:
        raw_res = llm.invoke(prompt)
        text = getattr(raw_res, "content", str(raw_res))
        return _clean_llm_response(text)
    except Exception as exc:
        logger.warning("Primary LLM invocation failed (%s). Attempting fallback...", str(exc))
        if GROQ_API_KEY:
            try:
                from langchain_openai import ChatOpenAI
                # Fallback to secondary fast Groq model
                fallback_model = "openai/gpt-oss-120b" if LLM_MODEL != "openai/gpt-oss-120b" else "openai/gpt-oss-20b"
                fallback_llm = ChatOpenAI(
                    model=fallback_model,
                    temperature=0.3,
                    api_key=GROQ_API_KEY,
                    base_url="https://api.groq.com/openai/v1/",
                    timeout=45,
                    max_retries=1,
                )
                raw_res = fallback_llm.invoke(prompt)
                text = getattr(raw_res, "content", str(raw_res))
                return _clean_llm_response(text)
            except Exception as fb_exc:
                logger.error("Fallback LLM failed as well: %s", str(fb_exc))
        raise exc


def run_rag_agent(
    question: str,
    user_id: str,
    db: Session,
    history: Optional[List[Dict[str, str]]] = None,
) -> RAGResponseSchema:
    """
    Production-grade Hybrid Intelligence & RAG Agent:
    1. Input sanitization & Prompt Injection Guardrail.
    2. Intent Classification:
       - Greetings & identity
       - Document listing / management
       - Document-grounded queries (when user asks about uploaded files or search matches)
       - General ChatGPT-like intelligence (coding, math, creative, general knowledge)
    3. Document retrieval & context assembly when applicable.
    4. Resilient generation with structured markdown and citations.
    """
    clean_question = sanitize_text_input(question)
    if not clean_question:
        return RAGResponseSchema(
            answer="Question cannot be empty. Please ask a question or upload a file!",
            confidence="high",
            sources=[],
            grounded=False,
        )

    # Security check: Prompt injection guardrail
    is_suspicious, reason = detect_prompt_injection(clean_question)
    if is_suspicious:
        logger.warning("Prompt injection detected for user %s: %s", user_id, clean_question)
        return RAGResponseSchema(
            answer="Security Warning: Your prompt contains patterns that attempt to override system instructions. Request declined.",
            confidence="high",
            sources=[],
            grounded=False,
        )

    lower_q = clean_question.lower().strip("!?., ")

    # Step 1: Greeting & Persona queries
    greeting_exact = {"hi", "hello", "hey", "hola", "greetings", "good morning", "good afternoon", "good evening"}
    if lower_q in greeting_exact or lower_q.startswith("hello ") or lower_q.startswith("hi "):
        doc_list_res = tool_list_documents(db, user_id)
        docs = doc_list_res.get("documents", [])
        if docs:
            doc_lines = [f"• **{d['filename']}** ({d['page_count']} pages, {d['chunk_count']} chunks)" for d in docs[:5]]
            ans = (
                "👋 **Hello! I am Mayandi AI**, your advanced multimodal AI assistant and document intelligence companion.\n\n"
                f"You currently have **{len(docs)} document(s)** in your private knowledge base:\n"
                + "\n".join(doc_lines)
                + "\n\nI can answer questions based on your files, write and debug code in any language, solve math and logic problems, analyze images and diagrams, or converse on any topic. How can I assist you today?"
            )
        else:
            ans = (
                "👋 **Hello! I am Mayandi AI**, your all-in-one AI assistant.\n\n"
                "I can help you with:\n"
                "- 💻 **Coding & Debugging** — Python, JavaScript, TypeScript, Rust, Go, C++, SQL, and more\n"
                "- 📄 **Document & File Analysis** — Upload PDFs, Word documents, spreadsheets, or code files\n"
                "- 👁️ **Vision & Multimodal** — Upload images, UI screenshots, charts, or diagrams\n"
                "- 🧠 **General Knowledge & Reasoning** — Science, math, history, literature, and creative writing\n\n"
                "Feel free to ask me anything or upload files using the paperclip button below!"
            )
        return RAGResponseSchema(answer=ans, confidence="high", sources=[], grounded=True)

    # Step 2: Document listing queries
    if any(phrase in lower_q for phrase in ["what documents", "list documents", "show my files", "my uploaded files", "list my files"]):
        doc_list_res = tool_list_documents(db, user_id)
        docs = doc_list_res.get("documents", [])
        if not docs:
            ans = (
                "You currently have no documents uploaded in your private knowledge base.\n\n"
                "You can click the **paperclip** icon or the **Upload Documents** drawer to upload PDFs, DOCX files, code, or images. Once uploaded, I can analyze them, answer questions, and cite specific pages!"
            )
        else:
            file_names = [
                f"• **{d['filename']}** ({d['size_mb']} MB, {d['page_count']} pages, {d['chunk_count']} chunks, status: `{d['status']}`)"
                for d in docs
            ]
            ans = f"📁 **You have {len(docs)} document(s) in your private knowledge base:**\n\n" + "\n".join(file_names)
        return RAGResponseSchema(answer=ans, confidence="high", sources=[], grounded=True)

    # Step 3: Check user document status and determine query intent
    doc_list_res = tool_list_documents(db, user_id)
    user_docs = doc_list_res.get("documents", [])

    has_documents = len(user_docs) > 0
    explicit_doc_intent = any(
        kw in lower_q
        for kw in [
            "document", "doc", "pdf", "file", "uploaded", "paper", "report", "notes",
            "page", "section", "summary of", "summarize", "image", "photo", "picture", "screenshot"
        ]
    )

    # Check if any uploaded filename is mentioned in the query
    filename_mentioned = False
    if has_documents:
        for d in user_docs:
            name_stem = d["filename"].split(".")[0].lower()
            if len(name_stem) > 3 and name_stem in lower_q:
                filename_mentioned = True
                break

    # Step 4: Retrieval if documents exist
    search_results = []
    if has_documents:
        top_k = 8 if any(w in lower_q for w in ["summarize", "overview", "all", "topics"]) else 5
        search_results = tool_search_documents(clean_question, user_id, top_k=top_k)

        # Keyword fallback search if no exact vector matches
        if not search_results and (explicit_doc_intent or filename_mentioned):
            keywords = " ".join([w for w in clean_question.split() if len(w) > 3])
            if keywords:
                search_results = tool_search_documents(keywords, user_id, top_k=top_k)

    # Step 5: Format Conversation History
    history_str = ""
    if history:
        history_lines = [f"{msg.get('role', 'user').upper()}: {msg.get('content', '')}" for msg in history[-6:]]
        history_str = "\n".join(history_lines)

    # Step 6: ROUTING DECISION
    # CASE A: We have retrieved relevant document chunks!
    if search_results:
        context_chunks = []
        sources_dict = {}

        for idx, item in enumerate(search_results, start=1):
            filename = item["filename"]
            page = item.get("page", 0)
            content = item["content"]
            doc_id = item.get("document_id")

            context_chunks.append(
                f"--- EXCERPT {idx} (Source: {filename}, Page: {page}) ---\n{content}"
            )
            sources_dict[(filename, page)] = doc_id

        context_str = "\n\n".join(context_chunks)

        sources_list = [
            SourceCitationSchema(file=fname, page=pg, document_id=did)
            for (fname, pg), did in sources_dict.items()
        ]

        # Check if the retrieved excerpts are from images
        is_visual = any(item.get("filename", "").lower().endswith((".png", ".jpg", ".jpeg", ".webp")) for item in search_results)
        chosen_system_prompt = SYSTEM_VISION_PROMPT if is_visual else SYSTEM_DOCUMENT_RAG_PROMPT

        full_prompt = (
            f"{chosen_system_prompt}\n\n"
            + USER_QUERY_TEMPLATE.format(
                history_text=history_str if history_str else "None",
                context_text=context_str,
                question=clean_question,
            )
        )

        try:
            answer = _invoke_llm_with_fallback(full_prompt)
            return RAGResponseSchema(
                answer=answer,
                confidence="high",
                sources=sources_list,
                grounded=True,
            )
        except Exception as exc:
            logger.error("LLM generation error in document RAG: %s", str(exc), exc_info=True)
            # Synthesize directly from retrieved chunks as resilient fallback
            previews = [
                f"📄 **{s['filename']}** (Page {s.get('page', 1)}):\n> {s['content'].strip()[:280]}..."
                for s in search_results[:3]
            ]
            fallback_answer = (
                "Here is the relevant information retrieved directly from your documents:\n\n"
                + "\n\n".join(previews)
            )
            return RAGResponseSchema(
                answer=fallback_answer,
                confidence="medium",
                sources=sources_list,
                grounded=True,
            )

    # CASE B: No documents found OR question is general intelligence (Coding, Math, Science, Reasoning, Chit-Chat)
    # DO NOT REFUSE! Behave like ChatGPT!
    general_prompt = (
        f"{SYSTEM_CHATGPT_PROMPT}\n\n"
        + USER_GENERAL_QUERY_TEMPLATE.format(
            history_text=history_str if history_str else "None",
            question=clean_question,
        )
    )

    try:
        answer = _invoke_llm_with_fallback(general_prompt)
        return RAGResponseSchema(
            answer=answer,
            confidence="high",
            sources=[],
            grounded=False,
        )
    except Exception as exc:
        logger.error("LLM generation error in general query: %s", str(exc), exc_info=True)
        return RAGResponseSchema(
            answer=(
                "I apologize, but I encountered a momentary connection issue with the AI inference engine. "
                "Please try again in a few moments, or rephrase your question."
            ),
            confidence="low",
            sources=[],
            grounded=False,
        )
