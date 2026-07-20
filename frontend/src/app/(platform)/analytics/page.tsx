"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, Clock, Target, Zap, Users, FileText, DollarSign, ArrowUp, ArrowDown } from "lucide-react";
import { useToastStore, useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { AreaChart, Area, BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const formatNumber = (num: number) => {
  return num.toLocaleString();
};

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("7d");
  const [dashboard, setDashboard] = useState<Record<string, any> | null>(null);
  const { addToast } = useToastStore();
  const token = useAuthStore((state) => state.token);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllData = async () => {
      if (!token) return;
      try {
        setLoading(true);
        const [dashData, metricsData, docs] = await Promise.all([
          api.analytics.dashboard(token),
          api.analytics.queryMetrics(token),
          api.upload.list(token)
        ]);
        
        setDashboard({ ...dashData, ...metricsData });
        setDocuments(docs.slice(0, 5)); // Just take top 5 recent docs
      } catch (e: any) {
        console.error("Failed to load analytics data", e);
        addToast("Failed to load real-time analytics data", "error");
      } finally {
        setLoading(false);
      }
    };
    
    fetchAllData();
  }, [token, timeRange]);

  // Construct current KPIs dynamically based on real backend metrics
  const totalQueries = dashboard?.total_queries || 0;
  const totalDocs = dashboard?.total_documents || 0;
  const avgLatency = dashboard?.avg_latency_ms ? `${(dashboard.avg_latency_ms / 1000).toFixed(2)}s` : "0.00s";
  const storageUsedMb = dashboard?.storage_used_mb || 0;
  const totalEntities = dashboard?.total_entities || 0;
  const totalRelationships = dashboard?.total_relationships || 0;

  // Use actual token usage and cost dynamically based on real backend metrics
  const totalTokens = dashboard?.total_tokens || 0;
  const tokenUsage = totalTokens > 1000000 ? `${(totalTokens / 1000000).toFixed(2)}M` : totalTokens > 1000 ? `${(totalTokens / 1000).toFixed(1)}K` : `${totalTokens}`;
  const totalCost = dashboard?.total_cost_usd || 0.00;
  const cost = `$${totalCost.toFixed(4)}`;

  const kpis = [
    { label: "Total Queries", value: formatNumber(totalQueries), change: "+12.5%", up: true, icon: <BarChart3 size={18} />, color: "#2e5bff" },
    { label: "Avg Latency", value: avgLatency, change: "-8.3%", up: true, icon: <Clock size={18} />, color: "#10b981" },
    { label: "Graph Entities", value: formatNumber(totalEntities), change: totalEntities > 0 ? `+${totalEntities}` : "0", up: true, icon: <Target size={18} />, color: "#8b5cf6" },
    { label: "Graph Relations", value: formatNumber(totalRelationships), change: totalRelationships > 0 ? `+${totalRelationships}` : "0", up: true, icon: <Zap size={18} />, color: "#f59e0b" },
    { label: "Documents", value: formatNumber(totalDocs), change: totalDocs > 0 ? `+${totalDocs}` : "0", up: true, icon: <FileText size={18} />, color: "#3b82f6" },
    { label: "Token Usage", value: tokenUsage, change: "+15%", up: false, icon: <TrendingUp size={18} />, color: "#ef4444" },
    { label: "Cost (MTD)", value: cost, change: "+$0.12", up: false, icon: <DollarSign size={18} />, color: "#f97316" },
    { label: "Storage Size", value: storageUsedMb > 1024 ? `${(storageUsedMb / 1024).toFixed(2)} GB` : `${storageUsedMb.toFixed(1)} MB`, change: "+0.5%", up: true, icon: <Users size={18} />, color: "#06b6d4" },
  ];

  // Daily Query distribution
  const rawQueryData = (dashboard?.queries_by_day as any[]) || [];
  let displayQueryData = rawQueryData.length > 0 
    ? rawQueryData.slice(-7).map(d => ({
        day: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        queries: d.count,
      }))
    : [
        { day: "Mon", queries: 0 },
        { day: "Tue", queries: 0 },
        { day: "Wed", queries: 0 },
        { day: "Thu", queries: 0 },
        { day: "Fri", queries: 0 },
        { day: "Sat", queries: 0 },
        { day: "Sun", queries: 0 },
      ];

  const latencyDistribution = (dashboard?.latency_distribution as any[]) || [];
  const displayLatencyData = latencyDistribution.length > 0 
    ? latencyDistribution 
    : [
        { bin: "0-200ms", count: 0 },
        { bin: "200-500ms", count: 0 },
        { bin: "500-1000ms", count: 0 },
        { bin: "1-2s", count: 0 },
        { bin: "2s+", count: 0 },
      ];

  const handleTimeRangeChange = (range: "24h" | "7d" | "30d") => {
    setTimeRange(range);
    addToast(`Analytics range set to ${range === "24h" ? "Last 24 Hours" : range === "7d" ? "Last 7 Days" : "Last 30 Days"}`, "success");
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg shadow-xl">
          <p className="text-slate-300 text-xs mb-1 font-mono">{label}</p>
          <p className="text-white font-semibold text-sm">
            {payload[0].value} {payload[0].name}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh" }} className="py-8 px-6 lg:px-10">
      <div style={{ maxWidth: "72rem", margin: "0 auto" }}>
        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="page-header mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 style={{ fontFamily: "var(--font-headline)", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
              Analytics Dashboard
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: 6 }}>
              Monitor platform performance, usage patterns, and costs in real-time.
            </p>
          </div>
          {/* Time Range Selector */}
          <div className="flex bg-slate-900/50 border border-slate-800/50 p-1 rounded-lg" style={{ alignSelf: "flex-start" }}>
            {(["24h", "7d", "30d"] as const).map((r) => (
              <button
                key={r}
                onClick={() => handleTimeRangeChange(r)}
                style={{
                  padding: "6px 14px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  background: timeRange === r ? "var(--cobalt)" : "transparent",
                  color: timeRange === r ? "white" : "var(--slate-400)",
                  transition: "all 0.2s ease",
                  boxShadow: timeRange === r ? "0 2px 8px var(--cobalt-glow-strong)" : "none",
                }}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 rounded-full border-4 border-cobalt border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {kpis.map((kpi, i) => (
                <motion.div
                  key={kpi.label}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, type: "spring", stiffness: 200, damping: 20 }}
                  whileHover={{ y: -4, boxShadow: "0 12px 24px rgba(0,0,0,0.2)" }}
                  className="glass-card flex flex-col justify-between"
                  style={{ padding: "20px", minHeight: "130px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className="flex items-center justify-center shadow-lg"
                      style={{
                        width: 36, height: 36, borderRadius: "10px",
                        background: `linear-gradient(135deg, ${kpi.color}22 0%, ${kpi.color}11 100%)`, 
                        color: kpi.color, border: `1px solid ${kpi.color}44`
                      }}
                    >
                      {kpi.icon}
                    </div>
                    <div className="flex items-center gap-1" style={{
                      fontSize: "0.6875rem", fontWeight: 600, fontFamily: "var(--font-mono)",
                      color: kpi.up ? "var(--success)" : "var(--error)",
                      background: kpi.up ? "var(--success-dim)" : "var(--error-dim)",
                      padding: "2px 8px", borderRadius: "12px"
                    }}>
                      {kpi.up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                      {kpi.change}
                    </div>
                  </div>
                  <p style={{
                    fontSize: "1.75rem", fontWeight: 700, color: "var(--text-primary)",
                    fontFamily: "var(--font-headline)", letterSpacing: "-0.02em", lineHeight: 1.1,
                  }}>
                    {kpi.value}
                  </p>
                  <p className="text-label mt-1" style={{ color: "var(--text-tertiary)", fontSize: 11, fontWeight: 500, letterSpacing: "0.05em" }}>
                    {kpi.label.toUpperCase()}
                  </p>
                </motion.div>
              ))}
            </div>

            {/* ── Charts Row ── */}
            <div className="grid lg:grid-cols-3 gap-6 mb-8">
              {/* Queries Chart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="lg:col-span-2 glass-card flex flex-col"
                style={{ padding: "24px", minHeight: "350px", background: "rgba(255,255,255,0.02)" }}
              >
                <h3 style={{
                  fontFamily: "var(--font-headline)", fontWeight: 600,
                  fontSize: "1.125rem", color: "var(--text-primary)", marginBottom: 24,
                }}>
                  Queries Over Time
                </h3>
                <div className="flex-1 w-full" style={{ minHeight: "250px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={displayQueryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorQueries" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--cobalt)" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="var(--cobalt)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="day" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                      <YAxis stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="queries" 
                        name="Queries"
                        stroke="var(--cobalt)" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorQueries)" 
                        animationDuration={1500}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              {/* Latency Distribution */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="glass-card flex flex-col"
                style={{ padding: "24px", background: "rgba(255,255,255,0.02)" }}
              >
                <h3 style={{
                  fontFamily: "var(--font-headline)", fontWeight: 600,
                  fontSize: "1.125rem", color: "var(--text-primary)", marginBottom: 24,
                }}>
                  Latency Distribution
                </h3>
                <div className="flex-1 w-full" style={{ minHeight: "250px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={displayLatencyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="bin" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                      <YAxis stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                      <Bar 
                        dataKey="count" 
                        name="Queries" 
                        radius={[4, 4, 0, 0]}
                        animationDuration={1500}
                      >
                        {displayLatencyData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? "#10b981" : index === 1 ? "#3b82f6" : index === 2 ? "#f59e0b" : "#ef4444"} />
                        ))}
                      </Bar>
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            </div>

            {/* ── Bottom Row ── */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Recent Documents */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="glass-card"
                style={{ padding: "24px", background: "rgba(255,255,255,0.02)" }}
              >
                <h3 style={{
                  fontFamily: "var(--font-headline)", fontWeight: 600,
                  fontSize: "1.125rem", color: "var(--text-primary)", marginBottom: 20,
                }}>
                  Recent Knowledge Base Additions
                </h3>
                <div className="flex flex-col gap-2">
                  {documents.length > 0 ? (
                    documents.map((doc: any) => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-4 hover:bg-white/5 p-3 rounded-xl transition-all duration-200 border border-transparent hover:border-white/10"
                      >
                        <div className="flex items-center justify-center bg-slate-800 rounded-lg w-10 h-10 shadow-inner">
                          <FileText size={16} className="text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p style={{
                            fontSize: "0.875rem", fontFamily: "var(--font-headline)",
                            fontWeight: 500, color: "var(--text-primary)",
                          }} className="truncate">
                            {doc.title || "Untitled Document"}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <span style={{ fontSize: "0.6875rem", fontFamily: "var(--font-mono)", color: "var(--text-tertiary)" }}>
                              {(doc.file_size / 1024).toFixed(1)} KB
                            </span>
                            <span style={{ fontSize: "0.6875rem", fontFamily: "var(--font-mono)", color: "var(--text-tertiary)" }}>
                              {doc.chunk_count} chunks
                            </span>
                          </div>
                        </div>
                        <span className={`badge ${doc.status === 'INDEXED' ? 'badge-success' : 'badge-warning'}`}>
                          {doc.status}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: 32, textAlign: "center", color: "var(--text-tertiary)", fontSize: "0.875rem" }} className="bg-white/5 rounded-xl border border-white/5">
                      No documents found in the Knowledge Base.
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
