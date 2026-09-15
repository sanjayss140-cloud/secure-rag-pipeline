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
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  const [documents, setDocuments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);

  const [systemStatus, setSystemStatus] = useState("checking");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const { isAuthenticated, token } = useAuth();

  const showToast = (message, type = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Load health & documents on mount and token change
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
      // silently ignore if unauthenticated or offline
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

    // Filter PDF only
    const pdfFiles = files.filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (pdfFiles.length === 0) {
      showToast("Only PDF documents are supported.", "error");
      return;
    }

    setIsUploading(true);
    setUploadStatus(null);

    try {
      const data = await apiUploadDocuments(pdfFiles);
      setUploadStatus({
        type: "success",
        message: data.message || `Indexed ${pdfFiles.length} document(s) successfully!`,
      });
      showToast(data.message, "success");
      loadDocuments();
    } catch (err) {
      setUploadStatus({
        type: "error",
        message: err.message || "Failed to upload documents.",
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
    <div className="min-h-screen bg-[#0B0F19] text-white flex flex-col font-sans selection:bg-[#A855F7]/30">
      <Navbar
        currentView={currentView}
        setCurrentView={setCurrentView}
        onOpenAuth={() => setAuthModalOpen(true)}
        onOpenUpload={() => setIsDocumentDrawerOpen(true)}
        systemStatus={systemStatus}
        docCount={documents.length}
        onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          conversations={conversations}
          currentConversationId={currentConversationId}
          onSelectConversation={handleSelectConversation}
          onNewChat={handleNewChat}
          onDeleteConversation={handleDeleteConversation}
          docCount={documents.length}
          onOpenUpload={() => setIsDocumentDrawerOpen(true)}
          isOpen={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
        />

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {currentView === "chat" && (
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
            />
          )}

          {currentView === "documents" && (
            <DocumentDrawer
              documents={documents}
              onUploadFiles={handleUploadFiles}
              onDeleteDocument={handleDeleteDocument}
              isUploading={isUploading}
              uploadStatus={uploadStatus}
            />
          )}

          {currentView === "admin" && <AdminDashboard />}
        </main>
      </div>

      {/* Slide-out Document Drawer Overlay */}
      <AnimatePresence>
        {isDocumentDrawerOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDocumentDrawerOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm cursor-pointer"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 220 }}
              className="relative z-10 w-full max-w-2xl h-full bg-[#0D1220] border-l border-white/10 shadow-2xl flex flex-col overflow-hidden"
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

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={(msg) => showToast(msg, "success")}
      />

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