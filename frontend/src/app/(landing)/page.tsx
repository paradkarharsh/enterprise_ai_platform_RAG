"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { useAuthStore } from "@/lib/store";
import {
  Cpu, Sparkles, ArrowRight, Shield, BarChart3,
  GitBranch, Search, MessageSquare, FileText, Activity, Check,
} from "lucide-react";

const features = [
  { icon: <Cpu size={22} />, title: "Agentic RAG", desc: "Multi-agent orchestration including retrieval, reranking, and verification agents." },
  { icon: <GitBranch size={22} />, title: "Knowledge Graph", desc: "Extract entity relationship topology and visualize structured knowledge networks." },
  { icon: <Search size={22} />, title: "Enterprise Search", desc: "Hybrid semantic & keyword search with neural reranking and confidence scoring." },
  { icon: <MessageSquare size={22} />, title: "AI Chat Console", desc: "Streaming responses, citations, agent traces, and full conversation memory." },
  { icon: <FileText size={22} />, title: "Workspace Control", desc: "Document repository with inline citation highlights and metadata tags." },
  { icon: <BarChart3 size={22} />, title: "Real-time Analytics", desc: "Track query latency, token usage, accuracy metrics, and costs." },
  { icon: <Shield size={22} />, title: "Enterprise Security", desc: "Granular access control, session timeouts, and full audit logging." },
  { icon: <Activity size={22} />, title: "Pipeline Monitor", desc: "Real-time step execution visualization and latency tracing." },
];

const metrics = [
  { value: "10+", label: "Doc Types" },
  { value: "6", label: "AI Agents" },
  { value: "4", label: "Vector DBs" },
  { value: "94.7%", label: "Accuracy" },
];

const pricingPlans = [
  { name: "Starter", price: "$49", period: "/mo", features: ["5 Users", "10GB Storage", "1,000 queries/day", "Email Support"], popular: false },
  { name: "Professional", price: "$149", period: "/mo", features: ["25 Users", "100GB Storage", "Unlimited queries", "Knowledge Graph", "Priority Support"], popular: true },
  { name: "Enterprise", price: "Custom", period: "", features: ["Unlimited Users", "1TB+ Storage", "Custom Models", "Dedicated Support", "SLA & Audits"], popular: false },
];

