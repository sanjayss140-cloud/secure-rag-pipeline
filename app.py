import hashlib

import streamlit as st

from utils.file_manager import save_uploaded_files
from utils.auto_ingest import rebuild_vector_database
from utils.rag_chain import ask_question
from retriever import reset_vector_db


# =========================================================
# PAGE CONFIGURATION
# =========================================================

st.set_page_config(
    page_title="Secure RAG",
    page_icon="🔒",
    layout="wide",
    initial_sidebar_state="expanded",
)


# =========================================================
# PREMIUM DARK + PURPLE UI
# =========================================================

st.markdown(
    """
<style>

:root {
    /* =====================================================
       DESIGN SYSTEM
       ===================================================== */

    --bg-main: #0B0F19;
    --bg-card: #131A2E;

    --accent-purple: #A855F7;
    --accent-lavender: #C084FC;

    --text-primary: #FFFFFF;
    --text-secondary: #9CA3AF;

    --border-purple: rgba(192, 132, 252, 0.26);
    --border-purple-soft: rgba(168, 85, 247, 0.20);
    --purple-glow: rgba(168, 85, 247, 0.30);
}


/* =========================================================
   GLOBAL APP BACKGROUND
   ========================================================= */

.stApp {
    background:
        radial-gradient(
            circle at 12% 8%,
            rgba(168, 85, 247, 0.10),
            transparent 28%
        ),
        radial-gradient(
            circle at 88% 18%,
            rgba(192, 132, 252, 0.07),
            transparent 25%
        ),
        linear-gradient(
            135deg,
            var(--bg-main) 0%,
            #0D1220 52%,
            var(--bg-main) 100%
        );

    color: var(--text-primary);
}


/* Main content width */

.main .block-container {
    max-width: 1200px;
    padding-top: 1.5rem;
    padding-bottom: 5rem;
}


/* =========================================================
   REMOVE DEFAULT STREAMLIT CHROME
   ========================================================= */

#MainMenu {
    visibility: hidden;
}

footer {
    visibility: hidden;
}

header[data-testid="stHeader"] {
    background: transparent;
}


/* =========================================================
   MAIN BRAND
   ========================================================= */

.hero {
    text-align: center;
    margin-bottom: 2.5rem;
}


/* "Secure RAG" stays crisp WHITE */

.hero-title {
    font-size: 3.15rem;
    font-weight: 850;
    letter-spacing: -0.045em;

    color: var(--text-primary);

    text-shadow:
        0 0 24px rgba(168, 85, 247, 0.12),
        0 0 45px rgba(192, 132, 252, 0.06);
}


/* Subtitle */

.hero-subtitle {
    color: var(--text-secondary);
    font-size: 1rem;
    margin-top: 0.45rem;
}


/* =========================================================
   SIDEBAR
   ========================================================= */

section[data-testid="stSidebar"] {
    background:
        linear-gradient(
            180deg,
            #0A0E18 0%,
            #0D1322 100%
        );

    border-right: 1px solid rgba(192, 132, 252, 0.10);
}


/* Sidebar heading */

.sidebar-brand-title {
    font-size: 1.35rem;
    font-weight: 800;
    color: var(--text-primary);
}

.sidebar-brand-subtitle {
    color: var(--text-secondary);
    font-size: 0.82rem;
    margin-top: 0.2rem;
}


/* =========================================================
   FILE UPLOADER
   ========================================================= */

[data-testid="stFileUploader"] {
    background: var(--bg-card);

    border: 1px solid rgba(255, 255, 255, 0.13);

    border-radius: 18px;

    padding: 0.75rem;

    box-shadow:
        0 12px 35px rgba(0, 0, 0, 0.20);

    transition:
        border-color 0.25s ease,
        box-shadow 0.25s ease;
}


/* Purple hover glow */

[data-testid="stFileUploader"]:hover {
    border-color: rgba(192, 132, 252, 0.55);

    box-shadow:
        0 0 24px rgba(168, 85, 247, 0.15);
}


/* =========================================================
   UPLOAD BUTTON
   White border + white text
   Purple hover glow
   ========================================================= */

[data-testid="stFileUploader"] button {
    background: transparent !important;

    border: 1px solid rgba(255, 255, 255, 0.75) !important;

    color: #FFFFFF !important;

    border-radius: 11px !important;

    transition:
        border-color 0.25s ease,
        box-shadow 0.25s ease,
        background 0.25s ease;
}


[data-testid="stFileUploader"] button:hover {
    border-color: var(--accent-lavender) !important;

    background: rgba(168, 85, 247, 0.08) !important;

    box-shadow:
        0 0 18px rgba(168, 85, 247, 0.30);
}


/* =========================================================
   SYSTEM ONLINE BADGE
   ========================================================= */

.system-pill {
    display: inline-flex;

    align-items: center;

    gap: 0.4rem;

    padding: 0.36rem 0.78rem;

    border-radius: 999px;

    background: rgba(168, 85, 247, 0.15);

    border: 1px solid var(--accent-lavender);

    color: var(--accent-lavender);

    font-size: 0.73rem;

    font-weight: 800;

    letter-spacing: 0.02em;

    box-shadow:
        0 0 18px rgba(168, 85, 247, 0.12);
}


/* =========================================================
   SECURITY CENTER CARD
   ========================================================= */

.glass-card {
    background: var(--bg-card);

    border: 1px solid rgba(192, 132, 252, 0.14);

    border-radius: 20px;

    padding: 1.1rem;

    box-shadow:
        0 18px 45px rgba(0, 0, 0, 0.20),
        inset 0 1px 0 rgba(255, 255, 255, 0.025);
}


/* Security list text */

.security-text {
    color: var(--text-primary);

    font-size: 0.86rem;

    line-height: 1.95;
}


/* Soft white/lavender security bullets */

.security-item {
    color: var(--text-primary);
}


/* =========================================================
   WELCOME CARD
   ========================================================= */

.welcome-card {
    text-align: center;

    padding: 3.5rem 2rem;

    border-radius: 28px;

    background:
        radial-gradient(
            circle at 50% 0%,
            rgba(168, 85, 247, 0.13),
            transparent 42%
        ),
        radial-gradient(
            circle at 50% 40%,
            rgba(192, 132, 252, 0.05),
            transparent 60%
        ),
        var(--bg-card);

    border: 1px solid rgba(192, 132, 252, 0.16);

    box-shadow:
        0 0 55px rgba(168, 85, 247, 0.05),
        inset 0 1px 0 rgba(255, 255, 255, 0.025);
}


/* Center sparkle */

.welcome-icon {
    display: inline-block;

    font-size: 3.2rem;

    color: var(--accent-purple);

    filter:
        drop-shadow(
            0 0 15px rgba(168, 85, 247, 0.65)
        );
}


/* Main welcome heading */

.welcome-title {
    font-size: 1.6rem;

    font-weight: 850;

    color: var(--text-primary);

    margin-top: 0.7rem;
}


/* Welcome description */

.welcome-text {
    color: var(--text-secondary);

    margin-top: 0.55rem;

    line-height: 1.7;
}


/* =========================================================
   CHAT INPUT CONTAINER
   ========================================================= */

[data-testid="stChatInput"] {
    background: transparent;
}


/* Text input */

[data-testid="stChatInput"] textarea {
    background: var(--bg-card) !important;

    color: var(--text-primary) !important;

    border: 1px solid rgba(124, 58, 237, 0.30) !important;

    border-radius: 18px !important;

    box-shadow:
        0 10px 30px rgba(0, 0, 0, 0.18);

    transition:
        border-color 0.25s ease,
        box-shadow 0.25s ease;
}


/* Focus */

[data-testid="stChatInput"] textarea:focus {
    border-color: rgba(192, 132, 252, 0.65) !important;

    box-shadow:
        0 0 22px rgba(168, 85, 247, 0.13) !important;
}


/* Placeholder */

[data-testid="stChatInput"] textarea::placeholder {
    color: var(--text-secondary) !important;
}


/* =========================================================
   SEND BUTTON
   ========================================================= */

[data-testid="stChatInput"] button {
    background: var(--accent-purple) !important;

    border: none !important;

    color: #FFFFFF !important;

    border-radius: 50% !important;

    box-shadow:
        0 0 16px rgba(168, 85, 247, 0.32);

    transition:
        transform 0.20s ease,
        box-shadow 0.20s ease,
        background 0.20s ease;
}


/* Send hover */

[data-testid="stChatInput"] button:hover {
    background: #B76AF8 !important;

    transform: scale(1.06);

    box-shadow:
        0 0 25px rgba(168, 85, 247, 0.48);
}


/* Attempt to keep send icon white */

[data-testid="stChatInput"] button svg {
    color: #FFFFFF !important;

    fill: #FFFFFF !important;

    stroke: #FFFFFF !important;
}


/* =========================================================
   CHAT MESSAGE BASE
   ========================================================= */

[data-testid="stChatMessage"] {
    margin-top: 0.55rem;

    margin-bottom: 0.8rem;
}


[data-testid="stChatMessageContent"] {
    border-radius: 20px !important;

    padding: 1rem 1.2rem !important;

    color: var(--text-primary) !important;
}


/* =========================================================
   USER MESSAGE
   Purple bubble
   ========================================================= */


/*
   Streamlit's message DOM can vary between releases.
   This selector handles the common user chat structure.
*/

[data-testid="stChatMessage"] [data-testid="chatAvatarIcon-user"] {
    color: #FFFFFF !important;
}


/* Purple bubble */

[data-testid="stChatMessage"]:has(
    [data-testid="chatAvatarIcon-user"]
) [data-testid="stChatMessageContent"] {

    background: var(--accent-purple) !important;

    border: 1px solid rgba(255, 255, 255, 0.08) !important;

    color: #FFFFFF !important;

    box-shadow:
        0 8px 24px rgba(168, 85, 247, 0.18);
}


/* User text */

[data-testid="stChatMessage"]:has(
    [data-testid="chatAvatarIcon-user"]
) [data-testid="stChatMessageContent"] p,
[data-testid="stChatMessage"]:has(
    [data-testid="chatAvatarIcon-user"]
) [data-testid="stChatMessageContent"] li {

    color: #FFFFFF !important;
}


/* =========================================================
   AI MESSAGE
   Navy card + lavender border
   ========================================================= */

[data-testid="stChatMessage"]:has(
    [data-testid="chatAvatarIcon-assistant"]
) [data-testid="stChatMessageContent"] {

    background: var(--bg-card) !important;

    border: 1px solid rgba(192, 132, 252, 0.28) !important;

    color: var(--text-primary) !important;

    box-shadow:
        0 10px 32px rgba(0, 0, 0, 0.18);
}


/* AI text */

[data-testid="stChatMessage"]:has(
    [data-testid="chatAvatarIcon-assistant"]
) [data-testid="stChatMessageContent"] p,
[data-testid="stChatMessage"]:has(
    [data-testid="chatAvatarIcon-assistant"]
) [data-testid="stChatMessageContent"] li {

    color: var(--text-primary) !important;
}


/* =========================================================
   SOURCES
   ========================================================= */

.source-card {
    background: var(--bg-card);

    border: 1px solid rgba(192, 132, 252, 0.14);

    border-radius: 14px;

    padding: 0.85rem 1rem;

    margin-bottom: 0.65rem;

    transition:
        border-color 0.20s ease,
        box-shadow 0.20s ease,
        transform 0.20s ease;
}


.source-card:hover {
    border-color: rgba(192, 132, 252, 0.40);

    box-shadow:
        0 0 20px rgba(168, 85, 247, 0.08);

    transform: translateX(2px);
}


.source-title {
    color: var(--text-primary);

    font-weight: 750;

    font-size: 0.9rem;
}


.source-meta {
    color: var(--text-secondary);

    font-size: 0.78rem;

    margin-top: 0.18rem;
}


/* =========================================================
   STREAMLIT STATUS / SUCCESS
   ========================================================= */

div[data-testid="stAlert"] {
    background: var(--bg-card) !important;

    border: 1px solid rgba(192, 132, 252, 0.16) !important;

    color: var(--text-primary) !important;
}


/* =========================================================
   TEXT SELECTION
   ========================================================= */

::selection {
    background: rgba(168, 85, 247, 0.38);

    color: #FFFFFF;
}

</style>
""",
    unsafe_allow_html=True,
)


