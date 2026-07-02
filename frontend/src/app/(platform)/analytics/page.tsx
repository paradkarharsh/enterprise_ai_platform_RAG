"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, Clock, Target, Zap, Users, FileText, DollarSign, ArrowUp, ArrowDown } from "lucide-react";
import { useToastStore } from "@/lib/store";

const kpis = [
  { label: "Total Queries", value: "12,847", change: "+12.5%", up: true, icon: <BarChart3 size={18} />, color: "#2e5bff" },
  { label: "Avg Latency", value: "1.2s", change: "-8.3%", up: true, icon: <Clock size={18} />, color: "#10b981" },
  { label: "Accuracy", value: "94.7%", change: "+2.1%", up: true, icon: <Target size={18} />, color: "#b8c3ff" },
  { label: "Hallucination Rate", value: "2.3%", change: "-1.4%", up: true, icon: <Zap size={18} />, color: "#f59e0b" },
  { label: "Active Users", value: "342", change: "+28", up: true, icon: <Users size={18} />, color: "#3b82f6" },
  { label: "Documents", value: "1,205", change: "+45", up: true, icon: <FileText size={18} />, color: "#b7c8e1" },
  { label: "Token Usage", value: "4.2M", change: "+15%", up: false, icon: <TrendingUp size={18} />, color: "#ef4444" },
  { label: "Cost (MTD)", value: "$127.40", change: "+$18", up: false, icon: <DollarSign size={18} />, color: "#f97316" },
];

const queryData = [
  { day: "Mon", queries: 1820, latency: 1.3 },
  { day: "Tue", queries: 2100, latency: 1.1 },
  { day: "Wed", queries: 1950, latency: 1.4 },
  { day: "Thu", queries: 2400, latency: 1.0 },
  { day: "Fri", queries: 2200, latency: 1.2 },
  { day: "Sat", queries: 1100, latency: 0.9 },
  { day: "Sun", queries: 877, latency: 0.8 },
];

const topDocs = [
  { name: "AI Strategy 2024.pdf", queries: 342, score: 0.96 },
  { name: "Q3 Financial Report.xlsx", queries: 289, score: 0.94 },
  { name: "Product Roadmap.pptx", queries: 234, score: 0.91 },
  { name: "Engineering Handbook.docx", queries: 198, score: 0.89 },
  { name: "Customer Research.pdf", queries: 167, score: 0.87 },
];

