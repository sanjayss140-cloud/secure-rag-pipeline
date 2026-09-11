import React from "react";
import { Shield, Sparkles, LogOut, User as UserIcon, BarChart3, Files, MessageSquare, Menu, Upload } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";

export default function Navbar({
  currentView,
  setCurrentView,
  onOpenAuth,
  onOpenUpload,
  systemStatus,
  docCount,
  onToggleMobileSidebar,
}) {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();

  return (
    <header className="h-16 border-b border-white/5 bg-[#0D1220]/80 backdrop-blur-xl px-4 lg:px-6 flex items-center justify-between z-30 sticky top-0">
      {/* Brand & Mobile Hamburger */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileSidebar}
          className="lg:hidden p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setCurrentView("chat")}>
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[#A855F7]/15 ring-1 ring-[#C084FC]/30">
            <motion.div
              className="absolute inset-0 rounded-xl bg-[#A855F7]/20 blur-sm"
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            />
            <Shield className="relative h-5 w-5 text-[#C084FC]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tracking-tight text-white">SecureRAG</span>
              <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-[#A855F7]/20 text-[#C084FC] border border-[#C084FC]/20">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-[#9CA3AF] hidden sm:block">Private Document Intelligence</p>
          </div>
        </div>
      </div>

      {/* Nav Tabs */}
      <nav className="hidden md:flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/5">
        <button
          onClick={() => setCurrentView("chat")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
            currentView === "chat"
              ? "bg-[#A855F7] text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]"
              : "text-white/70 hover:text-white hover:bg-white/5"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Chat Assistant
        </button>

        <button
          onClick={() => setCurrentView("documents")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
            currentView === "documents"
              ? "bg-[#A855F7] text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]"
              : "text-white/70 hover:text-white hover:bg-white/5"
          }`}
        >
          <Files className="w-3.5 h-3.5" />
          Knowledge Base ({docCount})
        </button>

        {isAdmin && (
          <button
            onClick={() => setCurrentView("admin")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
              currentView === "admin"
                ? "bg-[#A855F7] text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Admin Metrics
          </button>
        )}
      </nav>

      {/* User Actions & System Pill */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Prominent Upload Documents Button */}
        <button
          onClick={onOpenUpload}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#7C3AED] hover:from-[#B76AF8] hover:to-[#8B5CF6] text-white text-xs font-semibold shadow-[0_0_20px_rgba(168,85,247,0.35)] transition shrink-0 active:scale-95"
          title="Upload PDF documents to knowledge base"
        >
          <Upload className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Upload Documents</span>
          <span className="sm:hidden">Upload</span>
        </button>

        {/* System Pill */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#131A2E] border border-white/5 text-[11px]">
          <span
            className={`w-2 h-2 rounded-full ${
              systemStatus === "online" || systemStatus === "healthy" ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
            }`}
          />
          <span className="text-[#9CA3AF] capitalize">{systemStatus || "checking..."}</span>
        </div>

        {isAuthenticated ? (
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white/[0.04] border border-white/5">
              <div className="w-6 h-6 rounded-full bg-[#A855F7]/20 flex items-center justify-center text-[11px] font-bold text-[#C084FC]">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-medium text-white leading-tight">{user?.username}</p>
                <p className="text-[10px] text-[#A855F7] leading-tight font-semibold">{user?.role}</p>
              </div>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-rose-500/10 text-white/60 hover:text-rose-400 border border-white/5 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#7C3AED] hover:from-[#B76AF8] hover:to-[#8B5CF6] text-white text-xs font-semibold shadow-[0_0_20px_rgba(168,85,247,0.25)] transition"
          >
            <UserIcon className="w-3.5 h-3.5" />
            Sign In
          </button>
        )}
      </div>
    </header>
  );
}
