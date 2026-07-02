"use client";
import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Database, FileText, Upload, Trash2, RefreshCw, HardDrive, FolderOpen, Search, Loader2 } from "lucide-react";
import { useToastStore } from "@/lib/store";

const dataSources = [
  { name: "Corporate Documents", type: "S3 Bucket", docs: 423, size: "2.1 GB", status: "synced", lastSync: "5 min ago" },
  { name: "Research Papers", type: "Google Drive", docs: 189, size: "890 MB", status: "synced", lastSync: "12 min ago" },
  { name: "Confluence Wiki", type: "API", docs: 1247, size: "3.4 GB", status: "syncing", lastSync: "Now" },
  { name: "Email Archives", type: "IMAP", docs: 2891, size: "5.7 GB", status: "synced", lastSync: "1 hr ago" },
  { name: "Slack Channels", type: "API", docs: 8432, size: "1.2 GB", status: "error", lastSync: "Failed" },
];

const recentDocs = [
  { name: "Q4 Strategy Presentation.pptx", source: "Corporate Documents", added: "2 hours ago", chunks: 47 },
  { name: "RAG Architecture Whitepaper.pdf", source: "Research Papers", added: "4 hours ago", chunks: 123 },
  { name: "Engineering Sprint Notes.md", source: "Confluence Wiki", added: "6 hours ago", chunks: 18 },
  { name: "Customer Feedback Summary.xlsx", source: "Corporate Documents", added: "1 day ago", chunks: 89 },
  { name: "Product Roadmap 2025.pdf", source: "Corporate Documents", added: "1 day ago", chunks: 56 },
];

const statusMap: Record<string, { bg: string; text: string; label: string }> = {
  synced: { bg: "rgba(16,185,129,0.12)", text: "#10b981", label: "SYNCED" },
  syncing: { bg: "rgba(46,91,255,0.12)", text: "#2e5bff", label: "SYNCING" },
  error: { bg: "rgba(239,68,68,0.12)", text: "#ef4444", label: "ERROR" },
};

export default function KnowledgeBasePage() {
  const [sources, setSources] = useState(dataSources);
  const [docsList, setDocsList] = useState(recentDocs);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [searchVal, setSearchVal] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { addToast } = useToastStore();

  const handleSyncAll = () => {
    if (isSyncingAll) return;
    setIsSyncingAll(true);
    addToast("Starting synchronization of all sources...", "info");

    let p = Promise.resolve();
    sources.forEach((source, index) => {
      p = p.then(() => {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            setSources((prev) => {
              const next = [...prev];
              next[index] = { ...next[index], status: "syncing" };
              return next;
            });
            resolve();
          }, 600);
        }).then(() => {
          return new Promise<void>((resolve) => {
            setTimeout(() => {
              setSources((prev) => {
                const next = [...prev];
                next[index] = { ...next[index], status: "synced", lastSync: "Just now" };
                return next;
              });
              resolve();
            }, 600);
          });
        });
      });
    });

    p.then(() => {
      setIsSyncingAll(false);
      addToast("All sources synchronized successfully!", "success");
    });
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    addToast(`Uploading ${file.name} to Knowledge Base...`, "info");
    
    setTimeout(() => {
      addToast(`${file.name} successfully indexed into RAG memory`, "success");
      setDocsList((prev) => [
        {
          name: file.name,
          source: "Manual Upload",
          added: "Just now",
          chunks: Math.floor(Math.random() * 60 + 15),
        },
        ...prev,
      ]);
    }, 1500);
  };

  const handleDeleteDoc = (name: string) => {
    setDocsList(prev => prev.filter(d => d.name !== name));
    addToast(`Removed document: ${name}`, "success");
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
                Manage data sources, documents, and embeddings
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

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: "TOTAL DOCUMENTS", value: "13,182", icon: <FileText size={16} /> },
            { label: "TOTAL CHUNKS", value: "312,459", icon: <Database size={16} /> },
            { label: "STORAGE USED", value: "13.3 GB", icon: <HardDrive size={16} /> },
            { label: "DATA SOURCES", value: "5", icon: <FolderOpen size={16} /> },
          ].map((stat, i) => (
            <motion.div
              key={i}
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
                const st = statusMap[source.status];
                return (
                  <motion.div
                    key={i}
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
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--slate-800)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
                  key={doc.name}
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
                    onClick={() => handleDeleteDoc(doc.name)}
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