export default function LandingPage() {
  const { isAuthenticated } = useAuthStore();
  const authTarget = isAuthenticated ? "/chat" : "/login";

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      {/* ── Navbar ── */}
      <nav
        className="fixed top-0 w-full z-50 transition-all duration-300"
        style={{
          height: "72px",
          background: "var(--bg-glass)",
          borderBottom: "1px solid var(--border-default)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
        }}
      >
        <div className="max-w-7xl mx-auto px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
            >
              <img src="/logo.png" alt="Manthan AI Logo" style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.8)" }} />
            </div>
            <span
              className="text-lg font-semibold"
              style={{ fontFamily: "var(--font-headline)", letterSpacing: "-0.02em" }}
            >
              Manthan AI
            </span>
          </div>
          <div className="hidden md:flex items-center gap-10">
            {["Features", "Pricing"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  transition: "color var(--transition-fast)",
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"}
                onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-secondary)"}
              >
                {item}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <Link href={authTarget} className="btn-ghost" style={{ fontSize: "0.875rem" }}>
              Sign In
            </Link>
            <Link href={authTarget} style={{ textDecoration: "none" }}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-primary"
                style={{ fontSize: "0.875rem" }}
              >
                Get Started <ArrowRight size={14} />
              </motion.button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-40 pb-28 px-8 overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(var(--cobalt-glow-strong) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.4, 0.3] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-12 left-1/4 w-[600px] h-[600px] rounded-full blur-[140px]"
          style={{ background: "var(--cobalt-glow)", opacity: 0.35 }}
        />

        <div className="relative max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
              style={{
                background: "var(--slate-900)",
                border: "1px solid var(--slate-800)",
                color: "var(--cobalt-light)",
                fontSize: "0.75rem",
                fontFamily: "var(--font-mono)",
                fontWeight: 500,
                letterSpacing: "0.03em",
              }}
            >
              <Sparkles size={13} style={{ color: "var(--cobalt)" }} /> POWERED BY MULTI-AGENT ORCHESTRATION
            </div>
            <h1
              className="text-5xl md:text-7xl font-semibold mb-8 leading-[1.1]"
              style={{
                fontFamily: "var(--font-headline)",
                letterSpacing: "-0.04em",
                background: "linear-gradient(180deg, #fff 0%, rgba(255, 255, 255, 0.7) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent"
              }}
            >
              Enterprise AI <br />
              <span style={{ color: "var(--text-tertiary)", WebkitTextFillColor: "var(--text-tertiary)" }}>Knowledge Platform</span>
            </h1>
            <p
              className="text-lg max-w-2xl mx-auto mb-12"
              style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}
            >
              Combine Knowledge Graph Intelligence, Agentic RAG, and Neural Search into a unified enterprise workspace.
            </p>
            <div className="flex items-center gap-4 justify-center">
              <Link href={authTarget} style={{ textDecoration: "none" }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn-primary"
                  style={{ padding: "0.875rem 2rem", fontSize: "1rem" }}
                >
                  Launch Platform <ArrowRight size={18} />
                </motion.button>
              </Link>
              <a href="#features" className="btn-secondary" style={{ padding: "0.875rem 2rem", fontSize: "1rem" }}>
                Explore Features
              </a>
            </div>
          </motion.div>

          {/* Metrics */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-24 max-w-3xl mx-auto"
          >
            {metrics.map((m, i) => (
              <motion.div
                whileHover={{ y: -5 }}
                key={i}
                className="glass-card"
                style={{ padding: "24px", display: "flex", flexDirection: "column", alignItems: "center" }}
              >
                <div
                  style={{
                    fontSize: "2.5rem", fontWeight: 700, color: "var(--cobalt-light)",
                    fontFamily: "var(--font-headline)", letterSpacing: "-0.03em",
                  }}
                >
                  {m.value}
                </div>
                <div
                  className="text-label"
                  style={{ color: "var(--text-tertiary)", marginTop: 6, fontSize: 10 }}
                >
                  {m.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-28 px-8 relative" style={{ borderTop: "1px solid var(--border-default)" }}>
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-20">
            <h2
              className="text-4xl font-semibold mb-6"
              style={{ fontFamily: "var(--font-headline)", letterSpacing: "-0.03em" }}
            >
              Platform Capabilities
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "1.125rem", maxWidth: "600px", margin: "0 auto" }}>
              High-performance tools built for enterprise knowledge synthesis
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <motion.div
                whileHover={{ y: -5 }}
                key={i}
                className="glass-card"
                style={{ padding: "32px 24px" }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-6"
                  style={{ background: "linear-gradient(135deg, var(--cobalt), var(--cobalt-dim))", color: "white", boxShadow: "0 8px 16px var(--cobalt-glow-strong)" }}
                >
                  {f.icon}
                </div>
                <h3
                  className="text-lg font-semibold mb-3"
                  style={{ fontFamily: "var(--font-headline)", color: "var(--text-primary)", letterSpacing: "-0.01em" }}
                >
                  {f.title}
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.6 }}>
                  {f.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-24 px-8" style={{ borderTop: "1px solid var(--slate-800)", background: "var(--bg-elevated)" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2
              className="text-3xl font-semibold mb-4"
              style={{ fontFamily: "var(--font-headline)", letterSpacing: "-0.02em" }}
            >
              Transparent Pricing
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem" }}>
              Deploy in our secure cloud or host on your private infrastructure
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {pricingPlans.map((plan, i) => (
              <div
                key={i}
                className="card"
                style={{
                  padding: "32px",
                  position: "relative",
                  ...(plan.popular && { border: "1px solid var(--cobalt)" }),
                }}
              >
                {plan.popular && (
                  <span
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-semibold"
                    style={{ background: "var(--cobalt)", color: "white", fontFamily: "var(--font-mono)" }}
                  >
                    POPULAR PLAN
                  </span>
                )}
                <h3
                  className="text-lg font-semibold mb-3"
                  style={{ fontFamily: "var(--font-headline)" }}
                >
                  {plan.name}
                </h3>
                <div className="mb-6">
                  <span
                    className="text-4xl font-semibold"
                    style={{ fontFamily: "var(--font-headline)", color: "var(--text-primary)" }}
                  >
                    {plan.price}
                  </span>
                  <span style={{ color: "var(--text-tertiary)", fontSize: "0.8125rem", fontFamily: "var(--font-mono)" }}>
                    {plan.period}
                  </span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>
                      <Check size={14} style={{ color: "var(--cobalt)" }} /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  className={plan.popular ? "btn-primary w-full" : "btn-secondary w-full"}
                  style={{ padding: "10px 0", fontSize: "0.8125rem" }}
                >
                  Get Started
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-12 px-8" style={{ borderTop: "1px solid var(--slate-800)" }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div style={{ width: 18, height: 18, borderRadius: 4, overflow: "hidden" }}>
              <img src="/logo.png" alt="Manthan AI Logo" style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.8)" }} />
            </div>
            <span
              className="font-semibold text-sm"
              style={{ fontFamily: "var(--font-headline)" }}
            >
              Manthan AI
            </span>
          </div>
          <p style={{ color: "var(--text-tertiary)", fontSize: "0.75rem", fontFamily: "var(--font-mono)" }}>
            © 2026 Manthan AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
