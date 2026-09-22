import React from "react";
import {
  Plus,
  MessageSquare,
  Trash2,
  X,
  Sparkles,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Sidebar({
  conversations = [],
  currentConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  docCount = 0,
  onOpenUpload,
  isMobileOpen,
  onCloseMobile,
  isCollapsed,
  onToggleCollapse,
  user,
  isAuthenticated,
  onOpenAuth,
  logout,
}) {
  return (
    <>
      {/* Mobile Backdrop Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCloseMobile}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-40 h-screen bg-[#130F22] border-r border-purple-900/20 flex flex-col justify-between transition-all duration-300 ease-in-out select-none ${
          isMobileOpen
            ? "translate-x-0 w-72"
            : "-translate-x-full lg:translate-x-0 " + (isCollapsed ? "lg:w-[72px]" : "lg:w-64")
        }`}
      >
        {/* Top Section: Branding, Action, Navigation */}
        <div className="p-3.5 flex flex-col flex-1 overflow-hidden">
          {/* Header Branding & Collapse Toggle */}
          <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-purple-900/20">
            {!isCollapsed ? (
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-bold text-base tracking-wide bg-gradient-to-r from-white via-purple-100 to-purple-300 bg-clip-text text-transparent truncate">
                  Mayandi AI
                </span>
                <span className="text-[10px] bg-purple-900/50 text-purple-300 font-bold px-1.5 py-0.5 rounded border border-purple-500/30">
                  PRO
                </span>
              </div>
            ) : (
              <div className="w-full flex justify-center">
                <span className="font-bold text-sm text-purple-300">M</span>
              </div>
            )}

            {/* Desktop Collapse Toggle */}
            <button
              onClick={onToggleCollapse}
              className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-[#A0A0CB] hover:text-white hover:bg-purple-500/10 transition"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            {/* Mobile Close Button */}
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-[#A0A0CB] hover:text-white hover:bg-purple-500/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Primary Action: New Chat Button */}
          <button
            onClick={() => {
              onNewChat();
              onCloseMobile?.();
            }}
            className={`w-full py-2.5 mb-3 bg-gradient-to-r from-[#9D4EDD] to-[#7B2CBF] hover:opacity-90 font-medium rounded-xl text-xs sm:text-sm text-white flex items-center justify-center gap-2 shadow-lg shadow-purple-900/40 active:scale-[0.98] transition cursor-pointer ${
              isCollapsed ? "px-0" : "px-3"
            }`}
            title="Start New Chat"
          >
            <Plus className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>New Chat</span>}
          </button>

          {/* Navigation Tabs */}
          <nav className="space-y-1 mb-4">
            <button
              onClick={() => {
                onCloseMobile?.();
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                !isCollapsed ? "justify-start" : "justify-center"
              } bg-purple-500/15 text-purple-200 border border-purple-500/25 shadow-sm`}
              title="Chat Assistant"
            >
              <MessageSquare className="w-4 h-4 text-purple-300 shrink-0" />
              {!isCollapsed && <span>Chat Assistant</span>}
            </button>

            <button
              onClick={() => {
                onOpenUpload();
                onCloseMobile?.();
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#A0A0CB] hover:bg-purple-500/10 hover:text-white transition cursor-pointer ${
                !isCollapsed ? "justify-between" : "justify-center"
              }`}
              title="Knowledge Base & Uploads"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <FolderOpen className="w-4 h-4 shrink-0 text-purple-400" />
                {!isCollapsed && <span className="truncate">Knowledge Base</span>}
              </div>
              {!isCollapsed && (
                <span className="text-[10px] bg-purple-900/40 text-purple-300 font-bold px-1.5 py-0.5 rounded-md border border-purple-500/20">
                  {docCount}
                </span>
              )}
            </button>
          </nav>

          {/* Chat History Section */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0 pt-2 border-t border-purple-900/15">
            {!isCollapsed && (
              <h3 className="text-[11px] font-semibold tracking-wider text-purple-400/70 uppercase px-2 mb-2">
                Chat History
              </h3>
            )}

            <div className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
              {conversations.length === 0 ? (
                !isCollapsed && (
                  <p className="px-2 py-4 text-xs text-[#A0A0CB]/50 text-center">
                    No chats yet. Ask a question!
                  </p>
                )
              ) : (
                conversations.map((c) => {
                  const isActive = c.id === currentConversationId;
                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        onSelectConversation(c.id);
                        onCloseMobile?.();
                      }}
                      className={`group relative flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition text-xs ${
                        isCollapsed ? "justify-center" : "justify-between"
                      } ${
                        isActive
                          ? "bg-purple-500/20 text-white font-medium border border-purple-500/30"
                          : "text-[#A0A0CB] hover:bg-purple-500/5 hover:text-white"
                      }`}
                      title={c.title || "Untitled Chat"}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <MessageSquare
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isActive ? "text-purple-300" : "text-purple-400/40 group-hover:text-purple-300"
                          }`}
                        />
                        {!isCollapsed && (
                          <span className="truncate">{c.title || "Untitled Chat"}</span>
                        )}
                      </div>

                      {!isCollapsed && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteConversation(c.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-[#A0A0CB] hover:text-red-400 transition"
                          title="Delete Chat"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer: User Profile / Auth Action */}
        <div className="p-3 border-t border-purple-900/20 bg-[#0E0A1A]">
          {isAuthenticated ? (
            <div className={`flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#9D4EDD] to-[#7B2CBF] flex items-center justify-center font-bold text-xs text-white shadow-inner shrink-0">
                  {user?.username?.charAt(0).toUpperCase() || "U"}
                </div>
                {!isCollapsed && (
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-white truncate max-w-[110px]">
                      {user?.username}
                    </span>
                    <span className="text-[10px] text-green-400 flex items-center gap-1">
                      ● <span className="text-[#A0A0CB]">{user?.role || "user"}</span>
                    </span>
                  </div>
                )}
              </div>
              {!isCollapsed && (
                <button
                  onClick={logout}
                  className="text-[#A0A0CB] hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className={`w-full py-2 px-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-[#A0A0CB] hover:text-white text-xs font-medium flex items-center ${
                isCollapsed ? "justify-center" : "justify-center gap-2"
              } transition cursor-pointer`}
              title="Sign In"
            >
              <UserIcon className="w-3.5 h-3.5 text-purple-300" />
              {!isCollapsed && <span>Sign In</span>}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
