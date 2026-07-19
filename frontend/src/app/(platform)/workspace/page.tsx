"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Upload, FolderOpen, Clock, Tag, MoreHorizontal, Grid, List, Download, Edit2, Trash2, Loader2, AlertCircle } from "lucide-react";
import { useToastStore, useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";

interface FileItem {
  id: string;
  name: string;
  type: string;
  size: string;
  modified: string;
  tags: string[];
  status: "pending" | "processing" | "indexed" | "failed" | "archived";
  progress: number;
  processing_stage: string;
}

const typeColors: Record<string, string> = {
  PDF: "#ef4444",
  PPTX: "#f97316",
  XLSX: "#10b981",
  MD: "#b8c3ff",
  DOCX: "#3b82f6",
  TXT: "#6b7280",
  CSV: "#8b5cf6",
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

export default function WorkspacePage() {
  const [view, setView] = useState<"grid" | "list">("list");
  const [filesList, setFilesList] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "folders" | "recent" | "tags">("all");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [activeDropdownFile, setActiveDropdownFile] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToastStore();
  const token = useAuthStore((state) => state.token);

  const fetchFiles = async (silent = false) => {
    if (!token) return;
    if (!silent) setIsLoading(true);
    try {
      const data = (await api.upload.list(token)) as any[];
      const mapped: FileItem[] = data.map((doc: any) => {
        const ext = doc.title.split(".").pop()?.toUpperCase() || "TXT";
        return {
          id: doc.id,
          name: doc.title,
          type: ext,
          size: doc.file_size ? `${(doc.file_size / (1024 * 1024)).toFixed(2)} MB` : "N/A",
          modified: formatDistance(doc.created_at),
          tags: doc.meta?.tags || (doc.source_type === "markdown" ? ["markdown"] : ["uploaded"]),
          status: doc.status as FileItem["status"],
          progress: doc.progress || 0,
          processing_stage: doc.processing_stage || "queued",
        };
      });
      setFilesList(mapped);

      // Keep selected file state synced with update
      if (selectedFile) {
        const updated = mapped.find(f => f.id === selectedFile.id);
        if (updated) setSelectedFile(updated);
      }
    } catch (e: unknown) {
      console.error(e);
      addToast(`Failed to load workspace documents: ${(e as Error).message || e}`, "error");
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchFiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Poll processing files every 3 seconds
  useEffect(() => {
    const hasActiveProcessing = filesList.some(
      (f) => f.status === "pending" || f.status === "processing"
    );
    if (!hasActiveProcessing || !token) return;

    const interval = setInterval(() => {
      fetchFiles(true);
    }, 3000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filesList, token]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!token) {
      addToast("You must be logged in to upload files", "error");
      return;
    }
    addToast(`Uploading ${file.name}...`, "info");

    try {
      await api.upload.document(file, token);
      addToast(`${file.name} uploaded successfully! Ingestion processing in background.`, "success");
      await fetchFiles(true);
    } catch (error: unknown) {
      console.error(error);
      addToast(`Upload failed: ${(error as Error).message || error}`, "error");
    }
  };

  const handleDownload = (filename: string) => {
    addToast(`Downloading ${filename}...`, "success");
    setActiveDropdownFile(null);
  };

  const handleRename = () => {
    addToast("Renaming is only supported for document titles in the Knowledge Base", "info");
    setActiveDropdownFile(null);
  };

  const handleDelete = async (fileId: string, name: string) => {
    if (!token) return;
    try {
      await api.upload.delete(fileId, token);
      setFilesList((prev) => prev.filter((f) => f.id !== fileId));
      addToast(`Deleted ${name}`, "success");
      if (selectedFile?.id === fileId) {
        setSelectedFile(null);
      }
    } catch (e: unknown) {
      console.error(e);
      addToast(`Failed to delete file: ${(e as Error).message || e}`, "error");
    }
    setActiveDropdownFile(null);
  };

  const allTags = Array.from(new Set(filesList.flatMap((f) => f.tags)));

  let displayFiles = filesList;
  if (activeFilter === "recent") {
    displayFiles = filesList.filter((f) => f.modified.includes("min") || f.modified.includes("hour") || f.modified.includes("now"));
  } else if (activeFilter === "folders") {
    displayFiles = filesList.filter((f) => ["XLSX", "PPTX", "EXCEL"].includes(f.type));
  } else if (activeFilter === "tags" && selectedTag) {
    displayFiles = filesList.filter((f) => f.tags.includes(selectedTag));
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
                  background: "var(--bg-glass)",
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
            <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-default)", display: "flex", justifyContent: "space-between", alignItems: "center" }} className="flex justify-between items-center">
              <h3 style={{ fontFamily: "var(--font-headline)", fontWeight: 600, fontSize: "1rem" }}>
                All Files
              </h3>
              <span className="text-label" style={{ color: "var(--text-tertiary)", fontSize: 11, fontWeight: 600 }}>
                {displayFiles.length} FILES
              </span>
            </div>

            {isLoading ? (
              <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-[var(--cobalt)]" size={32} /></div>
            ) : view === "list" ? (
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
                  <span style={{ width: 120, textAlign: "center" }}>Status</span>
                  <span style={{ width: 60, textAlign: "center" }}>Type</span>
                  <span style={{ width: 80, textAlign: "right" }}>Size</span>
                  <span style={{ width: 100, textAlign: "right" }}>Modified</span>
                  <span style={{ width: 28 }}></span>
                </div>
                {displayFiles.map((file, i) => (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, x: 6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="list-item flex items-center gap-3 relative"
                    style={{ padding: "12px 20px" }}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0" onClick={() => setSelectedFile(file)} style={{ cursor: "pointer" }}>
                      <div style={{ background: (typeColors[file.type] || "#555") + "1A", padding: "6px", borderRadius: "8px" }}>
                        <FileText size={16} style={{ color: typeColors[file.type] || "var(--text-tertiary)", flexShrink: 0 }} />
                      </div>
                      <span style={{ fontFamily: "var(--font-headline)", fontWeight: 500, fontSize: "0.875rem", color: "var(--text-primary)" }} className="truncate hover:text-[var(--cobalt)] transition-colors">
                        {file.name}
                      </span>
                    </div>

                    {/* Progress details */}
                    <div style={{ width: 120, textAlign: "center" }} className="flex justify-center">
                      {file.status === "indexed" ? (
                        <span className="text-[10px] font-bold tracking-wider text-success bg-[rgba(16,185,129,0.12)] px-2 py-0.5 rounded-md">
                          INDEXED
                        </span>
                      ) : file.status === "failed" ? (
                        <span className="text-[10px] font-bold tracking-wider text-error bg-[rgba(239,68,68,0.12)] px-2 py-0.5 rounded-md flex items-center gap-1">
                          <AlertCircle size={10} /> FAILED
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold tracking-wider text-[var(--cobalt)] bg-[var(--cobalt-glow)] px-2 py-0.5 rounded-md animate-pulse">
                          {file.processing_stage.toUpperCase()} ({file.progress}%)
                        </span>
                      )}
                    </div>

                    <span className="badge" style={{ width: 60, justifyContent: "center", fontSize: "0.5625rem" }}>{file.type}</span>
                    <span style={{ width: 80, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>{file.size}</span>
                    <span style={{ width: 100, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>{file.modified}</span>
                    <div className="relative">
                      <button
                        onClick={() => setActiveDropdownFile(activeDropdownFile === file.id ? null : file.id)}
                        className="btn-icon"
                        style={{ width: 28, height: 28, flexShrink: 0 }}
                      >
                        <MoreHorizontal size={14} />
                      </button>
                      <AnimatePresence>
                        {activeDropdownFile === file.id && (
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
                                onClick={() => handleRename()}
                                className="btn-ghost"
                                style={{ justifyContent: "flex-start", width: "100%", fontSize: "0.75rem", padding: "6px 8px", gap: 6 }}
                              >
                                <Edit2 size={12} /> Rename
                              </button>
                              <button
                                onClick={() => handleDelete(file.id, file.name)}
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
                    No matching workspace documents found.
                  </div>
                )}
              </div>
            ) : (
              /* Grid View */
              <div style={{ padding: 16 }}>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {displayFiles.map((file, i) => (
                    <motion.div
                      key={file.id}
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
                          handleDelete(file.id, file.name);
                        }}
                        className="absolute top-2 right-2 btn-icon text-error opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ width: 28, height: 28, background: "var(--bg-glass)" }}
                        title="Delete File"
                      >
                        <Trash2 size={14} />
                      </button>

                      <div style={{ width: 48, height: 48, background: (typeColors[file.type] || "#555") + "1A", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                        <FileText size={24} style={{ color: typeColors[file.type] || "var(--text-tertiary)" }} />
                      </div>
                      <p style={{ fontFamily: "var(--font-headline)", fontWeight: 500, fontSize: "0.8125rem", color: "var(--text-primary)", marginBottom: 6 }} className="truncate">
                        {file.name}
                      </p>

                      <div className="mb-2">
                        {file.status === "indexed" ? (
                          <span className="text-[9px] font-bold tracking-wider text-success bg-[rgba(16,185,129,0.12)] px-1.5 py-0.5 rounded-md">
                            INDEXED
                          </span>
                        ) : file.status === "failed" ? (
                          <span className="text-[9px] font-bold tracking-wider text-error bg-[rgba(239,68,68,0.12)] px-1.5 py-0.5 rounded-md">
                            FAILED
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold tracking-wider text-[var(--cobalt)] bg-[var(--cobalt-glow)] px-1.5 py-0.5 rounded-md animate-pulse">
                            {file.processing_stage.toUpperCase()} ({file.progress}%)
                          </span>
                        )}
                      </div>

                      <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>
                        {file.size} · {file.modified}
                      </p>
                    </motion.div>
                  ))}
                </div>
                {displayFiles.length === 0 && (
                  <div style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)", fontSize: "0.8125rem" }}>
                    No matching workspace documents found.
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
                    <div style={{ width: 56, height: 56, background: (typeColors[selectedFile.type] || "#555") + "1A", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <FileText size={28} style={{ color: typeColors[selectedFile.type] || "var(--text-tertiary)" }} />
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(selectedFile.id, selectedFile.name);
                      }}
                      className="btn-icon text-error"
                      style={{ padding: 4 }}
                      title="Delete document"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <h3 style={{ fontFamily: "var(--font-headline)", fontSize: "1.25rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px", wordBreak: "break-word" }}>
                    {selectedFile.name}
                  </h3>

                  <div className="flex flex-col gap-4 mt-6">
                    <div>
                      <span className="text-label" style={{ color: "var(--text-tertiary)", fontSize: 10, display: "block", marginBottom: 4 }}>STATUS</span>
                      {selectedFile.status === "indexed" ? (
                        <span className="badge text-success bg-[rgba(16,185,129,0.12)] border-[rgba(16,185,129,0.3)]" style={{ fontSize: "0.6875rem" }}>INDEXED</span>
                      ) : selectedFile.status === "failed" ? (
                        <span className="badge text-error bg-[rgba(239,68,68,0.12)] border-[rgba(239,68,68,0.3)]" style={{ fontSize: "0.6875rem" }}>FAILED</span>
                      ) : (
                        <span className="badge text-[var(--cobalt)] bg-[var(--cobalt-glow)] border-blue-900 animate-pulse" style={{ fontSize: "0.6875rem" }}>
                          {selectedFile.processing_stage.toUpperCase()} ({selectedFile.progress}%)
                        </span>
                      )}
                    </div>
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
