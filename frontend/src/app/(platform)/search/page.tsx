"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search as SearchIcon, FileText, Star, Tag, X, Copy, MessageSquare, ArrowLeft, Loader2 } from "lucide-react";
import { useToastStore, useChatStore, useAuthStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

const sourceFilters = ["All", "PDF", "DOCX", "Web", "CSV", "Email"];
interface SearchResult {
  id: string;
  title: string;
  content: string;
  score: number;
  source: string;
  date: string;
  highlights: string[];
}

interface ApiResult {
  id: string;
  title?: string;
  content?: string;
  score?: number;
  source_type?: string;
  metadata?: { created_at?: string };
  highlights?: string[];
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);

  const { addToast } = useToastStore();
  const { addMessage } = useChatStore();
  const token = useAuthStore((s) => s.token);
  const router = useRouter();

  const handleSearch = () => {
    if (query.trim()) {
      setHasSearched(true);
      performSearch(query, activeFilter);
    }
  };

  const performSearch = async (q: string, filter: string) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = (await api.search.query({
        query: q,
        search_type: "hybrid",
        top_k: 20
      }, token || undefined)) as any[];

      let items = res.map((r: ApiResult) => ({
        id: r.id,
        title: r.title || "Untitled Document",
        content: r.content || "",
        score: r.score || 0.0,
        source: r.source_type || "PDF",
        date: r.metadata?.created_at?.split("T")[0] || new Date().toISOString().split("T")[0],
        highlights: r.highlights || []
      }));

      if (filter !== "All") {
        items = items.filter((r: SearchResult) => r.source.toLowerCase() === filter.toLowerCase());
      }
      setResults(items);
    } catch (err: unknown) {
      addToast((err as Error).message || "Failed to execute search", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
    performSearch(query, filter);
  };

  const handleAskAI = (title: string, content: string) => {
    addMessage({
      id: Date.now().toString(),
      role: "user",
      content: `I want to ask about the document **${title}**.\n\nHere is the document content:\n> ${content}`,
      timestamp: new Date().toISOString(),
    });
    addToast("Document context sent to Chat", "success");
    router.push("/chat");
  };

  return (
    <div className="flex flex-col" style={{ background: "var(--bg-base)", height: "calc(100vh - 24px)" }}>
      <div className="flex-1 overflow-y-auto">
        {!hasSearched ? (
          /* ── Empty State ── */
          <div className="flex flex-col items-center justify-center h-full px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="text-center w-full"
              style={{ maxWidth: "680px" }}
            >
              {/* Icon */}
              <div
                className="flex items-center justify-center"
                style={{
                  width: 64, height: 64, borderRadius: "var(--radius)",
                  background: "var(--cobalt)", margin: "0 auto 2rem auto",
                  boxShadow: "0 4px 24px var(--cobalt-glow-strong)",
                }}
              >
                <SearchIcon size={28} color="white" />
              </div>

              <h1 style={{
                fontFamily: "var(--font-headline)", fontSize: "2rem",
                fontWeight: 600, letterSpacing: "-0.02em",
                color: "var(--text-primary)", marginBottom: "0.5rem",
              }}>
                Enterprise Search
              </h1>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem", lineHeight: 1.5, marginBottom: "2.5rem" }}>
                Search across all your documents, knowledge graphs, and data sources
              </p>

              {/* Search Bar */}
              <div
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--slate-800)",
                  borderRadius: "var(--radius)",
                  padding: "8px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--cobalt)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--cobalt-glow)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--slate-800)"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <SearchIcon size={20} className="flex-shrink-0" style={{ color: "var(--text-tertiary)", marginLeft: 4 }} />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Search your enterprise knowledge..."
                  className="flex-1 bg-transparent outline-none"
                  style={{ color: "var(--text-primary)", fontSize: "0.9375rem", fontFamily: "var(--font-body)", padding: "10px 0" }}
                />
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSearch}
                  className="btn-primary"
                  style={{ padding: "0.5rem 1.25rem", whiteSpace: "nowrap" }}
                >
                  Search
                </motion.button>
              </div>

              {/* Filter Chips */}
              <div className="flex items-center justify-center gap-2 mt-5 flex-wrap">
                {sourceFilters.map((f) => (
                  <button
                    key={f}
                    onClick={() => handleFilterChange(f)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "0.75rem",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 500,
                      letterSpacing: "0.03em",
                      background: activeFilter === f ? "var(--cobalt)" : "var(--slate-800)",
                      color: activeFilter === f ? "white" : "var(--slate-400)",
                      border: activeFilter === f ? "none" : "1px solid var(--slate-700)",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <p className="text-label mt-8" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
                POWERED BY HYBRID SEMANTIC + KEYWORD RETRIEVAL WITH AI RERANKING
              </p>
            </motion.div>
          </div>
        ) : (
          /* ── Results State ── */
          <div className="flex flex-col items-center w-full">
            {/* Sticky Search Header */}
            <div
              className="w-full sticky top-0 z-10 px-6 py-4"
              style={{ background: "var(--bg-base)", borderBottom: "1px solid var(--slate-800)" }}
            >
              <div style={{ maxWidth: "680px", margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button
                    onClick={() => { setQuery(""); setHasSearched(false); }}
                    className="btn-icon flex-shrink-0"
                    title="Back to Search"
                    style={{ width: "2.25rem", height: "2.25rem" }}
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div
                    style={{
                      flex: 1,
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--slate-800)",
                      borderRadius: "var(--radius)",
                      padding: "6px 12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <SearchIcon size={18} className="flex-shrink-0" style={{ color: "var(--text-tertiary)", marginLeft: 4 }} />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      placeholder="Search your enterprise knowledge..."
                      className="flex-1 bg-transparent outline-none"
                      style={{ color: "var(--text-primary)", fontSize: "0.8125rem", fontFamily: "var(--font-body)", padding: "8px 0" }}
                    />
                    <button onClick={handleSearch} className="btn-primary" style={{ padding: "0.375rem 1rem", fontSize: "0.75rem" }}>
                      Search
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
                  {sourceFilters.map((f) => (
                    <button
                      key={f}
                      onClick={() => handleFilterChange(f)}
                      style={{
                        padding: "4px 12px",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "0.6875rem",
                        fontFamily: "var(--font-mono)",
                        fontWeight: 500,
                        background: activeFilter === f ? "var(--cobalt)" : "var(--slate-800)",
                        color: activeFilter === f ? "white" : "var(--slate-400)",
                        border: activeFilter === f ? "none" : "1px solid var(--slate-700)",
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Detail Modal ── */}
      <AnimatePresence>
        {selectedResult && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 50,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedResult(null)}
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0, 0, 0, 0.6)",
                backdropFilter: "blur(4px)",
              }}
            />
            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="card"
              style={{
                width: "100%",
                maxWidth: 600,
                position: "relative",
                zIndex: 10,
                padding: 24,
                maxHeight: "85vh",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4 pb-4" style={{ borderBottom: "1px solid var(--slate-800)" }}>
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center justify-center"
                    style={{
                      width: 40, height: 40, borderRadius: "var(--radius-sm)",
                      background: "var(--cobalt-glow)",
                    }}
                  >
                    <FileText size={20} style={{ color: "var(--cobalt)" }} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--text-primary)" }}>
                      {selectedResult.title}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="badge">{selectedResult.source}</span>
                      <span style={{ color: "var(--text-tertiary)", fontSize: "0.6875rem", fontFamily: "var(--font-mono)" }}>
                        {selectedResult.date}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedResult(null)}
                  className="btn-icon"
                  style={{ width: "2rem", height: "2rem", marginTop: -4 }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Content */}
              <div style={{ flex: 1, overflowY: "auto", marginBottom: 20 }}>
                <p style={{
                  color: "var(--text-secondary)",
                  fontSize: "0.875rem",
                  lineHeight: 1.7,
                  whiteSpace: "pre-line",
                }}>
                  {selectedResult.content}
                </p>
                
                {selectedResult.highlights.length > 0 && (
                  <div className="flex items-center gap-2 mt-6 flex-wrap">
                    <span className="text-label" style={{ color: "var(--text-tertiary)", fontSize: 10 }}>HIGHLIGHTS:</span>
                    {selectedResult.highlights.map((h, j) => (
                      <span key={j} className="badge badge-accent">{h}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4" style={{ borderTop: "1px solid var(--slate-800)" }}>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedResult.content);
                    addToast("Document content copied to clipboard", "success");
                  }}
                  className="btn-secondary"
                  style={{ fontSize: "0.75rem", padding: "8px 14px" }}
                >
                  <Copy size={14} /> Copy Text
                </button>
                <button
                  onClick={() => handleAskAI(selectedResult.title, selectedResult.content)}
                  className="btn-primary"
                  style={{ fontSize: "0.75rem", padding: "8px 14px" }}
                >
                  <MessageSquare size={14} /> Ask AI About This
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

            {/* Results List */}
            <div className="w-full px-6 py-6">
              <div className="space-y-3" style={{ maxWidth: "680px", margin: "0 auto" }}>
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                    <Loader2 className="animate-spin text-cobalt" size={32} style={{ color: "var(--cobalt)" }} />
                    <span style={{ fontSize: "0.875rem" }}>Executing neural search...</span>
                  </div>
                ) : results.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                    <span style={{ fontSize: "0.875rem" }}>No results found matching your query.</span>
                  </div>
                ) : (
                  <AnimatePresence>
                    {results.map((r, i) => (
                      <motion.div
                        key={r.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        onClick={() => setSelectedResult(r)}
                        className="cursor-pointer card-interactive"
                        style={{ padding: "20px" }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex items-center justify-center flex-shrink-0"
                              style={{
                                width: 40, height: 40, borderRadius: "var(--radius-sm)",
                                background: "var(--cobalt-glow)",
                              }}
                            >
                              <FileText size={18} style={{ color: "var(--cobalt)" }} />
                            </div>
                            <div>
                              <h3 style={{ fontFamily: "var(--font-headline)", fontWeight: 500, fontSize: "0.9375rem", color: "var(--text-primary)" }}>
                                {r.title}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="badge">{r.source}</span>
                                <span style={{ color: "var(--text-tertiary)", fontSize: "0.6875rem", fontFamily: "var(--font-mono)" }}>{r.date}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 ml-3" style={{
                            padding: "4px 8px", borderRadius: "var(--radius-sm)",
                            background: r.score > 0.9 ? "rgba(16,185,129,0.12)" : "var(--cobalt-glow)",
                          }}>
                            <Star size={11} style={{ color: r.score > 0.9 ? "var(--success)" : "var(--cobalt)" }} />
                            <span style={{
                              color: r.score > 0.9 ? "var(--success)" : "var(--cobalt-light)",
                              fontSize: "0.6875rem", fontFamily: "var(--font-mono)", fontWeight: 500,
                            }}>
                              {(r.score * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>

                        <p style={{ color: "var(--text-secondary)", fontSize: "0.8125rem", lineHeight: 1.6, marginBottom: "12px" }}>
                          {r.content}
                        </p>

                        {r.highlights.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <Tag size={12} style={{ color: "var(--cobalt)" }} />
                            {r.highlights.map((h, j) => (
                              <span key={j} className="badge badge-accent">{h}</span>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
