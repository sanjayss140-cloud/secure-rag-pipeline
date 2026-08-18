from llm import llm
from retriever import get_relevant_documents


def ask_question(question: str, chat_history=None):
    if chat_history is None:
        chat_history = []

    # Keep conversation context small.
    history_text = ""

    for message in chat_history[-4:]:
        role = message.get("role", "").upper()
        content = message.get("content", "").strip()

        if content:
            history_text += f"{role}: {content}\n"

    # Retrieve using the current question.
    docs = get_relevant_documents(question)

    if not docs:
        return (
            "I couldn't find enough information in the uploaded documents.",
            [],
        )

    context_parts = []

    for i, doc in enumerate(docs, start=1):
        source = doc.metadata.get(
            "source",
            "Unknown document",
        )

        page = doc.metadata.get("page")

        page_text = (
            f"Page {page + 1}"
            if page is not None
            else "Page unknown"
        )

        context_parts.append(
            f"[SOURCE {i} | {source} | {page_text}]\n"
            f"{doc.page_content.strip()}"
        )

    context = "\n\n".join(context_parts)

    prompt = f"""
You are a precise private document assistant.

Your factual source is ONLY the document context below.

Conversation history:
{history_text}

Document context:
{context}

Current question:
{question}

Instructions:

1. Answer the current question directly.
2. If the question asks for an exact value such as:
   - enrollment number
   - registration number
   - phone number
   - email
   - date
   - name
   - address
   - score
   - ID
   then extract the exact value from the document context.
3. Do not replace a value with a guess.
4. Do not invent information.
5. For explanation or summary questions, synthesize the supplied context.
6. If the required information is genuinely absent from the context,
   reply exactly:
   "I couldn't find enough information in the uploaded documents."

Answer:
"""

    response = llm.invoke(prompt)

    return response.content.strip(), docs