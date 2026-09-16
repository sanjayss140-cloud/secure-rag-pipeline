import React, { useRef, useState } from "react";
import { Upload, FileText, Trash2, CheckCircle2, AlertCircle, Loader2, X, HardDrive, Layers, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function DocumentDrawer({
  documents,
  onUploadFiles,
  onDeleteDocument,
  isUploading,
  uploadStatus,
  onClose,
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

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
      onUploadFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFiles(Array.from(e.target.files));
    }
    e.target.value = "";
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div className="flex items-start justify-between sm:block">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Knowledge Base Documents & Files</h2>
            <p className="text-xs text-[#9CA3AF] mt-1">
              Upload, manage, and index PDFs, Word docs, text files, code, and images. Content and OCR text are automatically embedded into your private FAISS store.
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="sm:hidden p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#A855F7] hover:bg-[#B76AF8] text-white text-xs font-semibold shadow-[0_0_20px_rgba(168,85,247,0.3)] transition disabled:opacity-50 shrink-0 cursor-pointer"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span>Upload Files</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 text-xs font-medium transition cursor-pointer"
              title="Close drawer"
            >
              <X className="w-4 h-4" />
              <span>Close</span>
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md,.csv,.json,.xml,.yaml,.yml,.png,.jpg,.jpeg,.webp,.bmp,.tiff,.py,.js,.html,.css,.sql,.log"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Drag and Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${
          isDragOver
            ? "border-[#C084FC] bg-[#A855F7]/10"
            : "border-white/10 hover:border-[#C084FC]/40 bg-white/[0.01] hover:bg-white/[0.03]"
        }`}
      >
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#A855F7]/10 text-[#C084FC] flex items-center justify-center">
            {isUploading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Upload className="w-6 h-6" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              {isUploading ? "Extracting, embedding & indexing files..." : "Click or drag & drop files here"}
            </p>
            <p className="text-xs text-[#9CA3AF] mt-1">
              Supports PDFs, Word (.docx), Text/MD, Code, CSV/JSON, & Images (OCR) up to 10 MB each.
            </p>
          </div>
        </div>
      </div>

      {/* Upload Status Banner */}
      {uploadStatus && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-3 text-xs ${
            uploadStatus.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/20 text-rose-300"
          }`}
        >
          {uploadStatus.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          )}
          <span>{uploadStatus.message}</span>
        </div>
      )}

      {/* Document Grid / Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">
            Indexed Files ({documents.length})
          </h3>
        </div>

        {documents.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-white/5 bg-white/[0.01]">
            <FileText className="w-8 h-8 text-white/20 mx-auto mb-3" />
            <p className="text-sm text-white/60 font-medium">No documents uploaded yet</p>
            <p className="text-xs text-white/30 mt-1">
              Upload documents above to begin querying with SecureRAG.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documents.map((doc) => (
              <motion.div
                key={doc.document_id || doc.filename}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl border border-white/5 hover:border-[#C084FC]/30 bg-[#131A2E]/80 backdrop-blur-md transition group shadow-lg flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#A855F7]/15 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-[#C084FC]" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-white truncate" title={doc.filename}>
                          {doc.filename}
                        </h4>
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 mt-0.5">
                          <CheckCircle2 className="w-3 h-3" />
                          Indexed & Ready
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => onDeleteDocument(doc.document_id || doc.filename)}
                      className="p-2 rounded-lg text-white/30 hover:text-rose-400 hover:bg-rose-500/10 transition"
                      title="Delete document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Metadata Chips */}
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-white/5 text-[11px] text-[#9CA3AF]">
                    <div className="flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-white/40" />
                      <span>{doc.size_mb} MB</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-white/40" />
                      <span>{doc.page_count || "-"} Pages</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-white/40" />
                      <span>{doc.chunk_count || "-"} Chunks</span>
                    </div>
                  </div>
                </div>

                {doc.uploaded_at && (
                  <div className="mt-3 flex items-center gap-1 text-[10px] text-white/30">
                    <Calendar className="w-3 h-3" />
                    <span>Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}</span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