# =========================================================
# MAIN HEADER
# =========================================================

st.markdown(
    '<div class="hero">'
    '<div class="hero-title">🔒 Secure RAG</div>'
    '<div class="hero-subtitle">'
    'Private document intelligence powered by local AI'
    '</div>'
    '</div>',
    unsafe_allow_html=True,
)


# =========================================================
# SESSION STATE
# =========================================================

if "uploaded_signature" not in st.session_state:
    st.session_state.uploaded_signature = None

if "messages" not in st.session_state:
    st.session_state.messages = []


# =========================================================
# SIDEBAR
# =========================================================

with st.sidebar:

    st.markdown(
        '<div class="sidebar-brand-title">'
        '📚 Knowledge Base'
        '</div>'
        '<div class="sidebar-brand-subtitle">'
        'Your private documents'
        '</div>',
        unsafe_allow_html=True,
    )

    st.write("")

    uploaded_files = st.file_uploader(
        "Upload PDF documents (maximum 10 MB per file)",
        type=["pdf"],
        accept_multiple_files=True,
    )

    st.divider()

    # System Online
    st.markdown(
        '<div class="system-pill">● SYSTEM ONLINE</div>',
        unsafe_allow_html=True,
    )

    st.write("")

    # Security Center
    st.markdown(
        '<div class="glass-card">'
        '<div style="'
        'font-weight:800; '
        'margin-bottom:0.65rem; '
        'color:#FFFFFF;'
        '">'
        '🔐 Security Center'
        '</div>'

        '<div class="security-text">'

        '<div class="security-item">'
        '<span style="color:#FFFFFF;">●</span> '
        'File validation enabled'
        '</div>'

        '<div class="security-item">'
        '<span style="color:#C084FC;">●</span> '
        '10 MB upload limit'
        '</div>'

        '<div class="security-item">'
        '<span style="color:#FFFFFF;">●</span> '
        'Safe filenames'
        '</div>'

        '<div class="security-item">'
        '<span style="color:#C084FC;">●</span> '
        'Local embeddings'
        '</div>'

        '<div class="security-item">'
        '<span style="color:#FFFFFF;">●</span> '
        'Local vector search'
        '</div>'

        '<div class="security-item">'
        '<span style="color:#C084FC;">●</span> '
        'Local AI inference'
        '</div>'

        '<div class="security-item">'
        '<span style="color:#FFFFFF;">●</span> '
        'Document-grounded answers'
        '</div>'

        '</div>'
        '</div>',
        unsafe_allow_html=True,
    )


