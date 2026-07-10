"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { useToastStore } from "@/lib/store";

interface SupportTicket {
  id: string;
  title: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "critical";
  category: "technical" | "billing" | "general";
  created_at: string;
  updated_at: string;
}

const mockTickets: SupportTicket[] = [
  { id: "TKT-104", title: "API Rate limit exceeded", description: "Getting 429 constantly on production.", status: "open", priority: "high", category: "technical", created_at: "2 hours ago", updated_at: "2 hours ago" },
  { id: "TKT-103", title: "Cannot access Q3 Report", description: "Permission denied error on the workspace.", status: "in_progress", priority: "medium", category: "technical", created_at: "4 hours ago", updated_at: "1 hour ago" },
  { id: "TKT-102", title: "Billing cycle update", description: "Need to switch to annual billing.", status: "resolved", priority: "low", category: "billing", created_at: "1 day ago", updated_at: "5 hours ago" },
  { id: "TKT-101", title: "Feature request: Graph Export", description: "Export knowledge graph to PDF.", status: "closed", priority: "low", category: "general", created_at: "3 days ago", updated_at: "1 day ago" },
];

export default function TicketsPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>(mockTickets);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");
  const [search, setSearch] = useState("");
  const { addToast } = useToastStore();

  const fetchTickets = async () => {
    setIsLoading(true);
    try {
      const API_BASE = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000");
      const res = await fetch(`${API_BASE}/api/v1/tickets`);
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) setTickets(data);
      }
    } catch (error) {
      console.error("Failed to fetch tickets", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    try {
      const API_BASE = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000");
      await fetch(`${API_BASE}/api/v1/tickets/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      setTickets(prev => prev.map(t => t.id === id ? { ...t, status: status as SupportTicket['status'] } : t));
      addToast(`Ticket ${id} marked as ${status}`, "success");
    } catch (e) {
      console.error(e);
      addToast(`Failed to update ${id}`, "error");
    }
  };

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) || t.id.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || (filter === "open" && ["open", "in_progress"].includes(t.status)) || (filter === "resolved" && ["resolved", "closed"].includes(t.status));
    return matchesSearch && matchesFilter;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open": return <AlertCircle size={14} className="text-error" />;
      case "in_progress": return <Clock size={14} className="text-warning" />;
      case "resolved": return <CheckCircle2 size={14} className="text-success" />;
      case "closed": return <CheckCircle2 size={14} className="text-slate-500" />;
      default: return <AlertCircle size={14} />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical": return "var(--error)";
      case "high": return "var(--warning)";
      case "medium": return "var(--cobalt)";
      case "low": return "var(--text-tertiary)";
      default: return "var(--text-tertiary)";
    }
  };

  return (
    <div style={{ background: "var(--bg-base)" }} className="py-8 px-6 lg:px-10 relative min-h-[calc(100vh-24px)]">
      <div style={{ maxWidth: "64rem", margin: "0 auto" }}>
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="page-header mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 style={{ fontFamily: "var(--font-headline)", fontWeight: 600, letterSpacing: "-0.02em" }}>
                Support Tickets
              </h1>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: 6 }}>
                Manage escalated human support requests
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="flex items-center px-3 py-2 rounded-lg"
                style={{ background: "var(--bg-glass)", border: "1px solid var(--border-default)" }}
              >
                <Search size={16} className="text-slate-400 mr-2" />
                <input
                  type="text"
                  placeholder="Search tickets..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm w-48 text-[var(--text-primary)]"
                />
              </div>
              <div className="flex" style={{ background: "var(--bg-glass)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", padding: 4 }}>
                {(["all", "open", "resolved"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    style={{
                      padding: "4px 12px", borderRadius: "var(--radius-xs)", fontSize: "0.75rem", fontWeight: 600,
                      background: filter === f ? "var(--cobalt)" : "transparent",
                      color: filter === f ? "white" : "var(--text-tertiary)",
                      border: "none", cursor: "pointer", transition: "all 0.15s", textTransform: "capitalize"
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tickets List */}
        <div className="glass-card overflow-hidden" style={{ padding: 0 }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-default)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontFamily: "var(--font-headline)", fontWeight: 600, fontSize: "1rem" }}>
              Active Queue
            </h3>
            <span className="text-label" style={{ color: "var(--text-tertiary)", fontSize: 11, fontWeight: 600 }}>
              {filteredTickets.length} TICKETS
            </span>
          </div>

          <div className="divide-y divide-[var(--border-subtle)]">
            {isLoading ? (
              <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-[var(--cobalt)]" size={32} /></div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-12 text-center text-[var(--text-tertiary)] text-sm">No tickets found.</div>
            ) : (
              <AnimatePresence>
                {filteredTickets.map((ticket, i) => (
                  <motion.div
                    key={ticket.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-[var(--bg-elevated)] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--cobalt)", background: "var(--cobalt-glow)", padding: "4px 8px", borderRadius: "6px" }}>
                          {ticket.id}
                        </span>
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ background: "var(--bg-base)", border: "1px solid var(--border-subtle)" }}>
                          {getStatusIcon(ticket.status)}
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">{ticket.status.replace("_", " ")}</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ background: "var(--bg-base)", border: "1px solid var(--border-subtle)" }}>
                          <div style={{ width: 6, height: 6, borderRadius: 3, background: getPriorityColor(ticket.priority) }} />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">{ticket.priority} priority</span>
                        </div>
                      </div>
                      <h4 style={{ fontFamily: "var(--font-headline)", fontWeight: 600, fontSize: "1rem", color: "var(--text-primary)", marginBottom: 4 }} className="truncate">
                        {ticket.title}
                      </h4>
                      <p style={{ color: "var(--text-tertiary)", fontSize: "0.875rem" }} className="truncate">
                        {ticket.description}
                      </p>
                    </div>

                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 flex-shrink-0">
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                        {ticket.created_at}
                      </span>
                      {ticket.status !== "resolved" && ticket.status !== "closed" ? (
                        <button
                          onClick={() => updateStatus(ticket.id, "resolved")}
                          className="btn-primary py-1.5 px-3 text-xs flex items-center gap-2 rounded-lg"
                        >
                          <CheckCircle2 size={14} /> Resolve
                        </button>
                      ) : (
                        <button
                          onClick={() => updateStatus(ticket.id, "open")}
                          className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-2 rounded-lg"
                        >
                          <AlertCircle size={14} /> Reopen
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