const rangeData: Record<string, {
  kpis: typeof kpis;
  queryData: typeof queryData;
}> = {
  "24h": {
    kpis: [
      { label: "Total Queries", value: "1,424", change: "+4.1%", up: true, icon: <BarChart3 size={18} />, color: "#2e5bff" },
      { label: "Avg Latency", value: "0.9s", change: "-12.5%", up: true, icon: <Clock size={18} />, color: "#10b981" },
      { label: "Accuracy", value: "95.2%", change: "+0.8%", up: true, icon: <Target size={18} />, color: "#b8c3ff" },
      { label: "Hallucination Rate", value: "1.8%", change: "-0.5%", up: true, icon: <Zap size={18} />, color: "#f59e0b" },
      { label: "Active Users", value: "94", change: "+12", up: true, icon: <Users size={18} />, color: "#3b82f6" },
      { label: "Documents", value: "1,192", change: "+2", up: true, icon: <FileText size={18} />, color: "#b7c8e1" },
      { label: "Token Usage", value: "480K", change: "+8%", up: false, icon: <TrendingUp size={18} />, color: "#ef4444" },
      { label: "Cost (MTD)", value: "$14.20", change: "+$2", up: false, icon: <DollarSign size={18} />, color: "#f97316" },
    ],
    queryData: [
      { day: "00:00", queries: 120, latency: 0.9 },
      { day: "04:00", queries: 80, latency: 0.8 },
      { day: "08:00", queries: 250, latency: 1.1 },
      { day: "12:00", queries: 410, latency: 1.0 },
      { day: "16:00", queries: 320, latency: 0.9 },
      { day: "20:00", queries: 244, latency: 0.8 },
    ]
  },
  "7d": {
    kpis: kpis,
    queryData: queryData
  },
  "30d": {
    kpis: [
      { label: "Total Queries", value: "54,281", change: "+18.2%", up: true, icon: <BarChart3 size={18} />, color: "#2e5bff" },
      { label: "Avg Latency", value: "1.3s", change: "+2.1%", up: false, icon: <Clock size={18} />, color: "#10b981" },
      { label: "Accuracy", value: "94.1%", change: "+1.5%", up: true, icon: <Target size={18} />, color: "#b8c3ff" },
      { label: "Hallucination Rate", value: "2.5%", change: "-0.8%", up: true, icon: <Zap size={18} />, color: "#f59e0b" },
      { label: "Active Users", value: "1,248", change: "+148", up: true, icon: <Users size={18} />, color: "#3b82f6" },
      { label: "Documents", value: "1,205", change: "+180", up: true, icon: <FileText size={18} />, color: "#b7c8e1" },
      { label: "Token Usage", value: "18.4M", change: "+24%", up: false, icon: <TrendingUp size={18} />, color: "#ef4444" },
      { label: "Cost (MTD)", value: "$524.80", change: "+$82", up: false, icon: <DollarSign size={18} />, color: "#f97316" },
    ],
    queryData: [
      { day: "Wk 1", queries: 12400, latency: 1.2 },
      { day: "Wk 2", queries: 14100, latency: 1.3 },
      { day: "Wk 3", queries: 13900, latency: 1.4 },
      { day: "Wk 4", queries: 13881, latency: 1.1 },
    ]
  }
};

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("7d");
  const { addToast } = useToastStore();

  const currentData = rangeData[timeRange];
  const maxQueries = Math.max(...currentData.queryData.map(d => d.queries));

  const handleTimeRangeChange = (range: "24h" | "7d" | "30d") => {
    setTimeRange(range);
    addToast(`Analytics range set to ${range === "24h" ? "Last 24 Hours" : range === "7d" ? "Last 7 Days" : "Last 30 Days"}`, "success");
  };

  return (
    <div style={{ background: "var(--bg-base)" }} className="py-8 px-6 lg:px-10">
      <div style={{ maxWidth: "64rem", margin: "0 auto" }}>
        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="page-header mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 style={{ fontFamily: "var(--font-headline)", fontWeight: 600, letterSpacing: "-0.02em" }}>
              Analytics
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: 6 }}>
              Monitor platform performance, usage patterns, and costs in real-time
            </p>
          </div>
          {/* Time Range Selector */}
          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded" style={{ alignSelf: "flex-start", borderRadius: "var(--radius-sm)" }}>
            {(["24h", "7d", "30d"] as const).map((r) => (
              <button
                key={r}
                onClick={() => handleTimeRangeChange(r)}
                style={{
                  padding: "4px 12px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  borderRadius: "var(--radius-xs)",
                  border: "none",
                  cursor: "pointer",
                  background: timeRange === r ? "var(--cobalt)" : "transparent",
                  color: timeRange === r ? "white" : "var(--slate-400)",
                  transition: "all 0.15s",
                }}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {currentData.kpis.map((kpi, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, type: "spring", stiffness: 200, damping: 20 }}
              whileHover={{ y: -4 }}
              className="glass-card flex flex-col justify-between"
              style={{ padding: "24px", minHeight: "140px" }}
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: 36, height: 36, borderRadius: "var(--radius-sm)",
                    background: kpi.color + "14", color: kpi.color,
                  }}
                >
                  {kpi.icon}
                </div>
                <div className="flex items-center gap-1" style={{
                  fontSize: "0.6875rem", fontWeight: 600, fontFamily: "var(--font-mono)",
                  color: kpi.up ? "var(--success)" : "var(--error)",
                }}>
                  {kpi.up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                  {kpi.change}
                </div>
              </div>
              <p style={{
                fontSize: "1.75rem", fontWeight: 700, color: "var(--text-primary)",
                fontFamily: "var(--font-headline)", letterSpacing: "-0.03em", lineHeight: 1.1,
              }}>
                {kpi.value}
              </p>
              <p className="text-label" style={{ color: "var(--text-tertiary)", marginTop: 6, fontSize: 11, fontWeight: 600 }}>
                {kpi.label.toUpperCase()}
              </p>
            </motion.div>
          ))}
        </div>

        {/* ── Charts Row ── */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Queries Chart */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="lg:col-span-2 glass-card"
            style={{ padding: "32px" }}
          >
            <h3 style={{
              fontFamily: "var(--font-headline)", fontWeight: 500,
              fontSize: "1rem", color: "var(--text-primary)", marginBottom: 24,
            }}>
              Queries Per Day
            </h3>
            <div className="flex items-end gap-3" style={{ height: "200px" }}>
              {currentData.queryData.map((d, i) => {
                const barHeight = Math.max((d.queries / maxQueries) * 168, 8);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end gap-2 h-full">
                    <span style={{
                      fontSize: "0.625rem", fontFamily: "var(--font-mono)",
                      fontWeight: 500, color: "var(--text-tertiary)",
                    }}>
                      {d.queries.toLocaleString()}
                    </span>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: barHeight }}
                      transition={{ delay: i * 0.1, duration: 0.8, type: "spring", stiffness: 100 }}
                      className="w-full"
                      style={{
                        background: "linear-gradient(180deg, var(--cobalt) 0%, var(--cobalt-dim) 100%)",
                        borderRadius: "8px",
                        minHeight: "12px",
                        boxShadow: "0 4px 12px var(--cobalt-glow-strong)",
                      }}
                    />
                    <span style={{
                      fontSize: "0.6875rem", fontFamily: "var(--font-mono)",
                      fontWeight: 600, color: "var(--text-tertiary)",
                    }}>
                      {d.day}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Top Documents */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="glass-card"
            style={{ padding: "32px" }}
          >
            <h3 style={{
              fontFamily: "var(--font-headline)", fontWeight: 500,
              fontSize: "1rem", color: "var(--text-primary)", marginBottom: 20,
            }}>
              Most Queried Documents
            </h3>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {topDocs.map((doc, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 hover:bg-white/5 p-2 rounded-xl transition-colors"
                  style={{
                    padding: "12px",
                    borderBottom: i < topDocs.length - 1 ? "1px solid var(--border-subtle)" : "none",
                  }}
                >
                  <div style={{
                    fontSize: "0.75rem", fontFamily: "var(--font-mono)",
                    fontWeight: 700, color: "var(--cobalt)", width: 28, textAlign: "center",
                    background: "var(--cobalt-glow)", borderRadius: "8px", padding: "4px 0"
                  }}>
                    #{i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{
                      fontSize: "0.8125rem", fontFamily: "var(--font-headline)",
                      fontWeight: 500, color: "var(--text-primary)",
                    }} className="truncate">
                      {doc.name}
                    </p>
                    <p style={{
                      fontSize: "0.6875rem", fontFamily: "var(--font-mono)",
                      color: "var(--text-tertiary)", marginTop: 2,
                    }}>
                      {doc.queries} queries
                    </p>
                  </div>
                  <span className="badge badge-success">{(doc.score * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