# =========================================================
# DOCUMENT PROCESSING
# =========================================================

if uploaded_files:

    signature_text = "|".join(
        f"{file.name}:{file.size}"
        for file in uploaded_files
    )

    current_signature = hashlib.sha256(
        signature_text.encode("utf-8")
    ).hexdigest()

    if (
        current_signature
        != st.session_state.uploaded_signature
    ):

        try:

            with st.spinner(
                "Processing your documents..."
            ):

                save_uploaded_files(
                    uploaded_files
                )

                total_chunks = (
                    rebuild_vector_database()
                )

                reset_vector_db()

            st.session_state.uploaded_signature = (
                current_signature
            )

            st.session_state.messages = []

            st.success(
                f"✅ Indexed {total_chunks} chunks"
            )

        except Exception as e:

            st.error(
                "❌ Could not process the uploaded documents."
            )

            with st.expander(
                "Technical details"
            ):
                st.exception(e)

    else:

        st.markdown(
            '<div class="glass-card">'
            '<b style="color:#FFFFFF;">'
            '✅ Documents ready'
            '</b><br>'
            '<span style="color:#9CA3AF;">'
            'Your knowledge base is ready for questions.'
            '</span>'
            '</div>',
            unsafe_allow_html=True,
        )


# =========================================================
# WELCOME SCREEN
# =========================================================

