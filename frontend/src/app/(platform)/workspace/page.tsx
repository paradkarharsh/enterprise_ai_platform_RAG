"use client";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Upload, FolderOpen, Clock, Tag, MoreHorizontal, Grid, List, Download, Edit2, Trash2 } from "lucide-react";
import { useToastStore } from "@/lib/store";

const files = [
  { name: "Q4 Strategy Deck.pptx", type: "PPTX", size: "4.2 MB", modified: "2 hours ago", tags: ["strategy", "executive"] },
  { name: "RAG Architecture v3.pdf", type: "PDF", size: "1.8 MB", modified: "5 hours ago", tags: ["technical", "architecture"] },
  { name: "Customer Research Q3.xlsx", type: "XLSX", size: "890 KB", modified: "1 day ago", tags: ["research", "customers"] },
  { name: "Engineering Handbook.md", type: "MD", size: "245 KB", modified: "2 days ago", tags: ["engineering", "onboarding"] },
  { name: "Financial Model 2025.xlsx", type: "XLSX", size: "3.1 MB", modified: "3 days ago", tags: ["finance", "projections"] },
  { name: "Product Roadmap.pdf", type: "PDF", size: "2.4 MB", modified: "4 days ago", tags: ["product", "roadmap"] },
  { name: "API Documentation.md", type: "MD", size: "567 KB", modified: "1 week ago", tags: ["technical", "api"] },
  { name: "Board Meeting Notes.docx", type: "DOCX", size: "180 KB", modified: "1 week ago", tags: ["executive", "minutes"] },
];

const typeColors: Record<string, string> = {
  PDF: "#ef4444",
  PPTX: "#f97316",
  XLSX: "#10b981",
  MD: "#b8c3ff",
  DOCX: "#3b82f6",
};

