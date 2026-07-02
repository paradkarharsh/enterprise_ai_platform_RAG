"use client";
import { useToastStore, Toast } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react";

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const icons = {
    success: <CheckCircle2 size={16} style={{ color: "var(--success)" }} />,
    error: <AlertCircle size={16} style={{ color: "var(--error)" }} />,
    warning: <AlertTriangle size={16} style={{ color: "var(--warning)" }} />,
    info: <Info size={16} style={{ color: "var(--cobalt-light)" }} />,
  };

  const borderColors = {
    success: "rgba(16, 185, 129, 0.3)",
    error: "rgba(239, 68, 68, 0.3)",
    warning: "rgba(245, 158, 11, 0.3)",
    info: "var(--slate-800)",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.15 } }}
      style={{
        background: "var(--bg-elevated)",
        border: `1px solid ${borderColors[toast.type]}`,
        borderRadius: "var(--radius-sm)",
        padding: "12px 16px",
        minWidth: 280,
        maxWidth: 360,
        boxShadow: "var(--shadow-lg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        pointerEvents: "auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {icons[toast.type]}
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            color: "var(--text-primary)",
            fontWeight: 500,
          }}
        >
          {toast.message}
        </span>
      </div>
      <button
        onClick={onClose}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--text-tertiary)",
          padding: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "var(--radius-xs)",
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "var(--text-primary)";
          e.currentTarget.style.background = "var(--slate-800)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--text-tertiary)";
          e.currentTarget.style.background = "transparent";
        }}
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}
