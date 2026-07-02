"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Activity, CheckCircle2, Clock, Play, Pause, RotateCcw, Loader2 } from "lucide-react";
import { useToastStore } from "@/lib/store";

const pipelineSteps = [
  { name: "Document Ingestion", status: "completed", duration: "2.3s", details: "847 documents processed", icon: "📥" },
  { name: "Text Extraction", status: "completed", duration: "4.1s", details: "OCR + parsing complete", icon: "📄" },
  { name: "Chunk & Embed", status: "completed", duration: "12.7s", details: "24,391 chunks generated", icon: "🧩" },
  { name: "Knowledge Graph", status: "running", duration: "—", details: "Building entity relationships", icon: "🔗" },
  { name: "Index & Store", status: "pending", duration: "—", details: "Waiting for graph completion", icon: "💾" },
  { name: "Quality Check", status: "pending", duration: "—", details: "Scheduled after indexing", icon: "✅" },
];

const agents = [
  { name: "Retriever Agent", status: "active", latency: "120ms", tasks: 1247, accuracy: "96.2%" },
  { name: "Reranker Agent", status: "active", latency: "45ms", tasks: 1247, accuracy: "94.8%" },
  { name: "Synthesizer Agent", status: "active", latency: "890ms", tasks: 1103, accuracy: "92.1%" },
  { name: "Validator Agent", status: "idle", latency: "—", tasks: 856, accuracy: "98.7%" },
  { name: "Citation Agent", status: "active", latency: "67ms", tasks: 1103, accuracy: "97.3%" },
];

const statusColors: Record<string, { bg: string; text: string }> = {
  completed: { bg: "rgba(16,185,129,0.12)", text: "#10b981" },
  running: { bg: "rgba(46,91,255,0.12)", text: "#2e5bff" },
  pending: { bg: "rgba(100,116,139,0.12)", text: "#64748b" },
  active: { bg: "rgba(16,185,129,0.12)", text: "#10b981" },
  idle: { bg: "rgba(100,116,139,0.12)", text: "#64748b" },
};