if not st.session_state.messages:

    st.markdown(
        '<div class="welcome-card">'

        '<div class="welcome-icon">'
        '✦'
        '</div>'

        '<div class="welcome-title">'
        'Your private AI document assistant'
        '</div>'

        '<div class="welcome-text">'
        'Upload a PDF and start asking questions.<br>'
        '<span style="color:#FFFFFF;">'
        'Your documents stay in your local RAG pipeline.'
        '</span>'
        '</div>'

        '</div>',
        unsafe_allow_html=True,
    )


# =========================================================
# CHAT HISTORY
# =========================================================

for message in st.session_state.messages:

    with st.chat_message(
        message["role"]
    ):

        st.markdown(
            message["content"]
        )

        if message.get("sources"):

            with st.expander(
                "📚 View sources"
            ):

                for source in (
                    message["sources"]
                ):

                    parts = source.split(
                        " — Page "
                    )

                    filename = parts[0]

                    page = (
                        f"Page {parts[1]}"
                        if len(parts) > 1
                        else "Page unknown"
                    )

                    st.markdown(
                        '<div class="source-card">'
                        f'<div class="source-title">'
                        f'📄 {filename}'
                        '</div>'
                        f'<div class="source-meta">'
                        f'📍 {page}'
                        '</div>'
                        '</div>',
                        unsafe_allow_html=True,
                    )


