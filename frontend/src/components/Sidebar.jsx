import React from "react";
import { Plus, MessageSquare, Trash2, Shield, X, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Sidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  isOpen,
  onClose,
}) {
  return (
    <>
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-40 w-[280px] sm:w-[300px] border-r border-white/5 bg-[#0D1220] flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Mobile Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5 lg:hidden">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#C084FC]" />
            <span className="text-sm font-bold text-white">Conversations</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-4">
          <button
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#8B5CF6] hover:from-[#B76AF8] hover:to-[#9333EA] text-white text-sm font-semibold shadow-[0_0_25px_rgba(168,85,247,0.25)] transition group"
          >
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-3 space-y-1 scrollbar-thin">
          <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
            Chat History
          </div>

          {conversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-white/40">
              No conversations yet. Start asking questions!
            </div>
          ) : (
            conversations.map((c) => {
              const isActive = c.id === currentConversationId;
              return (
                <div
                  key={c.id}
                  className={`group relative flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition text-xs ${
                    isActive
                      ? "bg-[#131A2E] text-white border border-[#C084FC]/25 shadow-[0_0_15px_rgba(168,85,247,0.08)]"
                      : "text-white/70 hover:bg-white/[0.03] hover:text-white"
                  }`}
                  onClick={() => {
                    onSelectConversation(c.id);
                    onClose();
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MessageSquare
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? "text-[#C084FC]" : "text-white/40 group-hover:text-white/70"
                      }`}
                    />
                    <span className="truncate font-medium">{c.title || "Untitled Chat"}</span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(c.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-white/40 hover:text-rose-400 hover:bg-white/5 transition"
                    title="Delete chat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Security Badge in Footer */}
        <div className="p-4 border-t border-white/5 bg-[#0A0E1A]">
          <div className="flex items-center gap-2.5 text-xs text-[#9CA3AF]">
            <div className="p-1.5 rounded-lg bg-[#A855F7]/10 text-[#C084FC]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="font-medium text-white text-[11px]">Private Vector Store</p>
              <p className="text-[10px] text-white/40">Local FAISS Isolated Engine</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