export default function WorkspacePage() {
  const [view, setView] = useState<"grid" | "list">("list");
  const [filesList, setFilesList] = useState(files);
  const [activeFilter, setActiveFilter] = useState<"all" | "folders" | "recent" | "tags">("all");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [activeDropdownFile, setActiveDropdownFile] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<typeof files[0] | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToastStore();

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    addToast(`Uploading ${file.name}...`, "info");

    const extension = file.name.split(".").pop()?.toUpperCase() || "PDF";
    const type = ["PDF", "PPTX", "XLSX", "MD", "DOCX"].includes(extension) ? extension : "PDF";

    setTimeout(() => {
      setFilesList((prev) => [
        {
          name: file.name,
          type,
          size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          modified: "Just now",
          tags: ["uploaded", "new"],
        },
        ...prev,
      ]);
      addToast(`${file.name} uploaded successfully!`, "success");
    }, 1200);
  };

  const handleDownload = (filename: string) => {
    addToast(`Downloading ${filename}...`, "success");
    setActiveDropdownFile(null);
  };

  const handleRename = (filename: string) => {
    const newName = prompt("Enter new name for the file:", filename);
    if (newName && newName.trim()) {
      setFilesList(prev =>
        prev.map(f => (f.name === filename ? { ...f, name: newName.trim() } : f))
      );
      addToast(`File renamed to ${newName}`, "success");
    }
    setActiveDropdownFile(null);
  };

  const handleDelete = (filename: string) => {
    setFilesList(prev => prev.filter(f => f.name !== filename));
    addToast(`Deleted ${filename}`, "success");
    setActiveDropdownFile(null);
  };

  const allTags = Array.from(new Set(filesList.flatMap(f => f.tags)));

  let displayFiles = filesList;
  if (activeFilter === "recent") {
    displayFiles = filesList.filter(f => f.modified.includes("hour") || f.modified.includes("now"));
  } else if (activeFilter === "folders") {
    displayFiles = filesList.filter(f => f.type === "XLSX" || f.type === "PPTX");
  } else if (activeFilter === "tags" && selectedTag) {
    displayFiles = filesList.filter(f => f.tags.includes(selectedTag));
  }

  return (
    <div style={{ background: "var(--bg-base)" }} className="py-8 px-6 lg:px-10">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        style={{ display: "none" }}
      />
      <div style={{ maxWidth: "64rem", margin: "0 auto" }}>
        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="page-header mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 style={{ fontFamily: "var(--font-headline)", fontWeight: 600, letterSpacing: "-0.02em" }}>
                Workspace
              </h1>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: 6 }}>
                Manage documents, files, and shared resources
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex" style={{ background: "var(--bg-glass)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", padding: 4 }}>
                <button
                  onClick={() => setView("list")}
                  style={{
                    padding: "4px 8px", borderRadius: "var(--radius-xs)",
                    background: view === "list" ? "var(--cobalt)" : "transparent",
                    color: view === "list" ? "white" : "var(--text-tertiary)",
                    border: "none", cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  <List size={14} />
                </button>
                <button
                  onClick={() => setView("grid")}
                  style={{
                    padding: "4px 8px", borderRadius: "var(--radius-xs)",
                    background: view === "grid" ? "var(--cobalt)" : "transparent",
                    color: view === "grid" ? "white" : "var(--text-tertiary)",
                    border: "none", cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  <Grid size={14} />
                </button>
              </div>
              <button onClick={handleUploadClick} className="btn-primary" style={{ padding: "8px 16px", fontSize: "0.8125rem", borderRadius: "8px" }}>
                <Upload size={14} /> Upload
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── Quick Actions ── */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { id: "folders", icon: <FolderOpen size={18} />, label: "Browse Folders", sub: "XLSX & PPTX docs" },
            { id: "recent", icon: <Clock size={18} />, label: "Recent Files", sub: "Modified recently" },
            { id: "tags", icon: <Tag size={18} />, label: "By Tags", sub: `${allTags.length} categories` },
          ].map((action, i) => {
            const active = activeFilter === action.id;
            return (
              <motion.div
                key={action.id}
                onClick={() => {
                  setActiveFilter(active ? "all" : (action.id as "folders" | "recent" | "tags"));
                  setSelectedTag(null);
                }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card"
                style={{
                  padding: "20px 24px",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  cursor: "pointer",
                  border: active ? "1px solid var(--cobalt)" : "1px solid var(--border-default)",
                  background: active ? "var(--bg-glass)" : "var(--bg-glass)",
                  boxShadow: active ? "0 4px 12px var(--cobalt-glow-strong)" : "none",
                }}
              >
                <div style={{
                  background: active ? "var(--cobalt-glow)" : "transparent",
                  color: active ? "var(--cobalt)" : "var(--text-tertiary)",
                  padding: "8px", borderRadius: "12px", transition: "all 0.2s"
                }}>
                  {action.icon}
                </div>
                <div>
                  <p style={{ fontFamily: "var(--font-headline)", fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)" }}>
                    {action.label}
                  </p>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: 2 }}>
                    {action.sub}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ── Tag filter list ── */}
        <AnimatePresence>
          {activeFilter === "tags" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex gap-2 mb-4 items-center flex-wrap"
              style={{ overflow: "hidden" }}
            >
              <span className="text-label" style={{ color: "var(--text-secondary)", fontSize: 9 }}>Filter by Tag:</span>
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                  style={{
                    padding: "4px 10px",
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    background: selectedTag === tag ? "var(--cobalt)" : "var(--slate-800)",
                    color: selectedTag === tag ? "white" : "var(--slate-300)",
                    border: "1px solid var(--slate-700)",
                    borderRadius: "var(--radius-xs)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  #{tag}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Files & Preview Split View ── */}
        <div className="flex gap-6">
          <div className="glass-card flex-1" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-default)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontFamily: "var(--font-headline)", fontWeight: 600, fontSize: "1rem" }}>
                All Files
              </h3>
              <span className="text-label" style={{ color: "var(--text-tertiary)", fontSize: 11, fontWeight: 600 }}>
                {displayFiles.length} FILES
              </span>
            </div>

            {view === "list" ? (
              /* List View */
              <div>
              {/* Header Row */}
              <div
                className="flex items-center gap-3"
                style={{
                  padding: "8px 20px",
                  borderBottom: "1px solid var(--slate-800)",
                  fontSize: "0.625rem",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                  color: "var(--text-tertiary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                <span style={{ flex: 1 }}>Name</span>
                <span style={{ width: 60, textAlign: "center" }}>Type</span>
                <span style={{ width: 80, textAlign: "right" }}>Size</span>
                <span style={{ width: 100, textAlign: "right" }}>Modified</span>
                <span style={{ width: 28 }}></span>
              </div>
              {displayFiles.map((file, i) => (
                <motion.div
                  key={file.name}
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="list-item flex items-center gap-3 relative"
                  style={{ padding: "12px 20px" }}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0" onClick={() => setSelectedFile(file)} style={{ cursor: "pointer" }}>
                    <div style={{ background: typeColors[file.type] + "1A", padding: "6px", borderRadius: "8px" }}>
                      <FileText size={16} style={{ color: typeColors[file.type] || "var(--text-tertiary)", flexShrink: 0 }} />
                    </div>
                    <span style={{ fontFamily: "var(--font-headline)", fontWeight: 500, fontSize: "0.875rem", color: "var(--text-primary)" }} className="truncate hover:text-[var(--cobalt)] transition-colors">
                      {file.name}
                    </span>
                  </div>
                  <span className="badge" style={{ width: 60, justifyContent: "center", fontSize: "0.5625rem" }}>{file.type}</span>
                  <span style={{ width: 80, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>{file.size}</span>
                  <span style={{ width: 100, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>{file.modified}</span>
                  <div className="relative">
                    <button
                      onClick={() => setActiveDropdownFile(activeDropdownFile === file.name ? null : file.name)}
                      className="btn-icon"
                      style={{ width: 28, height: 28, flexShrink: 0 }}
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    <AnimatePresence>
                      {activeDropdownFile === file.name && (
                        <>
                          <div style={{ position: "fixed", inset: 0, zIndex: 30 }} onClick={() => setActiveDropdownFile(null)} />
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 8 }}
                            className="card"
                            style={{
                              position: "absolute",
                              right: 0,
                              top: "100%",
                              zIndex: 40,
                              padding: 6,
                              minWidth: 120,
                              boxShadow: "var(--shadow-md)",
                              display: "flex",
                              flexDirection: "column",
                              gap: 2,
                            }}
                          >
                            <button
                              onClick={() => handleDownload(file.name)}
                              className="btn-ghost"
                              style={{ justifyContent: "flex-start", width: "100%", fontSize: "0.75rem", padding: "6px 8px", gap: 6 }}
                            >
                              <Download size={12} /> Download
                            </button>
                            <button
                              onClick={() => handleRename(file.name)}
                              className="btn-ghost"
                              style={{ justifyContent: "flex-start", width: "100%", fontSize: "0.75rem", padding: "6px 8px", gap: 6 }}
                            >
                              <Edit2 size={12} /> Rename
                            </button>
                            <button
                              onClick={() => handleDelete(file.name)}
                              className="btn-ghost text-error"
                              style={{ justifyContent: "flex-start", width: "100%", fontSize: "0.75rem", padding: "6px 8px", gap: 6 }}
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ))}
              {displayFiles.length === 0 && (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)", fontSize: "0.8125rem" }}>
                  No matching workspace files found.
                </div>
              )}
            </div>
          ) : (
            /* Grid View */
            <div style={{ padding: 16 }}>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {displayFiles.map((file, i) => (
                  <motion.div
                    key={file.name}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="card-interactive relative group"
                    style={{ padding: "20px", textAlign: "center", cursor: "pointer" }}
                    onClick={() => setSelectedFile(file)}
                  >
                    {/* Hover Delete Button in Grid View */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(file.name);
                      }}
                      className="absolute top-2 right-2 btn-icon text-error opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ width: 28, height: 28, background: "var(--bg-glass)" }}
                      title="Delete File"
                    >
                      <Trash2 size={14} />
                    </button>

                    <div style={{ width: 48, height: 48, background: typeColors[file.type] + "1A", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                      <FileText size={24} style={{ color: typeColors[file.type] || "var(--text-tertiary)" }} />
                    </div>
                    <p style={{ fontFamily: "var(--font-headline)", fontWeight: 500, fontSize: "0.8125rem", color: "var(--text-primary)", marginBottom: 6 }} className="truncate">
                      {file.name}
                    </p>
                    <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>
                      {file.size} · {file.modified}
                    </p>
                  </motion.div>
                ))}
              </div>
              {displayFiles.length === 0 && (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)", fontSize: "0.8125rem" }}>
                  No matching workspace files found.
                </div>
              )}
            </div>
          )}
          </div>
          {/* Preview Panel Split-View */}
          <AnimatePresence>
            {selectedFile && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 340, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                style={{ overflow: "hidden" }}
              >
                <div className="glass-card" style={{ padding: "24px", height: "100%", minHeight: "500px" }}>
                  <div className="flex justify-between items-start mb-6">
                    <div style={{ width: 56, height: 56, background: typeColors[selectedFile.type] + "1A", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <FileText size={28} style={{ color: typeColors[selectedFile.type] || "var(--text-tertiary)" }} />
                    </div>
                    <button onClick={() => setSelectedFile(null)} className="btn-icon" style={{ padding: 4 }}>
                      <Trash2 size={16} onClick={(e) => { e.stopPropagation(); setSelectedFile(null); handleDelete(selectedFile.name); }} />
                    </button>
                  </div>
                  
                  <h3 style={{ fontFamily: "var(--font-headline)", fontSize: "1.25rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px", wordBreak: "break-word" }}>
                    {selectedFile.name}
                  </h3>
                  
                  <div className="flex flex-col gap-4 mt-6">
                    <div>
                      <span className="text-label" style={{ color: "var(--text-tertiary)", fontSize: 10, display: "block", marginBottom: 4 }}>TYPE</span>
                      <span className="badge" style={{ fontSize: "0.6875rem" }}>{selectedFile.type}</span>
                    </div>
                    <div>
                      <span className="text-label" style={{ color: "var(--text-tertiary)", fontSize: 10, display: "block", marginBottom: 4 }}>SIZE</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem", color: "var(--text-primary)" }}>{selectedFile.size}</span>
                    </div>
                    <div>
                      <span className="text-label" style={{ color: "var(--text-tertiary)", fontSize: 10, display: "block", marginBottom: 4 }}>MODIFIED</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem", color: "var(--text-primary)" }}>{selectedFile.modified}</span>
                    </div>
                    <div>
                      <span className="text-label" style={{ color: "var(--text-tertiary)", fontSize: 10, display: "block", marginBottom: 8 }}>TAGS</span>
                      <div className="flex flex-wrap gap-2">
                        {selectedFile.tags.map(tag => (
                          <span key={tag} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", padding: "4px 8px", borderRadius: "8px", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-8 flex gap-3">
                    <button onClick={() => handleDownload(selectedFile.name)} className="btn-primary flex-1" style={{ justifyContent: "center", padding: "10px", borderRadius: "10px" }}>
                      <Download size={16} /> Download
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
