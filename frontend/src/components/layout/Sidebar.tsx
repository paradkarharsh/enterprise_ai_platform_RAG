"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, GitBranch, Activity, BarChart3,
  Settings, ChevronLeft, ChevronRight,
  Plus, HelpCircle, LogOut, MessageSquare,
  Database, Cpu, Ticket
} from "lucide-react";
import { useSidebarStore, useAuthStore, useToastStore, useChatStore } from "@/lib/store";

const navItems = [
  { href: "/chat", icon: MessageSquare, label: "AI Chat" },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/graph", icon: GitBranch, label: "Knowledge Graph" },
  { href: "/agents", icon: Activity, label: "Pipeline" },
  { href: "/tickets", icon: Ticket, label: "Tickets" },
  { href: "/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/knowledge-base", icon: Database, label: "Knowledge Base" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isOpen, toggle } = useSidebarStore();
  const { user, logout } = useAuthStore();
  const { addToast } = useToastStore();
  const { clearMessages } = useChatStore();

  const sidebarWidth = isOpen ? 260 : 72;

  return (
    <motion.aside
      className="absolute left-0 top-0 z-40 flex flex-col"
      initial={false}
      animate={{ width: sidebarWidth }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      style={{
        height: "100%",
        background: "var(--bg-glass)",
        backdropFilter: "blur(40px) saturate(180%)",
        WebkitBackdropFilter: "blur(40px) saturate(180%)",
        borderRight: "1px solid var(--border-default)",
        borderRadius: "24px 0 0 24px",
        overflow: "hidden",
        boxShadow: "10px 0 30px rgba(0,0,0,0.1)"
      }}
    >
      {/* ── Logo ── */}
      <div
        className="flex items-center flex-shrink-0"
        style={{
          height: 64,
          padding: isOpen ? "0 20px" : "0",
          justifyContent: isOpen ? "flex-start" : "center",
          gap: isOpen ? "12px" : "0",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 36,
            height: 36,
            borderRadius: "10px",
            overflow: "hidden",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
          }}
        >
          <img src="/logo.png" alt="NeuralArch Logo" style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.8)" }} />
        </motion.div>
        
        <AnimatePresence mode="popLayout">
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="flex items-baseline gap-1 whitespace-nowrap overflow-hidden"
            >
              <span
                className="font-semibold text-base"
                style={{ fontFamily: "var(--font-headline)", color: "var(--text-primary)", letterSpacing: "-0.02em" }}
              >
                NeuralArch
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        
        {isOpen && (
          <motion.button
            whileHover={{ backgroundColor: "var(--bg-hover)", color: "var(--text-primary)" }}
            whileTap={{ scale: 0.9 }}
            onClick={toggle}
            className="ml-auto flex-shrink-0 flex items-center justify-center"
            style={{
              width: 28, height: 28, borderRadius: "8px",
              color: "var(--text-tertiary)", background: "transparent",
              border: "none", cursor: "pointer",
            }}
          >
            <ChevronLeft size={16} />
          </motion.button>
        )}
      </div>

      {/* ── New Session ── */}
      <div style={{ padding: isOpen ? "20px 16px 12px" : "20px 0 12px", display: "flex", justifyContent: "center" }}>
        <Link href="/chat" style={{ width: isOpen ? "100%" : "auto" }} onClick={() => {
          clearMessages();
          addToast("New chat session started", "success");
        }}>
          <motion.button
            whileHover={{ scale: 1.02, backgroundColor: "var(--cobalt-light)" }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center justify-center"
            style={{
              width: isOpen ? "100%" : 44,
              height: isOpen ? 44 : 44,
              padding: isOpen ? "0 16px" : "0",
              gap: isOpen ? "10px" : "0",
              background: "var(--cobalt)",
              color: "white",
              borderRadius: "12px",
              fontSize: "14px",
              fontWeight: 600,
              fontFamily: "var(--font-body)",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 12px var(--cobalt-glow-strong)",
            }}
          >
            <Plus size={18} strokeWidth={2.5} />
            {isOpen && <span>New Session</span>}
          </motion.button>
        </Link>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto" style={{ padding: isOpen ? "8px 12px" : "8px 0" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "center" }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} style={{ width: isOpen ? "100%" : "auto", display: "flex", justifyContent: "center", textDecoration: "none" }}>
                <motion.div
                  whileHover={{ backgroundColor: isActive ? "var(--bg-hover)" : "var(--bg-hover)", color: isActive ? "var(--cobalt-light)" : "var(--text-primary)", x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center relative"
                  style={{
                    width: isOpen ? "100%" : 44,
                    height: 40,
                    padding: isOpen ? "0 14px" : "0",
                    gap: isOpen ? "12px" : "0",
                    justifyContent: isOpen ? "flex-start" : "center",
                    alignItems: "center",
                    background: isActive ? "var(--bg-hover)" : "transparent",
                    color: isActive ? "var(--cobalt-light)" : "var(--text-secondary)",
                    borderRadius: "10px",
                    fontSize: "14px",
                    fontWeight: isActive ? 600 : 500,
                    fontFamily: "var(--font-body)",
                    cursor: "pointer",
                  }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="active-indicator"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full"
                      style={{ background: "var(--cobalt)" }}
                    />
                  )}
                  <div className="flex-shrink-0 flex items-center justify-center" style={{ width: isOpen ? "auto" : 44, height: isOpen ? "auto" : 44 }}>
                    <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  {isOpen && <span className="flex-1 truncate text-left">{item.label}</span>}
                </motion.div>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── Footer ── */}
      <div style={{ padding: isOpen ? "12px" : "12px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
        {/* Support */}
        <motion.div
          whileHover={{ backgroundColor: "var(--bg-hover)", color: "var(--text-primary)" }}
          whileTap={{ scale: 0.98 }}
          onClick={() => addToast("Connecting to live support desk...", "info")}
          className="flex items-center relative"
          style={{
            width: isOpen ? "100%" : 44,
            height: 40,
            padding: isOpen ? "0 14px" : "0",
            gap: isOpen ? "12px" : "0",
            justifyContent: isOpen ? "flex-start" : "center",
            color: "var(--text-tertiary)",
            fontSize: "13px",
            fontWeight: 500,
            borderRadius: "10px",
            cursor: "pointer",
          }}
        >
          <HelpCircle size={18} />
          {isOpen && <span>Support</span>}
        </motion.div>

        {/* Sign Out */}
        <motion.div
          whileHover={{ backgroundColor: "var(--bg-hover)", color: "var(--text-primary)" }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            logout();
            addToast("Signed out successfully", "success");
          }}
          className="flex items-center relative"
          style={{
            width: isOpen ? "100%" : 44,
            height: 40,
            padding: isOpen ? "0 14px" : "0",
            gap: isOpen ? "12px" : "0",
            justifyContent: isOpen ? "flex-start" : "center",
            color: "var(--text-tertiary)",
            fontSize: "13px",
            fontWeight: 500,
            borderRadius: "10px",
            cursor: "pointer",
          }}
        >
          <LogOut size={18} />
          {isOpen && <span>Sign Out</span>}
        </motion.div>

        {/* Collapsed: expand toggle */}
        {!isOpen && (
          <motion.button
            whileHover={{ backgroundColor: "var(--bg-hover)", color: "var(--text-primary)" }}
            whileTap={{ scale: 0.9 }}
            onClick={toggle}
            style={{
              display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center",
              width: 44, height: 44, borderRadius: "10px",
              color: "var(--text-tertiary)", background: "transparent",
              border: "none", cursor: "pointer", marginTop: 8
            }}
          >
            <ChevronRight size={18} />
          </motion.button>
        )}
      </div>

      {/* ── User Profile ── */}
      <div style={{ padding: isOpen ? "16px" : "16px 0", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "center", background: "rgba(0,0,0,0.2)" }}>
        <div className="flex items-center" style={{ width: isOpen ? "100%" : 44, gap: isOpen ? "12px" : "0", justifyContent: isOpen ? "flex-start" : "center" }}>
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 36, height: 36, borderRadius: "12px",
              background: "var(--slate-800)", color: "var(--text-primary)",
              border: "1px solid var(--border-default)",
              fontSize: 14, fontWeight: 600, fontFamily: "var(--font-headline)",
            }}
          >
            {user?.full_name?.[0] || "U"}
          </div>
          {isOpen && (
            <div className="flex-1 min-w-0">
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.2 }} className="truncate">
                {user?.full_name || "Guest User"}
              </p>
              <p style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500, lineHeight: 1.2 }} className="truncate">
                {user?.email || "guest@neuralarch.ai"}
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
