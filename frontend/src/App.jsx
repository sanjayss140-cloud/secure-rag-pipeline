import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import DocumentDrawer from "./components/DocumentDrawer";
import AdminDashboard from "./components/AdminDashboard";
import AuthModal from "./components/AuthModal";
import Toast from "./components/Toast";
import {
  checkHealth,
  apiListDocuments,
  apiUploadDocuments,
  apiDeleteDocument,
  apiSendMessage,
  apiListConversations,
  apiGetConversation,
  apiDeleteConversation,
} from "./services/api";

function SecureRagMain() {
  const [currentView, setCurrentView] = useState("chat");
  const [isDocumentDrawerOpen, setIsDocumentDrawerOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  const [documents, setDocuments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);

  const [systemStatus, setSystemStatus] = useState("online");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [toast, setToast] = useState(null);

  const { user, isAuthenticated, isAdmin, logout, token } = useAuth();

  const showToast = (message, type = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Load health, documents & conversations
  useEffect(() => {
    async function init() {
      try {
        const health = await checkHealth();
        setSystemStatus(health.status);
      } catch {
        setSystemStatus("offline");
      }

      loadDocuments();
      loadConversations();
    }
    init();
  }, [token]);

  const loadDocuments = async () => {
    try {
      const data = await apiListDocuments();
      setDocuments(data.documents || []);
    } catch {
      // silently ignore if offline
    }
  };

  const loadConversations = async () => {
    try {
      const data = await apiListConversations();
      setConversations(data.conversations || []);
    } catch {
      setConversations([]);
    }
  };

  const handleSelectConversation = async (convId) => {
    setCurrentConversationId(convId);
    setCurrentView("chat");
    setIsAdminOpen(false);
    try {
      const data = await apiGetConversation(convId);
      setMessages(data.messages || []);
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleNewChat = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setInput("");
    setCurrentView("chat");
    setIsAdminOpen(false);
  };

  const handleDeleteConversation = async (convId) => {
    try {
      await apiDeleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (currentConversationId === convId) {
        handleNewChat();
      }
      showToast("Conversation deleted", "info");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleSendMessage = async () => {
    const text = input.trim();
    if (!text || isThinking) return;

    const userMsg = {
      id: crypto.randomUUID(),
      sender: "user",
      content: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsThinking(true);

    try {
      const data = await apiSendMessage(text, currentConversationId);
      if (data.conversation_id && !currentConversationId) {
        setCurrentConversationId(data.conversation_id);
        loadConversations();
      }

      const assistantMsg = {
        id: crypto.randomUUID(),
        sender: "assistant",
        content: data.answer,
        sources: data.sources || [],
        confidence: data.confidence,
        grounded: data.grounded,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errMsg = {
        id: crypto.randomUUID(),
        sender: "assistant",
        content: `⚠️ ${err.message}`,
        sources: [],
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
      showToast(err.message, "error");
    } finally {
      setIsThinking(false);
    }
  };

  const handleUploadFiles = async (files) => {
    if (!files || files.length === 0) return;

    const allowedExtensions = [
      ".pdf", ".docx", ".txt", ".md", ".csv", ".json", ".xml", ".yaml", ".yml",
      ".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff",
      ".py", ".js", ".jsx", ".ts", ".tsx", ".html", ".css", ".sql", ".log",
    ];

    const validFiles = files.filter((f) => {
      const ext = "." + f.name.split(".").pop().toLowerCase();
      return allowedExtensions.includes(ext);
    });

    if (validFiles.length === 0) {
      showToast("Supported: PDF, Word (.docx), Text/MD, Code, CSV/JSON, & Images (.png, .jpg, .webp).", "error");
      return;
    }

    setIsUploading(true);
    setUploadStatus(null);

    try {
      const data = await apiUploadDocuments(validFiles);
      setUploadStatus({
        type: "success",
        message: data.message || `Indexed ${validFiles.length} file(s) successfully!`,
      });
      showToast(data.message || `Indexed ${validFiles.length} file(s) successfully!`, "success");
      loadDocuments();
    } catch (err) {
      setUploadStatus({
        type: "error",
        message: err.message || "Failed to upload files.",
      });
      showToast(err.message, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (docId) => {
    try {
      await apiDeleteDocument(docId);
      showToast("Document removed from knowledge base", "info");
      loadDocuments();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#0B0813] font-sans text-white overflow-hidden selection:bg-[#9D4EDD]/30">
      {/* ======================================================================= */}
      {/* ZONE 1: UNIFIED, COLLAPSIBLE SIDEBAR                                    */}
      {/* ======================================================================= */}
      <Sidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        docCount={documents.length}
        onOpenUpload={() => setIsDocumentDrawerOpen(true)}
        isMobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        user={user}
        isAuthenticated={isAuthenticated}
        onOpenAuth={() => setAuthModalOpen(true)}
        logout={logout}
      />

      {/* ======================================================================= */}
      {/* ZONE 2 & 3: CENTRAL CANVAS & FLOATING COMPOSER                          */}
      {/* ======================================================================= */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <ChatArea
          messages={messages}
          input={input}
          setInput={setInput}
          onSendMessage={handleSendMessage}
          isThinking={isThinking}
          onOpenUpload={() => setIsDocumentDrawerOpen(true)}
          onUploadFiles={handleUploadFiles}
          isUploading={isUploading}
          docCount={documents.length}
          systemStatus={systemStatus}
          onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          onOpenAdmin={() => setIsAdminOpen(true)}
          isAdmin={isAdmin}
        />
      </main>

      {/* Slide-out Knowledge Base Document Drawer */}
      <AnimatePresence>
        {isDocumentDrawerOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDocumentDrawerOpen(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm cursor-pointer"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 220 }}
              className="relative z-10 w-full max-w-2xl h-full bg-[#130F22] border-l border-purple-900/30 shadow-2xl flex flex-col overflow-hidden"
            >
              <DocumentDrawer
                documents={documents}
                onUploadFiles={handleUploadFiles}
                onDeleteDocument={handleDeleteDocument}
                isUploading={isUploading}
                uploadStatus={uploadStatus}
                onClose={() => setIsDocumentDrawerOpen(false)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Metrics Overlay Modal */}
      <AnimatePresence>
        {isAdminOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdminOpen(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm cursor-pointer"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-10 w-full max-w-4xl max-h-[90vh] bg-[#130F22] border border-purple-900/40 rounded-2xl shadow-2xl overflow-y-auto p-6 scrollbar-thin"
            >
              <div className="flex justify-between items-center pb-4 mb-4 border-b border-purple-900/20">
                <h2 className="text-lg font-bold text-white">System & Analytics Metrics</h2>
                <button
                  onClick={() => setIsAdminOpen(false)}
                  className="px-3 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-[#A0A0CB] hover:text-white text-xs transition cursor-pointer"
                >
                  Close (ESC)
                </button>
              </div>
              <AdminDashboard />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Authentication Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={(msg) => showToast(msg, "success")}
      />

      {/* System Toast Alerts */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SecureRagMain />
    </AuthProvider>
  );
}