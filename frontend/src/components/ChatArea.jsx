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
  X,
  RotateCw,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiUploadDocuments } from "../services/api";

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
  const [attachments, setAttachments] = useState([]);
  const [activeEvidence, setActiveEvidence] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const uploadSingleAttachment = async (attachmentId, file) => {
    try {
      setAttachments((prev) =>
        prev.map((a) => (a.id === attachmentId ? { ...a, status: "uploading", errorMsg: null } : a))
      );
      const res = await apiUploadDocuments([file]);
      const docId = res?.uploaded?.[0]?.document_id || attachmentId;
      setAttachments((prev) =>
        prev.map((a) => (a.id === attachmentId ? { ...a, status: "ready", doc_id: docId } : a))
      );
    } catch (err) {
      setAttachments((prev) =>
        prev.map((a) =>
          a.id === attachmentId
            ? { ...a, status: "error", errorMsg: err.message || "Failed to index" }
            : a
        )
      );
    }
  };

  const handleFilesAttached = (files) => {
    const newItems = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      name: file.name,
      size: (file.size / 1024).toFixed(1) + " KB",
      status: "uploading",
      doc_id: null,
      errorMsg: null,
    }));
    setAttachments((prev) => [...prev, ...newItems]);
    newItems.forEach((item) => uploadSingleAttachment(item.id, item.file));
  };

  const handleRemoveAttachment = (id) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleRetryAttachment = (id) => {
    const item = attachments.find((a) => a.id === id);
    if (item) {
      uploadSingleAttachment(id, item.file);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesAttached(Array.from(e.target.files));
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
      handleFilesAttached(Array.from(e.dataTransfer.files));
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

  const hasUploadingAttachments = attachments.some((a) => a.status === "uploading");

  const handleSubmit = () => {
    if (hasUploadingAttachments || isThinking) return;
    const trimmed = input.trim();
    if (!trimmed && attachments.length === 0) return;
    const readyDocIds = attachments.filter((a) => a.status === "ready" && a.doc_id).map((a) => a.doc_id);
    onSendMessage(trimmed, readyDocIds.length > 0 ? readyDocIds : null);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!hasUploadingAttachments && !isThinking) {
        handleSubmit();
      }
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
                              <button
                                key={sIdx}
                                type="button"
                                onClick={() => setActiveEvidence(src)}
                                className="flex items-center gap-1.5 text-xs bg-[#130F22] hover:bg-[#1f173b] hover:border-purple-400 text-purple-200 px-3 py-1.5 rounded-lg border border-purple-500/20 transition-all cursor-pointer shadow-sm group"
                                title="Click to inspect page snippet & grounding evidence"
                              >
                                <FileText className="w-3.5 h-3.5 text-purple-300 group-hover:text-purple-200" />
                                <span className="truncate max-w-[170px] font-medium">{src.file}</span>
                                {src.page && (
                                  <span className="text-purple-400 font-semibold text-[11px] group-hover:text-purple-300">
                                    (p.{src.page})
                                  </span>
                                )}
                                <span className="text-[10px] bg-purple-900/40 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30 ml-1">
                                  View Evidence
                                </span>
                              </button>
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
          {/* ChatGPT-style Attachment Chips */}
          <AnimatePresence>
            {attachments.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="flex flex-wrap gap-2 mb-2 px-1"
              >
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs border backdrop-blur-md transition-all ${
                      att.status === "uploading"
                        ? "bg-purple-950/40 border-purple-500/40 text-purple-200 animate-pulse"
                        : att.status === "error"
                        ? "bg-rose-950/40 border-rose-500/40 text-rose-200"
                        : "bg-[#130F22] border-emerald-500/40 text-emerald-200 shadow-sm"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate max-w-[140px] font-medium" title={att.name}>
                      {att.name}
                    </span>
                    <span className="text-[10px] opacity-70">({att.size})</span>

                    {att.status === "uploading" && (
                      <span className="flex items-center gap-1 text-[10px] text-purple-300 font-semibold">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Indexing...
                      </span>
                    )}

                    {att.status === "ready" && (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                        <Check className="w-3 h-3" />
                        Ready
                      </span>
                    )}

                    {att.status === "error" && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-rose-400" title={att.errorMsg}>
                          Error
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRetryAttachment(att.id)}
                          className="p-0.5 hover:text-white"
                          title="Retry indexing"
                        >
                          <RotateCw className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.id)}
                      className="p-0.5 hover:text-white transition ml-0.5"
                      title="Remove attachment"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

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
              disabled={hasUploadingAttachments}
              className="p-2 rounded-xl text-[#A0A0CB] hover:text-purple-300 hover:bg-purple-500/10 transition shrink-0 cursor-pointer disabled:opacity-40"
              title="Attach documents or images"
            >
              <Paperclip className={`w-4 h-4 ${hasUploadingAttachments ? "animate-spin text-purple-300" : ""}`} />
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
              placeholder={
                hasUploadingAttachments
                  ? "Indexing attachments... Send locked"
                  : "Ask anything about your documents..."
              }
              className="flex-1 bg-transparent text-sm text-white placeholder-[#A0A0CB]/70 focus:outline-none resize-none py-2 px-1 max-h-36 scrollbar-thin leading-relaxed"
            />

            {/* Right inside slot: Neon Circular Action Button (>) */}
            <button
              onClick={handleSubmit}
              disabled={(!input.trim() && attachments.length === 0) || isThinking || hasUploadingAttachments}
              className={`p-2.5 rounded-xl transition-all shrink-0 cursor-pointer shadow-md ${
                (input.trim() || attachments.length > 0) && !isThinking && !hasUploadingAttachments
                  ? "bg-gradient-to-r from-[#9D4EDD] to-[#7B2CBF] text-white shadow-purple-900/50 active:scale-95"
                  : "bg-purple-950/40 text-purple-400/40 cursor-not-allowed"
              }`}
              title={
                hasUploadingAttachments
                  ? "Please wait for attachments to finish indexing..."
                  : "Send Message (Enter)"
              }
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* EVIDENCE GROUNDING MODAL (ITEM 11)                                     */}
      {/* ======================================================================= */}
      <AnimatePresence>
        {activeEvidence && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setActiveEvidence(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-[#0e0a1b] border border-purple-500/40 rounded-2xl max-w-lg w-full p-5 shadow-2xl relative text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-purple-900/40 mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-purple-900/40 border border-purple-500/30">
                    <ShieldCheck className="w-4 h-4 text-purple-300" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Document Grounding Evidence</h3>
                    <p className="text-[11px] text-[#A0A0CB]">Direct snippet retrieved for this citation</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveEvidence(null)}
                  className="p-1 rounded-lg hover:bg-purple-900/40 text-purple-300/70 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Metadata Badges */}
              <div className="flex flex-wrap gap-2 mb-3 text-xs">
                <span className="px-2.5 py-1 rounded-md bg-purple-950/60 border border-purple-800/40 text-purple-200 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-purple-400" />
                  <strong className="text-white">{activeEvidence.file}</strong>
                </span>
                {activeEvidence.page && (
                  <span className="px-2.5 py-1 rounded-md bg-purple-900/40 border border-purple-600/40 text-purple-300 font-semibold">
                    Page {activeEvidence.page}
                  </span>
                )}
                <span className="px-2.5 py-1 rounded-md bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 font-medium">
                  {activeEvidence.confidence ? `${Math.round(activeEvidence.confidence * 100)}% Match` : "High Confidence"}
                </span>
              </div>

              {/* Exact Extracted Snippet */}
              <div className="bg-[#07050d] rounded-xl p-3 border border-purple-900/30 max-h-60 overflow-y-auto scrollbar-thin">
                <div className="text-[10px] uppercase font-bold text-purple-400 tracking-wider mb-1.5">
                  Extracted Document Text
                </div>
                <p className="text-xs text-purple-100 font-mono leading-relaxed whitespace-pre-wrap select-text">
                  {activeEvidence.snippet || activeEvidence.text || "Direct passage verified and indexed from page contents."}
                </p>
              </div>

              {/* Footer */}
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveEvidence(null)}
                  className="px-4 py-1.5 rounded-lg bg-purple-800 hover:bg-purple-700 text-xs font-medium text-white transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