export default function AgentsPage() {
  const [steps, setSteps] = useState(pipelineSteps);
  const [agentsList, setAgentsList] = useState(agents);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { addToast } = useToastStore();

  const handlePause = () => {
    setIsExecuting(false);
    addToast("Pipeline execution paused", "warning");
  };

  const handleRun = () => {
    setIsExecuting(true);
    addToast("Pipeline execution started", "success");
  };

  useEffect(() => {
    if (!isExecuting) return;

    const interval = setInterval(() => {
      setSteps((prevSteps) => {
        const runningIdx = prevSteps.findIndex((s) => s.status === "running");
        
        if (runningIdx !== -1) {
          const updated = [...prevSteps];
          updated[runningIdx] = {
            ...updated[runningIdx],
            status: "completed",
            duration: `${(Math.random() * 5 + 1).toFixed(1)}s`,
          };
          if (runningIdx + 1 < updated.length) {
            updated[runningIdx + 1] = {
              ...updated[runningIdx + 1],
              status: "running",
            };
          } else {
            setTimeout(() => {
              setIsExecuting(false);
              addToast("All pipeline stages completed successfully", "success");
            }, 0);
            clearInterval(interval);
          }
          return updated;
        } else {
          const pendingIdx = prevSteps.findIndex((s) => s.status === "pending");
          if (pendingIdx !== -1) {
            const updated = [...prevSteps];
            updated[pendingIdx] = {
              ...updated[pendingIdx],
              status: "running",
            };
            return updated;
          } else {
            setTimeout(() => addToast("Restarting pipeline execution...", "info"), 0);
            return pipelineSteps.map((s, idx) => ({
              ...s,
              status: idx === 0 ? "running" : "pending",
              duration: "—",
            }));
          }
        }
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [isExecuting, addToast]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    addToast("Refreshing agent metrics...", "info");
    setTimeout(() => {
      setIsRefreshing(false);
      addToast("Metrics updated with live analytics", "success");
      setAgentsList((prev) =>
        prev.map((agent) => {
          if (agent.status === "active") {
            const currentLatency = parseInt(agent.latency);
            const delta = Math.floor(Math.random() * 20 - 10);
            const newLatency = Math.max(10, currentLatency + delta);
            const newTasks = agent.tasks + Math.floor(Math.random() * 5 + 1);
            return {
              ...agent,
              latency: `${newLatency}ms`,
              tasks: newTasks,
            };
          }
          return agent;
        })
      );
    }, 1000);
  };

  return (
    <div style={{ background: "var(--bg-base)" }} className="py-8 px-6 lg:px-10">
      <div style={{ maxWidth: "64rem", margin: "0 auto" }}>
        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="page-header mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 style={{ fontFamily: "var(--font-headline)", fontWeight: 600, letterSpacing: "-0.02em" }}>
                Pipeline
              </h1>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: 6 }}>
                Monitor RAG pipeline stages and agent performance
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePause}
                disabled={!isExecuting}
                className="btn-secondary"
                style={{ padding: "6px 12px", fontSize: "0.75rem" }}
              >
                <Pause size={14} /> Pause
              </button>
              <button
                onClick={handleRun}
                disabled={isExecuting}
                className="btn-primary"
                style={{ padding: "6px 12px", fontSize: "0.75rem" }}
              >
                <Play size={14} /> Run Pipeline
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── Pipeline Steps ── */}
        <div className="card mb-4" style={{ padding: "24px" }}>
          <h3 style={{ fontFamily: "var(--font-headline)", fontWeight: 500, fontSize: "1rem", marginBottom: 20 }}>
            Pipeline Stages
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <div className="flex items-center gap-4" style={{ padding: "14px 0" }}>
                  {/* Status Line */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 24, flexShrink: 0 }}>
                    {step.status === "completed" ? (
                      <CheckCircle2 size={18} style={{ color: "#10b981" }} />
                    ) : step.status === "running" ? (
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <Activity size={18} style={{ color: "var(--cobalt)" }} />
                      </motion.div>
                    ) : (
                      <Clock size={18} style={{ color: "var(--text-tertiary)" }} />
                    )}
                    {i < steps.length - 1 && (
                      <div style={{
                        width: 1, height: 24, marginTop: 4,
                        background: step.status === "completed" ? "#10b981" : "var(--slate-700)",
                        ...(step.status !== "completed" && { backgroundImage: "repeating-linear-gradient(to bottom, var(--slate-700) 0, var(--slate-700) 4px, transparent 4px, transparent 8px)" }),
                      }} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span style={{ fontSize: "1rem" }}>{step.icon}</span>
                      <span style={{ fontFamily: "var(--font-headline)", fontWeight: 500, fontSize: "0.875rem", color: "var(--text-primary)" }}>
                        {step.name}
                      </span>
                      <span className="badge" style={{
                        ...statusColors[step.status],
                        background: statusColors[step.status].bg,
                        color: statusColors[step.status].text,
                        fontSize: "0.5625rem",
                      }}>
                        {step.status.toUpperCase()}
                      </span>
                    </div>
                    <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--text-tertiary)", marginTop: 4, marginLeft: 28 }}>
                      {step.details} {step.duration !== "—" && `· ${step.duration}`}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Agent Cards ── */}
        <div className="card" style={{ padding: "24px" }}>
          <div className="flex items-center justify-between mb-5">
            <h3 style={{ fontFamily: "var(--font-headline)", fontWeight: 500, fontSize: "1rem" }}>
              Active Agents
            </h3>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="btn-ghost"
              style={{ fontSize: "0.75rem" }}
            >
              {isRefreshing ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <RotateCcw size={13} />
              )}
              {" "}Refresh
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {agentsList.map((agent, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.06 }}
                style={{
                  padding: "16px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg-base)",
                  border: "1px solid var(--slate-800)",
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span style={{ fontFamily: "var(--font-headline)", fontWeight: 500, fontSize: "0.8125rem", color: "var(--text-primary)" }}>
                    {agent.name}
                  </span>
                  <span className="badge" style={{
                    ...statusColors[agent.status],
                    background: statusColors[agent.status].bg,
                    color: statusColors[agent.status].text,
                    fontSize: "0.5625rem",
                  }}>
                    {agent.status.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "LATENCY", value: agent.latency },
                    { label: "TASKS", value: agent.tasks.toLocaleString() },
                    { label: "ACCURACY", value: agent.accuracy },
                  ].map((metric, j) => (
                    <div key={j}>
                      <p className="text-label" style={{ color: "var(--text-tertiary)", fontSize: 9, marginBottom: 2 }}>{metric.label}</p>
                      <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 500, color: "var(--text-primary)" }}>
                        {metric.value}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
