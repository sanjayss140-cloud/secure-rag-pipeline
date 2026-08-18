import { useEffect, useRef, useState } from "react";
import {
  FileText,
  ShieldCheck,
  Plus,
  Upload,
  Send,
  Sparkles,
  Trash2,
  Settings,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";


const API_BASE = "http://127.0.0.1:8000";


function AiGlow() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">
      <motion.div
        className="absolute -left-24 top-1/2 h-72 w-72 rounded-full bg-[#A855F7]/10 blur-[90px]"
        animate={{
          x: [0, 180, 20, 240, 0],
          y: [-40, 30, -10, 50, -40],
          scale: [1, 1.15, 0.9, 1.12, 1],
        }}
        transition={{
          duration: 9,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="absolute -right-24 top-0 h-80 w-80 rounded-full bg-[#C084FC]/8 blur-[100px]"
        animate={{
          x: [0, -120, -20, -160, 0],
          y: [30, 120, 60, 140, 30],
          scale: [1, 0.9, 1.12, 0.94, 1],
        }}
        transition={{
          duration: 11,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="absolute left-1/2 top-1/2 h-40 w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#7C3AED]/8 blur-[80px]"
        animate={{
          rotate: [0, 180, 360],
          scaleX: [1, 1.3, 1],
          opacity: [0.35, 0.7, 0.35],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "linear",
        }}
      />
    </div>
  );
}


function ThinkingOrb() {
  return (
    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
      <motion.div
        className="absolute inset-0 rounded-full border border-[#C084FC]/20"
        animate={{
          scale: [1, 1.35, 1],
          opacity: [0.45, 0, 0.45],
        }}
        transition={{
          duration: 1.8,
          repeat: Infinity,
          ease: "easeOut",
        }}
      />

      <motion.div
        className="absolute inset-1 rounded-full bg-[#A855F7]/10 blur-md"
        animate={{
          scale: [0.9, 1.2, 0.9],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#131A2E] ring-1 ring-[#C084FC]/20"
        animate={{
          boxShadow: [
            "0 0 10px rgba(168,85,247,0.10)",
            "0 0 24px rgba(168,85,247,0.30)",
            "0 0 10px rgba(168,85,247,0.10)",
          ],
        }}
        transition={{
          duration: 1.8,
          repeat: Infinity,
        }}
      >
        <Sparkles className="h-4 w-4 text-[#C084FC]" />
      </motion.div>
    </div>
  );
}


function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  const [document, setDocument] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);


  // =====================================================
  // UPLOAD DOCUMENT
  // =====================================================

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];

    // Allow selecting the same file again later.
    event.target.value = "";

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setUploadStatus({
        type: "error",
        message: "Only PDF files are allowed.",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadStatus({
        type: "error",
        message: "Maximum file size is 10 MB.",
      });
      return;
    }

    setIsUploading(true);
    setUploadStatus(null);

    try {
      const formData = new FormData();

      formData.append("file", file);

      const response = await fetch(
        `${API_BASE}/api/upload`,
        {
          method: "POST",
          body: formData,
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            "Document upload failed.",
        );
      }

      setDocument({
        name: data.filename,
        sizeMb: data.size_mb,
        chunks: data.chunks,
        pages: null,
      });

      setMessages([]);

      setUploadStatus({
        type: "success",
        message: `Indexed ${data.chunks} chunks successfully.`,
      });
    } catch (error) {
      console.error(
        "Document upload failed:",
        error,
      );

      setUploadStatus({
        type: "error",
        message:
          error.message ||
          "Could not upload the document.",
      });
    } finally {
      setIsUploading(false);
    }
  };


  // =====================================================
  // OPEN FILE PICKER
  // =====================================================

  const openFilePicker = () => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  };


  // =====================================================
  // SEND CHAT MESSAGE
  // =====================================================

  const sendMessage = async () => {
    const text = input.trim();

    if (!text || isThinking) return;

    const previousHistory = messages.map(
      (message) => ({
        role: message.role,
        content: message.content,
      }),
    );

    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
      },
    ]);

    setInput("");
    setIsThinking(true);

    try {
      const response = await fetch(
        `${API_BASE}/api/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question: text,
            history: previousHistory,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            "The RAG request failed.",
        );
      }

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            data.answer ||
            "I couldn't generate an answer.",
          sources: data.sources || [],
        },
      ]);
    } catch (error) {
      console.error(
        "Secure RAG request failed:",
        error,
      );

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "⚠️ I couldn't connect to the Secure RAG backend. Please make sure FastAPI and Ollama are running.",
          sources: [],
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };


  // =====================================================
  // KEYBOARD
  // =====================================================

  const handleKeyDown = (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      sendMessage();
    }
  };


  // =====================================================
  // CLEAR CHAT
  // =====================================================

  const clearChat = () => {
    setMessages([]);
  };


  // =====================================================
  // NEW CHAT
  // =====================================================

  const newChat = () => {
    setMessages([]);
    setInput("");
    setUploadStatus(null);
  };


  // =====================================================
  // AUTO RESIZE TEXTAREA
  // =====================================================

  useEffect(() => {
    if (!textareaRef.current) return;

    textareaRef.current.style.height =
      "auto";

    textareaRef.current.style.height =
      `${Math.min(
        textareaRef.current.scrollHeight,
        150,
      )}px`;
  }, [input]);


  return (
    <div className="min-h-screen bg-[#0B0F19] text-white">
      <div className="flex min-h-screen">

        {/* =================================================
            SIDEBAR
        ================================================== */}

        <aside className="hidden w-[300px] shrink-0 border-r border-white/5 bg-[#0D1220] lg:flex lg:flex-col">

          {/* Brand */}

          <div className="flex items-center gap-3 border-b border-white/5 px-5 py-5">

            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-[#A855F7]/10 ring-1 ring-[#C084FC]/20">

              <motion.div
                className="absolute inset-0 rounded-xl bg-[#A855F7]/10 blur-md"
                animate={{
                  opacity: [0.25, 0.65, 0.25],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                }}
              />

              <ShieldCheck className="relative h-5 w-5 text-[#C084FC]" />
            </div>

            <div>
              <h1 className="text-sm font-bold tracking-tight">
                Secure RAG
              </h1>

              <p className="text-xs text-[#9CA3AF]">
                Private document intelligence
              </p>
            </div>
          </div>


          {/* New Chat */}

          <div className="p-4">

            <button
              onClick={newChat}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#A855F7] px-4 py-3 text-sm font-semibold text-white shadow-[0_0_30px_rgba(168,85,247,0.15)] transition hover:bg-[#B76AF8] hover:shadow-[0_0_40px_rgba(168,85,247,0.28)]"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </button>

          </div>


          {/* Knowledge Base */}

          <div className="px-4">

            <div className="mb-3 flex items-center justify-between">

              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">
                Knowledge Base
              </span>

              <span className="rounded-full bg-[#A855F7]/10 px-2 py-1 text-[10px] text-[#C084FC]">
                {document ? "1 DOC" : "EMPTY"}
              </span>

            </div>


            {document ? (

              <div className="rounded-2xl border border-[#C084FC]/15 bg-[#131A2E] p-3">

                <div className="flex gap-3">

                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#A855F7]/10">
                    <FileText className="h-4 w-4 text-[#C084FC]" />
                  </div>

                  <div className="min-w-0 flex-1">

                    <p className="truncate text-sm font-semibold">
                      {document.name}
                    </p>

                    <p className="mt-1 text-xs text-[#9CA3AF]">
                      {document.sizeMb} MB ·{" "}
                      {document.chunks} chunks
                    </p>

                  </div>

                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#C084FC]" />

                </div>

              </div>

            ) : (

              <button
                onClick={openFilePicker}
                className="w-full rounded-2xl border border-dashed border-[#C084FC]/15 bg-[#131A2E]/60 p-4 text-left transition hover:border-[#C084FC]/35 hover:bg-[#131A2E]"
              >

                <div className="flex items-center gap-3">

                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#A855F7]/10">
                    <Upload className="h-4 w-4 text-[#C084FC]" />
                  </div>

                  <div>

                    <p className="text-sm font-semibold">
                      Add a document
                    </p>

                    <p className="mt-1 text-xs text-[#9CA3AF]">
                      PDF up to 10 MB
                    </p>

                  </div>

                </div>

              </button>

            )}

          </div>


          {/* Bottom */}

          <div className="mt-auto space-y-3 border-t border-white/5 p-4">

            {/* System status */}

            <div className="rounded-2xl border border-[#C084FC]/10 bg-[#131A2E] p-4">

              <div className="mb-3 flex items-center gap-2">

                <motion.span
                  className="h-2 w-2 rounded-full bg-[#C084FC]"
                  animate={{
                    opacity: [0.45, 1, 0.45],
                    boxShadow: [
                      "0 0 4px rgba(192,132,252,0.3)",
                      "0 0 14px rgba(192,132,252,0.9)",
                      "0 0 4px rgba(192,132,252,0.3)",
                    ],
                  }}
                  transition={{
                    duration: 1.8,
                    repeat: Infinity,
                  }}
                />

                <span className="text-xs font-semibold text-[#C084FC]">
                  SYSTEM ONLINE
                </span>

              </div>

              <div className="space-y-2 text-xs text-[#9CA3AF]">

                <div className="flex justify-between">
                  <span>Embeddings</span>
                  <span className="text-white">
                    Local
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>Vector DB</span>
                  <span className="text-white">
                    FAISS
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>LLM</span>
                  <span className="text-white">
                    Qwen 2.5
                  </span>
                </div>

              </div>

            </div>


            <button className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-[#9CA3AF] transition hover:bg-white/5 hover:text-white">
              <Settings className="h-4 w-4" />
              Settings
            </button>

          </div>

        </aside>


        {/* =================================================
            MAIN
        ================================================== */}

        <main className="flex min-h-screen flex-1 flex-col">

          {/* Header */}

          <header className="flex items-center justify-between border-b border-white/5 px-4 py-4 sm:px-6">

            <div>

              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#9CA3AF]">
                Private AI Workspace
              </p>

              <h2 className="mt-1 text-lg font-bold tracking-tight">
                Document Assistant
              </h2>

            </div>


            <button
              onClick={clearChat}
              className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-xs text-[#9CA3AF] transition hover:border-[#C084FC]/20 hover:text-white"
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </button>

          </header>


          {/* Upload status */}

          <AnimatePresence>

            {uploadStatus && (

              <motion.div
                initial={{
                  opacity: 0,
                  y: -10,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  y: -10,
                }}
                className="mx-auto w-full max-w-5xl px-4 pt-4 sm:px-6"
              >

                <div
                  className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
                    uploadStatus.type ===
                    "success"
                      ? "border-[#C084FC]/15 bg-[#131A2E] text-[#C084FC]"
                      : "border-red-400/15 bg-red-500/5 text-red-300"
                  }`}
                >

                  {uploadStatus.type ===
                  "success" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0" />
                  )}

                  {uploadStatus.message}

                </div>

              </motion.div>

            )}

          </AnimatePresence>


          {/* Hidden file input */}

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={handleFileSelect}
          />


          {/* Chat */}

          <section className="flex flex-1 flex-col">

            <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-32 pt-8 sm:px-6">

              <AiGlow />

              <div className="relative z-10 flex flex-1 flex-col">

                {/* Empty state */}

                {messages.length === 0 &&
                !isThinking ? (

                  <motion.div
                    initial={{
                      opacity: 0,
                      scale: 0.98,
                      y: 15,
                    }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                      y: 0,
                    }}
                    transition={{
                      duration: 0.5,
                    }}
                    className="flex flex-1 items-center justify-center"
                  >

                    <div className="max-w-2xl text-center">

                      <motion.div
                        className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#131A2E] ring-1 ring-[#C084FC]/20"
                        animate={{
                          boxShadow: [
                            "0 0 20px rgba(168,85,247,0.08)",
                            "0 0 55px rgba(168,85,247,0.22)",
                            "0 0 20px rgba(168,85,247,0.08)",
                          ],
                        }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                        }}
                      >

                        <Sparkles className="relative h-9 w-9 text-[#A855F7]" />

                      </motion.div>


                      <h3 className="text-3xl font-bold tracking-tight sm:text-4xl">
                        Your private AI workspace
                      </h3>


                      <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[#9CA3AF] sm:text-base">
                        {document
                          ? "Ask questions about your uploaded document and get grounded answers with sources."
                          : "Upload a PDF and start asking questions. Your document stays in your local RAG pipeline."}
                      </p>


                      <div className="mt-8 grid gap-3 text-left sm:grid-cols-3">

                        {[
                          "Summarize this document",
                          "List the important skills",
                          "Explain this section",
                        ].map((suggestion) => (

                          <button
                            key={suggestion}
                            onClick={() =>
                              setInput(
                                suggestion,
                              )
                            }
                            className="rounded-2xl border border-[#C084FC]/10 bg-[#131A2E]/90 px-4 py-4 text-sm text-[#D1D5DB] backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-[#C084FC]/25 hover:bg-[#171F37]"
                          >
                            {suggestion}
                          </button>

                        ))}

                      </div>

                    </div>

                  </motion.div>

                ) : (

                  <div className="space-y-6">

                    <AnimatePresence initial={false}>

                      {messages.map(
                        (message) => (

                          <motion.div
                            key={
                              message.id
                            }
                            initial={{
                              opacity: 0,
                              y: 10,
                              scale: 0.99,
                            }}
                            animate={{
                              opacity: 1,
                              y: 0,
                              scale: 1,
                            }}
                            transition={{
                              duration: 0.3,
                            }}
                          >

                            {message.role ===
                            "user" ? (

                              <div className="flex justify-end">

                                <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-[#A855F7] px-5 py-3.5 text-sm leading-7 text-white shadow-[0_10px_35px_rgba(168,85,247,0.16)]">
                                  {message.content}
                                </div>

                              </div>

                            ) : (

                              <div className="relative overflow-hidden rounded-[28px] border border-[#C084FC]/12 bg-[#131A2E]/80 p-[1px] backdrop-blur-xl">

                                <motion.div
                                  className="pointer-events-none absolute -inset-24 bg-[conic-gradient(from_0deg,transparent_0deg,rgba(168,85,247,0.18)_70deg,transparent_135deg,rgba(192,132,252,0.12)_210deg,transparent_300deg)]"
                                  animate={{
                                    rotate: [
                                      0,
                                      360,
                                    ],
                                  }}
                                  transition={{
                                    duration: 14,
                                    repeat:
                                      Infinity,
                                    ease: "linear",
                                  }}
                                />

                                <div className="relative rounded-[27px] bg-[#131A2E]/95 p-5">

                                  <div className="flex gap-3">

                                    <ThinkingOrb />

                                    <div className="min-w-0 flex-1">

                                      <p className="text-sm leading-7 text-white">
                                        {
                                          message.content
                                        }
                                      </p>


                                      {message
                                        .sources
                                        ?.length >
                                        0 && (

                                        <details className="mt-4">

                                          <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-[#C084FC]">

                                            <ChevronDown className="h-4 w-4" />

                                            Sources

                                          </summary>


                                          <div className="mt-2 space-y-2">

                                            {message.sources.map(
                                              (
                                                source,
                                              ) => (

                                                <div
                                                  key={`${source.file}-${source.page}`}
                                                  className="rounded-xl border border-white/5 bg-[#0F1423] px-3 py-2"
                                                >

                                                  <p className="text-xs font-medium text-white">
                                                    {
                                                      source.file
                                                    }
                                                  </p>

                                                  <p className="mt-0.5 text-[11px] text-[#9CA3AF]">
                                                    Page{" "}
                                                    {
                                                      source.page
                                                    }
                                                  </p>

                                                </div>

                                              ),
                                            )}

                                          </div>

                                        </details>

                                      )}

                                    </div>

                                  </div>

                                </div>

                              </div>

                            )}

                          </motion.div>

                        ),
                      )}

                    </AnimatePresence>


                    {/* Thinking */}

                    <AnimatePresence>

                      {isThinking && (

                        <motion.div
                          initial={{
                            opacity: 0,
                            y: 10,
                          }}
                          animate={{
                            opacity: 1,
                            y: 0,
                          }}
                          exit={{
                            opacity: 0,
                            y: -5,
                          }}
                          className="relative overflow-hidden rounded-[28px] border border-[#C084FC]/15 bg-[#131A2E]/80 p-[1px] backdrop-blur-xl"
                        >

                          <motion.div
                            className="absolute -inset-20 bg-[conic-gradient(from_0deg,transparent,rgba(168,85,247,0.22),transparent,rgba(192,132,252,0.18),transparent)]"
                            animate={{
                              rotate: [
                                0,
                                360,
                              ],
                            }}
                            transition={{
                              duration: 5,
                              repeat:
                                Infinity,
                              ease: "linear",
                            }}
                          />

                          <div className="relative flex items-center gap-3 rounded-[27px] bg-[#131A2E] px-5 py-5">

                            <ThinkingOrb />

                            <div>

                              <p className="text-sm font-medium text-white">
                                {isUploading
                                  ? "Indexing document"
                                  : "Thinking"}
                              </p>

                              <div className="mt-1 flex gap-1">

                                {[0, 1, 2].map(
                                  (dot) => (

                                    <motion.span
                                      key={dot}
                                      className="h-1.5 w-1.5 rounded-full bg-[#C084FC]"
                                      animate={{
                                        opacity: [
                                          0.25,
                                          1,
                                          0.25,
                                        ],
                                        y: [
                                          0,
                                          -3,
                                          0,
                                        ],
                                      }}
                                      transition={{
                                        duration: 1,
                                        repeat:
                                          Infinity,
                                        delay:
                                          dot *
                                          0.15,
                                      }}
                                    />

                                  ),
                                )}

                              </div>

                            </div>

                          </div>

                        </motion.div>

                      )}

                    </AnimatePresence>

                  </div>

                )}

              </div>

            </div>

          </section>


          {/* =================================================
              COMPOSER
          ================================================== */}

          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/5 bg-[#0B0F19]/85 backdrop-blur-xl">

            <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">

              <div className="relative overflow-hidden rounded-2xl border border-[#7C3AED]/30 bg-[#131A2E] p-2 shadow-[0_15px_50px_rgba(0,0,0,0.28)]">

                <motion.div
                  className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-[#A855F7]/10 to-transparent"
                  animate={{
                    x: [
                      "-120%",
                      "420%",
                    ],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />


                <div className="relative flex items-end gap-2">

                  {/* Real upload button */}

                  <button
                    onClick={openFilePicker}
                    disabled={isUploading}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#9CA3AF] transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    title="Upload PDF"
                  >

                    {isUploading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-[#C084FC]" />
                    ) : (
                      <Upload className="h-5 w-5" />
                    )}

                  </button>


                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(event) =>
                      setInput(
                        event.target.value,
                      )
                    }
                    onKeyDown={handleKeyDown}
                    placeholder="Ask your documents anything..."
                    rows={1}
                    disabled={isThinking}
                    className="max-h-32 min-h-11 flex-1 resize-none overflow-y-auto bg-transparent px-2 py-3 text-sm text-white outline-none placeholder:text-[#6B7280] disabled:cursor-not-allowed disabled:opacity-60"
                  />


                  <motion.button
                    onClick={sendMessage}
                    disabled={
                      !input.trim() ||
                      isThinking
                    }
                    whileHover={{
                      scale:
                        input.trim() &&
                        !isThinking
                          ? 1.05
                          : 1,
                    }}
                    whileTap={{
                      scale:
                        input.trim() &&
                        !isThinking
                          ? 0.95
                          : 1,
                    }}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#A855F7] text-white shadow-[0_0_22px_rgba(168,85,247,0.20)] transition disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[#B76AF8]"
                  >

                    <Send className="h-4 w-4" />

                  </motion.button>

                </div>

              </div>


              <p className="mt-2 text-center text-[11px] text-[#6B7280]">
                Secure RAG · Private document processing ·
                PDF up to 10 MB
              </p>

            </div>

          </div>

        </main>

      </div>
    </div>
  );
}

export default App;