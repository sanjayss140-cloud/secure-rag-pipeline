import React, { useRef, useEffect, useState } from "react";
import {
  Send,
  Sparkles,
  Copy,
  Check,
  FileText,
  Paperclip,
  Info,
  Menu,
  BarChart3,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function ThinkingOrb() {
  return (
    <div className="flex items-center gap-3 py-3 px-2">
      <div className="relative flex h-7 w-7 items-center justify-center">
        <motion.div
          className="absolute inset-0 rounded-full border border-purple-400/40"
          animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
        />
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#130F22] ring-1 ring-purple-500/40 shadow-[0_0_15px_rgba(157,78,221,0.3)]">
          <Sparkles className="h-3 w-3 text-purple-300 animate-pulse" />
        </div>
      </div>
      <div className="text-xs text-purple-300 font-medium animate-pulse">
        Searching documents & synthesizing answer...
      </div>
    </div>
  );
}

function formatInline(str) {
  if (!str) return str;
  const parts = [];
  const regex = /(\*\*.*?\*\*|`.*?`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(str)) !== null) {
    if (match.index > lastIndex) {
      parts.push(str.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={match.index} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={match.index}
          className="px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-500/20 font-mono text-xs text-purple-200"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < str.length) {
    parts.push(str.substring(lastIndex));
  }

  return parts.length > 0 ? parts : str;
}

function renderFormattedContent(text) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <div className="space-y-2">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        if (trimmed.startsWith("### ")) {
          return (
            <h3 key={idx} className="text-sm font-bold text-purple-300 pt-1 flex items-center gap-1.5">
              {trimmed.replace(/^###\s+/, "")}
            </h3>
          );
        }

        if (trimmed.startsWith("## ")) {
          return (
            <h2 key={idx} className="text-base font-bold text-white pt-1">
              {trimmed.replace(/^##\s+/, "")}
            </h2>
          );
        }

        if (trimmed.startsWith("> ")) {
          return (
            <blockquote
              key={idx}
              className="border-l-2 border-purple-500/60 pl-3 py-1 bg-purple-950/20 rounded-r-lg text-purple-200/90 italic text-xs leading-relaxed"
            >
              {formatInline(trimmed.replace(/^>\s+/, ""))}
            </blockquote>
          );
        }

        if (trimmed.startsWith("• ") || trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1 text-sm text-purple-100">
              <span className="text-purple-400 font-bold mt-1 text-xs">•</span>
              <span className="flex-1">{formatInline(trimmed.replace(/^[•\-\*]\s+/, ""))}</span>
            </div>
          );
        }

        return (
          <p key={idx} className="text-sm leading-relaxed text-purple-100 font-light">
            {formatInline(line)}
          </p>
        );
      })}
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
  docCount = 0,
  systemStatus = "online",
  onToggleMobileSidebar,
  onOpenAdmin,
  isAdmin = false,
}) {
  const [copiedId, setCopiedId] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFiles?.(Array.from(e.target.files));
    }
    e.target.value = "";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadFiles?.(Array.from(e.dataTransfer.files));
    }
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

  const promptSuggestions = [
    "What are the main topics discussed in the uploaded documents?",
    "Summarize the key findings and conclusions in concise bullet points.",
    "Explain the key definitions and data points extracted from the files.",
  ];

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex-1 flex flex-col h-screen bg-[#0B0813] relative overflow-hidden select-text"
    >
      {/* Drag & Drop Overlay */}
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-[#0B0813]/90 backdrop-blur-md flex flex-col items-center justify-center p-6 border-2 border-dashed border-purple-500/50 m-4 rounded-3xl"
          >
            <div className="w-16 h-16 rounded-2xl bg-purple-900/40 border border-purple-500/40 flex items-center justify-center mb-4 shadow-xl">
              <Paperclip className="w-8 h-8 text-purple-300" />
            </div>
            <h3 className="text-lg font-bold text-white">Drop files to upload & index</h3>
            <p className="text-xs text-[#A0A0CB] mt-1">
              Supports PDFs, Word documents, Markdown, Code, CSV, and Images (OCR)
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======================================================================= */}
      {/* ZONE 2 (TOP): MINIMAL NAVBAR ROW                                       */}
      {/* ======================================================================= */}
      <header className="h-14 px-4 sm:px-8 border-b border-purple-900/20 flex items-center justify-between bg-[#0B0813]/80 backdrop-blur-md z-10 shrink-0">
        {/* Left: Mobile Toggle & Knowledge Status */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMobileSidebar}
            className="lg:hidden p-1.5 rounded-lg text-[#A0A0CB] hover:text-white hover:bg-purple-500/10 transition"
            title="Open Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div
            onClick={onOpenUpload}
            className="flex items-center gap-2 text-xs text-[#A0A0CB] hover:text-white transition cursor-pointer group"
            title="Click to view & upload knowledge base documents"
          >
            <span className="text-sm">📄</span>
            <span className="hidden sm:inline">Active Knowledge Base:</span>
            <span className="text-purple-300 font-semibold group-hover:underline">
              {docCount === 0 ? "0 documents" : `${docCount} document${docCount > 1 ? "s" : ""} indexed`}
            </span>
          </div>

          {isUploading && (
            <span className="flex items-center gap-1.5 text-[10px] text-purple-300 bg-purple-900/30 px-2 py-0.5 rounded-full border border-purple-500/30 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
              Indexing...
            </span>
          )}
        </div>

        {/* Right: Admin Link & System Status */}
        <div className="flex items-center gap-3 sm:gap-4">
          {isAdmin && (
            <button
              onClick={onOpenAdmin}
              className="text-xs text-[#A0A0CB] hover:text-purple-300 transition-all font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Admin Metrics</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#130F22] border border-purple-900/30 text-[11px]">
            <span
              className={`w-2 h-2 rounded-full ${
                systemStatus === "online" || systemStatus === "healthy"
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse"
                  : "bg-amber-400"
              }`}
            />
            <span className="text-[#A0A0CB] text-[10px] capitalize hidden sm:inline">
              {systemStatus || "online"}
            </span>
          </div>
        </div>
      </header>

      {/* ======================================================================= */}
      {/* ZONE 2 (CENTER): SCROLLABLE CHAT CANVAS                                */}
      {/* ======================================================================= */}
      <section className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 space-y-6 max-w-4xl mx-auto w-full flex flex-col">
        {messages.length === 0 ? (
          <div className="my-auto flex flex-col items-center justify-center text-center py-4 px-4 max-w-lg mx-auto w-full">
            {/* Minimal Pro Hero Icon */}
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-900/40 to-[#130F22] border border-purple-500/30 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(157,78,221,0.2)]">
              <Sparkles className="w-7 h-7 text-purple-300" />
            </div>

            <h2 className="text-xl font-bold text-white tracking-tight">
              Mayandi AI Assistant
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-[#A0A0CB] leading-relaxed">
              Private document intelligence powered by local vector retrieval. Ask questions, extract data,
              and receive evidence-grounded answers.
            </p>

            {/* Prompt Starter Cards */}
            <div className="mt-8 w-full space-y-2 text-left">
              <p className="text-[11px] font-semibold tracking-wider text-purple-400/70 uppercase px-1">
                Suggested Starters
              </p>
              {promptSuggestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => setInput(q)}
                  className="w-full text-left p-3 rounded-xl bg-[#130F22] hover:bg-[#1a1430] border border-purple-900/30 hover:border-purple-500/40 text-xs text-[#A0A0CB] hover:text-white flex items-center justify-between group transition cursor-pointer"
                >
                  <span className="truncate mr-2">{q}</span>
                  <ArrowUpRight className="w-4 h-4 text-purple-400/40 group-hover:text-purple-300 transition shrink-0" />
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
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`w-full flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                {isUser ? (
                  /* User Bubble Node: Right-aligned, sleek purple gradient, rounded-tr-none */
                  <div className="max-w-[85%] sm:max-w-[75%] bg-gradient-to-br from-[#7B2CBF]/40 to-[#9D4EDD]/25 border border-purple-500/20 px-4 py-3 rounded-2xl rounded-tr-none text-sm text-purple-50 shadow-md leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </div>
                ) : (
                  /* Bot Bubble Node: Borderless typography resting directly on primary canvas */
                  <div className="flex gap-3.5 max-w-[95%] sm:max-w-[85%] items-start">
                    <div className="w-8 h-8 rounded-xl bg-[#130F22] border border-purple-500/30 flex items-center justify-center text-sm shadow-sm shrink-0 mt-0.5">
                      <Sparkles className="w-4 h-4 text-purple-300" />
                    </div>

                    <div className="flex-1 space-y-3">
                      {/* Text Body */}
                      <div className="text-sm text-purple-100 leading-relaxed font-light">
                        {renderFormattedContent(msg.content)}
                      </div>

                      {/* Smart Citation Drawer / List Section */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="pt-2 border-t border-purple-900/20">
                          <div className="text-[11px] font-semibold text-purple-400/80 tracking-wide uppercase mb-2 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                            <span>Source Grounding Citations ({msg.sources.length})</span>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {msg.sources.map((src, sIdx) => (
                              <span
                                key={sIdx}
                                className="flex items-center gap-1.5 text-xs bg-[#130F22] hover:bg-[#1a1430] text-purple-200 px-3 py-1.5 rounded-lg border border-purple-500/20 transition-all cursor-pointer shadow-sm"
                                title={`Grounded source: ${src.file}${src.page ? ` (Page ${src.page})` : ""}`}
                              >
                                <FileText className="w-3.5 h-3.5 text-purple-300" />
                                <span className="truncate max-w-[170px] font-medium">{src.file}</span>
                                {src.page && (
                                  <span className="text-purple-400 font-semibold text-[11px]">
                                    (p.{src.page})
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Footer micro-actions: Confidence & Copy button */}
                      <div className="flex items-center justify-between text-[11px] text-[#A0A0CB]/70 pt-1">
                        <span>{msg.confidence ? `Confidence: ${msg.confidence}` : "Mayandi AI"}</span>
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="flex items-center gap-1 hover:text-white transition cursor-pointer"
                          title="Copy Answer"
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
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })
        )}

        {isThinking && <ThinkingOrb />}
        <div ref={messagesEndRef} />
      </section>

      {/* ======================================================================= */}
      {/* ZONE 3: FLOATING COMPOSER UNIT (BOTTOM CENTER)                          */}
      {/* ======================================================================= */}
      <div className="px-4 sm:px-8 pb-5 pt-2 shrink-0">
        <div className="max-w-3xl mx-auto relative">
          {/* Floating Pill Box */}
          <div className="flex items-end gap-2 bg-[#130F22]/95 backdrop-blur-xl border border-purple-500/30 hover:border-purple-500/50 focus-within:border-purple-500/80 rounded-2xl p-2.5 shadow-[0_10px_35px_rgba(0,0,0,0.6)] transition-all">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md,.csv,.json,.py,.js,.png,.jpg,.jpeg,.webp"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Left inside slot: File attachment button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="p-2 rounded-xl text-[#A0A0CB] hover:text-purple-300 hover:bg-purple-500/10 transition shrink-0 cursor-pointer disabled:opacity-40"
              title="Attach documents or images"
            >
              <Paperclip className={`w-4 h-4 ${isUploading ? "animate-spin text-purple-300" : ""}`} />
            </button>

            {/* Left inside slot: Info Tooltip (i) */}
            <div className="relative shrink-0 flex items-center">
              <button
                type="button"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onClick={() => setShowTooltip(!showTooltip)}
                className="p-2 rounded-xl text-[#A0A0CB] hover:text-purple-300 hover:bg-purple-500/10 transition"
                title="System Security Information"
              >
                <Info className="w-4 h-4" />
              </button>

              <AnimatePresence>
                {showTooltip && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute bottom-11 left-0 z-30 w-64 p-2.5 rounded-xl bg-[#0B0813] border border-purple-500/30 text-[11px] text-[#A0A0CB] shadow-xl pointer-events-none leading-relaxed"
                  >
                    <p className="font-semibold text-white mb-0.5">SecureRAG Shield Active</p>
                    Defends against prompt injections and ensures answers are grounded directly in your uploaded files.
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Textarea Input */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your documents..."
              className="flex-1 bg-transparent text-sm text-white placeholder-[#A0A0CB]/70 focus:outline-none resize-none py-2 px-1 max-h-36 scrollbar-thin leading-relaxed"
            />

            {/* Right inside slot: Neon Circular Action Button (>) */}
            <button
              onClick={onSendMessage}
              disabled={!input.trim() || isThinking}
              className={`p-2.5 rounded-xl transition-all shrink-0 cursor-pointer shadow-md ${
                input.trim() && !isThinking
                  ? "bg-gradient-to-r from-[#9D4EDD] to-[#7B2CBF] text-white shadow-purple-900/50 active:scale-95"
                  : "bg-purple-950/40 text-purple-400/40 cursor-not-allowed"
              }`}
              title="Send Message (Enter)"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