# =========================================================
# CHAT INPUT
# =========================================================

question = st.chat_input(
    "Ask your documents anything..."
)


if question:

    # Save current user question
    st.session_state.messages.append(
        {
            "role": "user",
            "content": question,
        }
    )

    with st.chat_message("user"):

        st.markdown(
            question
        )

    with st.chat_message(
        "assistant"
    ):

        with st.spinner(
            "✨ Thinking..."
        ):

            try:

                # Previous conversation only
                previous_messages = (
                    st.session_state.messages[:-1]
                )

                answer, docs = ask_question(
                    question,
                    previous_messages,
                )

                sources = []

                for doc in docs:

                    source = doc.metadata.get(
                        "source",
                        "Unknown document",
                    )

                    page = doc.metadata.get(
                        "page"
                    )

                    if page is not None:

                        source_text = (
                            f"📄 {source}"
                            f" — Page {page + 1}"
                        )

                    else:

                        source_text = (
                            f"📄 {source}"
                        )

                    if source_text not in sources:

                        sources.append(
                            source_text
                        )

                st.markdown(
                    answer
                )

                if sources:

                    with st.expander(
                        "📚 View sources"
                    ):

                        for source in sources:

                            parts = source.split(
                                " — Page "
                            )

                            filename = parts[0]

                            page = (
                                f"Page {parts[1]}"
                                if len(parts) > 1
                                else "Page unknown"
                            )

                            st.markdown(
                                '<div class="source-card">'
                                f'<div class="source-title">'
                                f'{filename}'
                                '</div>'
                                f'<div class="source-meta">'
                                f'📍 {page}'
                                '</div>'
                                '</div>',
                                unsafe_allow_html=True,
                            )

                # Save assistant response
                st.session_state.messages.append(
                    {
                        "role": "assistant",
                        "content": answer,
                        "sources": sources,
                    }
                )

            except Exception as e:

                st.error(
                    "❌ RAG error"
                )

                with st.expander(
                    "Technical details",
                    expanded=True,
                ):

                    st.exception(e)
