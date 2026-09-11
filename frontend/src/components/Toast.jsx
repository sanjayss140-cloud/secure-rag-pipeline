import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export default function Toast({ toast, onClose }) {
  if (!toast) return null;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-[#C084FC] shrink-0" />,
    warning: <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />,
  };

  const borders = {
    success: "border-emerald-500/30 bg-[#0B1713]/90 text-emerald-200",
    error: "border-rose-500/30 bg-[#1A0B10]/90 text-rose-200",
    info: "border-[#C084FC]/30 bg-[#130E24]/90 text-purple-200",
    warning: "border-amber-500/30 bg-[#1A150B]/90 text-amber-200",
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 pointer-events-auto">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl ${
            borders[toast.type] || borders.info
          } max-w-md`}
        >
          {icons[toast.type] || icons.info}
          <p className="text-sm font-medium">{toast.message}</p>
          <button
            onClick={onClose}
            className="ml-auto text-white/50 hover:text-white transition p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
