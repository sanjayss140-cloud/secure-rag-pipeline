import React, { useRef, useEffect, useState } from "react";
import { Send, Upload, Sparkles, Copy, Check, FileText, ShieldAlert, ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function ThinkingOrb() {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="relative flex h-8 w-8 items-center justify-center">
        <motion.div
          className="absolute inset-0 rounded-full border border-[#C084FC]/30"
          animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
        />
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#131A2E] ring-1 ring-[#C084FC]/40 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
          <Sparkles className="h-3.5 w-3.5 text-[#C084FC] animate-pulse" />
        </div>
      </div>
      <div className="text-xs text-[#C084FC] font-medium animate-pulse">
        Analyzing private knowledge base & synthesizing answer...
      </div>
    </div>
  );
}

export default function ChatArea({
  messages,
  input,
  setInput,
  onSendMessage,
  isThinking,
  onOpenUpload,
  onUploadFiles,
  isUploading,
  docCount,
}) {
  const [copiedId, setCopiedId] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const composerFileInputRef = useRef(null);

  const handleComposerFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFiles?.(Array.from(e.target.files));
    }
    e.target.value = "";
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  const suggestedQuestions = [
    "What are the main topics discussed in the uploaded documents?",
    "Summarize the key findings and conclusions in bullet points.",
    "What specific database tables and schema rules are defined?",
  ];

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-[#0B0F19] relative overflow-hidden">
      {/* Background AI Glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-[#A855F7]/5 blur-[120px]" />
        <div className="absolute -right-32 top-1/4 h-96 w-96 rounded-full bg-[#C084FC]/5 blur-[120px]" />
      </div>

      {/* Knowledge Base Header Bar */}
      <div className="h-12 border-b border-white/5 bg-[#0D1220]/70 px-4 md:px-6 flex items-center justify-between shrink-0 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
            <FileText className="w-4 h-4 text-[#C084FC]" />
            <span className="hidden sm:inline">Active Knowledge Base:</span>
            <span className="font-semibold text-white">
              {docCount === 0 ? "No documents uploaded" : `${docCount} document${docCount > 1 ? "s" : ""} indexed`}
            </span>
          </div>
          {isUploading && (
            <span className="flex items-center gap-1.5 text-[11px] text-[#C084FC] animate-pulse bg-[#A855F7]/15 px-2.5 py-0.5 rounded-full border border-[#C084FC]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C084FC] animate-ping" />
              Indexing PDFs...
            </span>
          )}
        </div>

        <button
          onClick={onOpenUpload}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#A855F7]/20 to-[#7C3AED]/20 hover:from-[#A855F7]/30 hover:to-[#7C3AED]/30 text-[#C084FC] hover:text-white border border-[#C084FC]/30 text-xs font-semibold shadow-sm transition active:scale-95 cursor-pointer"
          title="Open Document Manager / Upload PDFs"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload Documents</span>
        </button>
      </div>

      {/* Messages Scroll View */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-12 px-4">
            <div className="w-14 h-14 rounded-2xl bg-[#A855F7]/10 ring-1 ring-[#C084FC]/25 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(168,85,247,0.15)]">
              <Sparkles className="w-7 h-7 text-[#C084FC]" />
            </div>

            <h2 className="text-xl font-bold text-white tracking-tight">
              Ask SecureRAG Assistant
            </h2>
            <p className="mt-2 text-xs md:text-sm text-[#9CA3AF] max-w-md leading-relaxed">
              Upload PDF documents to create your private isolated knowledge base.
              Every answer is evidence-grounded with precise page citations.
            </p>

            <button
              onClick={onOpenUpload}
              className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#7C3AED] hover:from-[#B76AF8] hover:to-[#8B5CF6] text-white text-xs font-semibold shadow-[0_0_20px_rgba(168,85,247,0.35)] transition cursor-pointer active:scale-95"
            >
              <Upload className="w-4 h-4" />
              {docCount === 0
                ? "Upload Your First Document"
                : `Manage & Upload Documents (${docCount})`}
            </button>

            {/* Suggested Prompts */}
            <div className="mt-8 w-full space-y-2">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-[#9CA3AF] text-left px-1">
                Suggested Prompts
              </p>
              {suggestedQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => setInput(q)}
                  className="w-full text-left p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-[#C084FC]/30 text-xs text-white/80 hover:text-white flex items-center justify-between group transition"
                >
                  <span className="truncate mr-2">{q}</span>
                  <ArrowUpRight className="w-4 h-4 text-white/30 group-hover:text-[#C084FC] transition shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.sender === "user" || msg.role === "user";
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3.5 max-w-3xl ${isUser ? "ml-auto" : "mr-auto"}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-[#A855F7]/15 ring-1 ring-[#C084FC]/30 flex items-center justify-center shrink-0 mt-1 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                    <Sparkles className="w-4 h-4 text-[#C084FC]" />
                  </div>
                )}

                <div
                  className={`rounded-2xl p-4 text-sm leading-relaxed ${
                    isUser
                      ? "bg-[#A855F7] text-white shadow-[0_0_25px_rgba(168,85,247,0.2)] rounded-tr-sm"
                      : "bg-[#131A2E] text-white/95 border border-white/5 shadow-lg rounded-tl-sm"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {/* Sources Pill Breakdown */}
                  {!isUser && msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3.5 pt-3 border-t border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] uppercase tracking-wider font-semibold text-[#9CA3AF]">
                          Source Citations ({msg.sources.length})
                        </span>
                        {msg.grounded && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                            ✓ Grounded Evidence
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {msg.sources.map((src, sIdx) => (
                          <div
                            key={sIdx}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-[11px] text-white/80"
                          >
                            <FileText className="w-3.5 h-3.5 text-[#C084FC]" />
                            <span className="font-medium truncate max-w-[180px]">{src.file}</span>
                            {src.page && (
                              <span className="text-[#C084FC] font-semibold">p. {src.page}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Controls for Assistant Messages */}
                  {!isUser && (
                    <div className="mt-3 pt-2 flex items-center justify-between border-t border-white/[0.04] text-[11px] text-[#9CA3AF]">
                      <span>{msg.confidence ? `Confidence: ${msg.confidence}` : "SecureRAG"}</span>
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="flex items-center gap-1 hover:text-white transition"
                        title="Copy text"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        )}

        {isThinking && <ThinkingOrb />}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer Input Bar */}
      <div className="p-3 sm:p-4 border-t border-white/5 bg-[#0D1220]/90 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto flex items-end gap-2 bg-[#131A2E] rounded-2xl border border-[#C084FC]/20 p-2 shadow-2xl focus-within:border-[#C084FC]/50 transition">
          <input
            ref={composerFileInputRef}
            type="file"
            multiple
            accept=".pdf"
            onChange={handleComposerFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => composerFileInputRef.current?.click()}
            title="Upload PDF documents"
            disabled={isUploading}
            className="p-2.5 rounded-xl text-white/50 hover:text-[#C084FC] hover:bg-white/5 transition shrink-0 cursor-pointer disabled:opacity-40"
          >
            <Upload className={`w-5 h-5 ${isUploading ? "animate-bounce text-[#C084FC]" : ""}`} />
          </button>

          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your uploaded documents..."
            className="flex-1 bg-transparent text-sm text-white placeholder-white/40 focus:outline-none resize-none py-2 px-1 max-h-36 scrollbar-thin"
          />

          <button
            onClick={onSendMessage}
            disabled={!input.trim() || isThinking}
            className="p-2.5 rounded-xl bg-[#A855F7] hover:bg-[#B76AF8] text-white disabled:opacity-40 disabled:hover:bg-[#A855F7] transition shadow-[0_0_15px_rgba(168,85,247,0.3)] shrink-0"
            aria-label="Send query"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <div className="text-center mt-2">
          <p className="text-[10px] text-white/40">
            SecureRAG defends against prompt injections & ensures all answers are grounded in private documents.
          </p>
        </div>
      </div>
    </div>
  );
}
