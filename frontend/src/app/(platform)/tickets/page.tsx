"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, CheckCircle2, AlertCircle, Clock, Plus, X, ChevronDown } from "lucide-react";
import { useToastStore, useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";

interface SupportTicket {
  id: string;
  title: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "critical";
  category: "technical" | "billing" | "general";
  created_at: string;
  updated_at: string;
  realId: string;
  isAutoEscalated?: boolean;
}

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

export default function TicketsPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTicket, setNewTicket] = useState({
    department: "technical",
    summary: "",
    priority: "medium",
  });
  const [isCreating, setIsCreating] = useState(false);
  const { addToast } = useToastStore();
  const token = useAuthStore((state) => state.token);

  const fetchTickets = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const data = (await api.tickets.list(token)) as Record<string, unknown>[];
      const mapped: SupportTicket[] = data.map((t: Record<string, unknown> & { id: string, summary: string, status: string, priority: string, department: string, created_at: string, updated_at: string }) => ({
        id: t.id.slice(0, 8).toUpperCase(),
        realId: t.id,
        title: t.summary.split("\n")[0] || "No summary provided",
        description: t.summary || "No description details.",
        status: (t.status || "open") as SupportTicket["status"],
        priority: (t.priority || "medium") as SupportTicket["priority"],
        category: ((t.department || "technical").toLowerCase()) as SupportTicket["category"],
        created_at: formatDistance(t.created_at),
        updated_at: formatDistance(t.updated_at),
        isAutoEscalated: t.is_auto_escalated || false,
      }));
      setTickets(mapped);
    } catch (error: unknown) {
      console.error("Failed to fetch tickets", error);
      addToast(`Failed to fetch tickets: ${(error as Error).message || error}`, "error");
    } finally {
      setIsLoading(false);
    }
  }, [token, addToast]);

  useEffect(() => {
    if (token) {
      setTimeout(() => fetchTickets(), 0);
    }
  }, [token, fetchTickets]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newTicket.summary.trim()) return;
    
    setIsCreating(true);
    try {
      const created = await api.tickets.create(
        {
          department: newTicket.department,
          summary: newTicket.summary,
          priority: newTicket.priority,
        },
        token
      );
      
      const newTicketObj: SupportTicket = {
        id: (created.id as string).slice(0, 8).toUpperCase(),
        realId: created.id as string,
        title: newTicket.summary.split("\n")[0],
        description: newTicket.summary,
        status: "open",
        priority: newTicket.priority as SupportTicket["priority"],
        category: newTicket.department as SupportTicket["category"],
        created_at: "Just now",
        updated_at: "Just now",
      };
      
      setTickets(prev => [newTicketObj, ...prev]);
      setShowCreateModal(false);
      setNewTicket({ department: "technical", summary: "", priority: "medium" });
      addToast("Ticket created successfully", "success");
    } catch (error: unknown) {
      console.error("Failed to create ticket", error);
      addToast(`Failed to create ticket: ${(error as Error).message || error}`, "error");
    } finally {
      setIsCreating(false);
    }
  };

  const updateStatus = async (shortId: string, status: string) => {
    if (!token) return;
    const ticketObj = tickets.find(t => t.id === shortId) as SupportTicket;
    if (!ticketObj) return;

    try {
      await api.tickets.update(ticketObj.realId, { status }, token);
      setTickets(prev => prev.map(t => t.id === shortId ? { ...t, status: status as SupportTicket['status'] } : t));
      addToast(`Ticket ${shortId} marked as ${status}`, "success");
    } catch (e: unknown) {
      console.error(e);
      addToast(`Failed to update ticket: ${(e as Error).message || e}`, "error");
    }
  };

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) || t.id.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || (filter === "open" && ["open", "in_progress"].includes(t.status)) || (filter === "resolved" && ["resolved", "closed"].includes(t.status));
    return matchesSearch && matchesFilter;
  });

  // Count badges
  const openCount = tickets.filter(t => ["open", "in_progress"].includes(t.status)).length;
  const resolvedCount = tickets.filter(t => ["resolved", "closed"].includes(t.status)).length;
  const escalatedCount = tickets.filter(t => t.isAutoEscalated).length;

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
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary flex items-center gap-2"
                style={{ padding: "8px 16px", fontSize: "0.75rem" }}
              >
                <Plus size={14} /> New Ticket
              </button>
            </div>
          </div>
        </motion.div>

        {/* Status Badges */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6 flex flex-wrap gap-2">
          <span className="badge" style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}>
            Open: {openCount}
          </span>
          <span className="badge" style={{ background: "rgba(46,91,255,0.12)", color: "#2e5bff" }}>
            Resolved: {resolvedCount}
          </span>
          {escalatedCount > 0 && (
            <span className="badge" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>
              Auto-Escalated: {escalatedCount}
            </span>
          )}
        </motion.div>

        {/* Tickets List */}
        <div className="glass-card overflow-hidden" style={{ padding: 0 }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-default)", display: "flex", justifyContent: "space-between", alignItems: "center" }} className="flex justify-between items-center">
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
              <div className="p-12 text-center text-[var(--text-tertiary)] text-sm">No support tickets found in this workspace.</div>
            ) : (
              <AnimatePresence>
                {filteredTickets.map((ticket, i) => (
                  <motion.div
                    key={ticket.realId}
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
                        {ticket.isAutoEscalated && (
                          <span className="badge" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", fontSize: "0.5625rem" }}>
                            AUTO-ESCALATED
                          </span>
                        )}
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

      {/* Create Ticket Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md"
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-default)", borderRadius: "16px", boxShadow: "0 24px 48px rgba(0,0,0,0.5)" }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-default)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontFamily: "var(--font-headline)", fontWeight: 600, fontSize: "1.125rem" }}>
                  Create New Ticket
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="btn-icon"
                  style={{ width: "2rem", height: "2rem" }}
                >
                  <X size={16} />
                </button>
              </div>
              <form onSubmit={handleCreateTicket} style={{ padding: "24px" }}>
                <div className="mb-5">
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Department
                  </label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={newTicket.department}
                      onChange={(e) => setNewTicket(prev => ({ ...prev, department: e.target.value }))}
                      className="w-full appearance-none"
                      style={{
                        padding: "12px 40px 12px 14px",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--bg-glass)",
                        border: "1px solid var(--border-default)",
                        color: "var(--text-primary)",
                        fontSize: "0.875rem",
                        cursor: "pointer",
                      }}
                    >
                      <option value="technical">Technical Support</option>
                      <option value="billing">Billing & Payments</option>
                      <option value="general">General Inquiry</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={16} />
                  </div>
                </div>
                <div className="mb-5">
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Priority
                  </label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={newTicket.priority}
                      onChange={(e) => setNewTicket(prev => ({ ...prev, priority: e.target.value }))}
                      className="w-full appearance-none"
                      style={{
                        padding: "12px 40px 12px 14px",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--bg-glass)",
                        border: "1px solid var(--border-default)",
                        color: "var(--text-primary)",
                        fontSize: "0.875rem",
                        cursor: "pointer",
                      }}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={16} />
                  </div>
                </div>
                <div className="mb-6">
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Summary / Description
                  </label>
                  <textarea
                    value={newTicket.summary}
                    onChange={(e) => setNewTicket(prev => ({ ...prev, summary: e.target.value }))}
                    rows={5}
                    placeholder="Describe the issue in detail..."
                    className="w-full resize-y"
                    style={{
                      padding: "12px 14px",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--bg-glass)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                      fontSize: "0.875rem",
                      fontFamily: "var(--font-body)",
                      lineHeight: 1.5,
                      minHeight: "100px",
                    }}
                    required
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="btn-secondary"
                    style={{ padding: "10px 20px" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating || !newTicket.summary.trim()}
                    className="btn-primary"
                    style={{ padding: "10px 20px" }}
                  >
                    {isCreating ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Creating...
                      </>
                    ) : (
                      "Create Ticket"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
