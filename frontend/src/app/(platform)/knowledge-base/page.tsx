"use client";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Database, FileText, Upload, Trash2, RefreshCw, HardDrive, FolderOpen, Search, Loader2, HelpCircle, DollarSign, Truck, ShieldCheck, Package, Activity, Target } from "lucide-react";
import { useToastStore, useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";

interface DocItem {
  id: string;
  name: string;
  source: string;
  added: string;
  chunks: number;
  status: string;
}

interface UploadedDoc {
  id: string;
  title: string;
  source_type: string;
  created_at: string;
  chunk_count?: number;
  status: string;
}

const dataSources = [
  { name: "Corporate Documents", type: "Local Workspace", docs: 0, size: "0 MB", status: "synced", lastSync: "Just now" },
  { name: "Research Papers", type: "Local Workspace", docs: 0, size: "0 MB", status: "synced", lastSync: "Just now" },
  { name: "Confluence Wiki", type: "API Web Scrapes", docs: 0, size: "0 MB", status: "synced", lastSync: "Just now" },
];

const statusMap: Record<string, { bg: string; text: string; label: string }> = {
  synced: { bg: "rgba(16,185,129,0.12)", text: "#10b981", label: "SYNCED" },
  syncing: { bg: "rgba(46,91,255,0.12)", text: "#2e5bff", label: "SYNCING" },
  error: { bg: "rgba(239,68,68,0.12)", text: "#ef4444", label: "ERROR" },
};

const formatDistance = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays}d ago`;
  } catch {
    return "Recently";
  }
};

export default function KnowledgeBasePage() {
  const [sources, setSources] = useState(dataSources);
  const [docsList, setDocsList] = useState<DocItem[]>([]);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [searchVal, setSearchVal] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [stats, setStats] = useState({
    total_documents: 0,
    total_chunks: 0,
    storage_used: "0 MB",
    data_sources: 3
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToastStore();
  const token = useAuthStore((state) => state.token);

  const fetchStatsAndDocs = async (silent = false) => {
    if (!token) return;
    try {
      // 1. Fetch dashboard metrics
      const dashboard = (await api.analytics.dashboard(token)) as any;
      const storageMb = dashboard.storage_used_mb || 0;
      const storageStr = storageMb > 1024 
        ? `${(storageMb / 1024).toFixed(2)} GB` 
        : `${storageMb.toFixed(1)} MB`;

      setStats({
        total_documents: dashboard.total_documents || 0,
        total_chunks: dashboard.total_chunks || 0,
        storage_used: storageStr,
        data_sources: 3
      });

      // 2. Fetch real documents list
      const docs = (await api.upload.list(token)) as any as UploadedDoc[];
      setDocsList(docs.map((doc: UploadedDoc) => ({
        id: doc.id,
        name: doc.title,
        source: doc.source_type.toUpperCase(),
        added: formatDistance(doc.created_at),
        chunks: doc.chunk_count || 0,
        status: doc.status
      })));

      // Update data sources counts
      setSources([
        { name: "Corporate Documents", type: "Local Workspace", docs: docs.length, size: storageStr, status: "synced", lastSync: "Just now" },
        { name: "Research Papers", type: "Local Workspace", docs: 0, size: "0 MB", status: "synced", lastSync: "Just now" },
        { name: "Confluence Wiki", type: "API Web Scrapes", docs: 0, size: "0 MB", status: "synced", lastSync: "Just now" },
      ]);
    } catch (e: unknown) {
      console.error("Failed to load knowledge base stats", e);
    }
  };

  useEffect(() => {
    if (token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchStatsAndDocs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSyncAll = async () => {
    if (isSyncingAll || !token) return;
    setIsSyncingAll(true);
    addToast("Starting full synchronization of all sources...", "info");

    try {
      await api.reindex.all(token);
      addToast("Full RAG re-indexing queued successfully!", "success");
      await fetchStatsAndDocs(true);
    } catch (e: unknown) {
      console.error(e);
      addToast(`Re-indexing failed: ${(e as Error).message || e}`, "error");
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!token) return;
    addToast(`Uploading ${file.name} to Knowledge Base...`, "info");
    
    try {
      await api.upload.document(file, token);
      addToast(`${file.name} successfully indexed into RAG memory`, "success");
      await fetchStatsAndDocs(true);
    } catch (error: unknown) {
      console.error(error);
      addToast(`Upload failed: ${(error as Error).message || error}`, "error");
    }
  };

  const handleDeleteDoc = async (id: string, name: string) => {
    if (!token) return;
    try {
      await api.upload.delete(id, token);
      setDocsList(prev => prev.filter(d => d.id !== id));
      addToast(`Removed document: ${name}`, "success");
      await fetchStatsAndDocs(true);
    } catch (e: unknown) {
      console.error(e);
      addToast(`Failed to delete document: ${(e as Error).message || e}`, "error");
    }
  };

  const filteredDocs = docsList.filter(d =>
    d.name.toLowerCase().includes(searchVal.toLowerCase()) ||
    d.source.toLowerCase().includes(searchVal.toLowerCase())
  );

  return (
    <div style={{ background: "var(--bg-base)" }} className="py-8 px-6 lg:px-10">
      <div style={{ maxWidth: "64rem", margin: "0 auto" }}>
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          style={{ display: "none" }}
        />

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="page-header mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 style={{ fontFamily: "var(--font-headline)", fontWeight: 600, letterSpacing: "-0.02em" }}>
                Knowledge Base
              </h1>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: 6 }}>
                The company documents every agent retrieves answers from (RAG).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSyncAll}
                disabled={isSyncingAll}
                className="btn-secondary"
                style={{ padding: "6px 12px", fontSize: "0.75rem" }}
              >
                {isSyncingAll ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                {" "}Sync All
              </button>
              <button
                onClick={handleUploadClick}
                className="btn-primary"
                style={{ padding: "6px 12px", fontSize: "0.75rem" }}
              >
                <Upload size={14} /> Upload
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── Knowledge Categories Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {[
            { title: "FAQ", desc: "Account setup, support hours, payment methods, order tracking, escalation.", icon: "❓", color: "#ef4444" },
            { title: "Refund & Cancellation Policy", desc: "Eligibility, refund timelines, damaged items, order cancellation rules.", icon: "💰", color: "#f59e0b" },
            { title: "Shipping Policy", desc: "Delivery timelines, shipping charges, tracking, installation.", icon: "🚚", color: "#3b82f6" },
            { title: "Warranty Policy", desc: "Coverage by category, claims process, extended warranty (Premium Care).", icon: "🛡️", color: "#8b5cf6" },
            { title: "Pricing & Products", desc: "Membership plans, featured products, discounts, price-match policy.", icon: "📦", color: "#10b981" },
            { title: "Football", desc: "History, rules, major tournaments, famous players, tactics.", icon: "⚽", color: "#ec4899" },
            { title: "Cricket", desc: "Formats, laws of cricket, historic matches, player statistics, equipment.", icon: "🏏", color: "#14b8a6" },
          ].map((cat, i) => (
            <motion.div
              key={cat.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card"
              style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "12px", background: "var(--bg-elevated)", border: "1px solid var(--slate-800)" }}
            >
              <div
                style={{
                  width: 36, height: 36, borderRadius: "10px",
                  background: cat.color + "1A", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.1rem"
                }}
              >
                {cat.icon}
              </div>
              <div>
                <h3 style={{ fontFamily: "var(--font-headline)", fontWeight: 600, fontSize: "1rem", color: "var(--text-primary)", marginBottom: "4px" }}>
                  {cat.title}
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.8125rem", lineHeight: 1.5 }}>
                  {cat.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: "TOTAL DOCUMENTS", value: stats.total_documents.toLocaleString(), icon: <FileText size={16} /> },
            { label: "TOTAL CHUNKS", value: stats.total_chunks.toLocaleString(), icon: <Database size={16} /> },
            { label: "STORAGE USED", value: stats.storage_used, icon: <HardDrive size={16} /> },
            { label: "DATA SOURCES", value: stats.data_sources.toString(), icon: <FolderOpen size={16} /> },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="card"
              style={{ padding: "16px 20px" }}
            >
              <div className="flex items-center gap-2 mb-2" style={{ color: "var(--cobalt)" }}>
                {stat.icon}
                <span className="text-label" style={{ color: "var(--text-tertiary)", fontSize: 10 }}>{stat.label}</span>
              </div>
              <p style={{ fontFamily: "var(--font-headline)", fontWeight: 600, fontSize: "1.25rem", color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                {stat.value}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* ── Data Sources ── */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--slate-800)" }}>
              <h3 style={{ fontFamily: "var(--font-headline)", fontWeight: 500, fontSize: "0.9375rem" }}>
                Data Sources
              </h3>
            </div>
            <div>
              {sources.map((source, i) => {
                const st = statusMap[source.status] || statusMap["synced"];
                return (
                  <motion.div
                    key={source.name}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                    className="list-item flex items-center gap-3"
                  >
                    <div
                      className="flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 36, height: 36, borderRadius: "var(--radius-sm)",
                        background: "var(--cobalt-glow)",
                      }}
                    >
                      <Database size={16} style={{ color: "var(--cobalt)" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontFamily: "var(--font-headline)", fontWeight: 500, fontSize: "0.8125rem", color: "var(--text-primary)" }} className="truncate">
                        {source.name}
                      </p>
                      <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", color: "var(--text-tertiary)", marginTop: 2 }}>
                        {source.type} · {source.docs.toLocaleString()} docs · {source.size}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="badge" style={{ background: st.bg, color: st.text, fontSize: "0.5625rem" }}>
                        {st.label}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* ── Recent Documents ── */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--slate-800)", display: "flex", justifyContent: "space-between", alignItems: "center" }} className="flex justify-between items-center">
              <h3 style={{ fontFamily: "var(--font-headline)", fontWeight: 500, fontSize: "0.9375rem" }}>
                Recently Added
              </h3>
              <div className="flex items-center gap-2">
                {showSearch && (
                  <motion.input
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 140, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    type="text"
                    value={searchVal}
                    onChange={(e) => setSearchVal(e.target.value)}
                    placeholder="Filter docs..."
                    style={{
                      background: "var(--slate-950)",
                      border: "1px solid var(--slate-700)",
                      borderRadius: "var(--radius-xs)",
                      color: "var(--text-primary)",
                      fontFamily: "var(--font-body)",
                      fontSize: "0.75rem",
                      padding: "2px 6px",
                      outline: "none",
                    }}
                  />
                )}
                <button
                  onClick={() => setShowSearch(!showSearch)}
                  className="btn-ghost"
                  style={{ fontSize: "0.6875rem", padding: "4px 8px" }}
                >
                  <Search size={12} /> {showSearch ? "Close" : "Search"}
                </button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", maxHeight: "310px" }}>
              {filteredDocs.map((doc, i) => (
                <motion.div
                  key={`${doc.id}-${i}`}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="list-item flex items-center gap-3"
                >
                  <FileText size={16} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <p style={{ fontFamily: "var(--font-headline)", fontWeight: 500, fontSize: "0.8125rem", color: "var(--text-primary)" }} className="truncate">
                      {doc.name}
                    </p>
                    <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", color: "var(--text-tertiary)", marginTop: 2 }}>
                      {doc.source} · {doc.added} · {doc.chunks} chunks
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteDoc(doc.id, doc.name)}
                    className="btn-icon text-error"
                    style={{ width: 28, height: 28 }}
                  >
                    <Trash2 size={13} />
                  </button>
                </motion.div>
              ))}
              {filteredDocs.length === 0 && (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)", fontSize: "0.8125rem" }}>
                  No matching documents found.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
