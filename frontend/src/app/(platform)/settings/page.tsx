"use client";
import { motion } from "framer-motion";
import { Key, Database, Shield, Save, Sun, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useSettingsStore, useToastStore } from "@/lib/store";

export default function SettingsPage() {
  const { settings, saveSettings } = useSettingsStore();
  const { addToast } = useToastStore();

  const [formSettings, setFormSettings] = useState(settings);
  const [saved, setSaved] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const handleSave = () => {
    saveSettings(formSettings);
    setSaved(true);
    addToast("Configuration changes saved successfully", "success");
    setTimeout(() => setSaved(false), 2000);
  };

  const handleThemeChange = (theme: "light" | "dark" | "midnight" | "cyberpunk" | "warm") => {
    setFormSettings((prev) => ({ ...prev, theme }));
    saveSettings({ theme });
    addToast(`Theme switched to ${theme.toUpperCase()}`, "success");
  };

  return (
    <div style={{ background: "var(--bg-base)" }} className="py-8 px-6 lg:px-10">
      <div style={{ maxWidth: "48rem", margin: "0 auto" }}>
        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="page-header mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 style={{ fontFamily: "var(--font-headline)", fontWeight: 600, letterSpacing: "-0.02em" }}>
                Settings
              </h1>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: 6 }}>
                Configure platform, themes, API keys, and retrieval parameters
              </p>
            </div>
            <button onClick={handleSave} className="btn-primary" style={{ padding: "8px 16px", fontSize: "0.8125rem" }}>
              <Save size={14} />
              {saved ? "Saved!" : "Save Changes"}
            </button>
          </div>
        </motion.div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* ── Theme Switcher ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="card"
            style={{ padding: 20 }}
          >
            <h3 style={{ fontFamily: "var(--font-headline)", fontWeight: 500, fontSize: "0.9375rem", marginBottom: 16 }} className="flex items-center gap-2">
              <Sun size={18} style={{ color: "var(--cobalt)" }} />
              Theme & Style
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                {
                  id: "light" as const,
                  name: "Light Mode",
                  dots: ["#ffffff", "#475569", "#2e5bff"],
                },
                {
                  id: "dark" as const,
                  name: "Dark Slate",
                  dots: ["#0F172A", "#94A3B8", "#2e5bff"],
                },
                {
                  id: "midnight" as const,
                  name: "Midnight Ocean",
                  dots: ["#000000", "#94a3b8", "#0095ff"],
                },
                {
                  id: "cyberpunk" as const,
                  name: "Neon Punk",
                  dots: ["#090310", "#ff007f", "#00ff66"],
                },
                {
                  id: "warm" as const,
                  name: "Spatial Amber",
                  dots: ["#1c1412", "#a8a29e", "#f97316"],
                },
              ].map((themeOpt) => {
                const isActive = formSettings.theme === themeOpt.id;
                return (
                  <button
                    key={themeOpt.id}
                    onClick={() => handleThemeChange(themeOpt.id)}
                    style={{
                      background: isActive ? "var(--bg-tertiary)" : "var(--bg-elevated)",
                      border: isActive ? "1px solid var(--cobalt)" : "1px solid var(--slate-800)",
                      borderRadius: "var(--radius-sm)",
                      padding: "16px 12px",
                      textAlign: "center",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 10,
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.borderColor = "var(--slate-700)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.borderColor = "var(--slate-800)";
                    }}
                  >
                    {/* Color Dots */}
                    <div className="flex gap-1">
                      {themeOpt.dots.map((dot, index) => (
                        <div
                          key={index}
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            background: dot,
                            border: "1px solid var(--slate-700)",
                          }}
                        />
                      ))}
                    </div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-primary)" }}>
                      {themeOpt.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* ── API Configuration ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="card"
            style={{ padding: 0 }}
          >
            <div
              className="flex items-center gap-3"
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--slate-800)",
              }}
            >
              <span style={{ color: "var(--cobalt)" }}>
                <Key size={18} />
              </span>
              <h3 style={{ fontFamily: "var(--font-headline)", fontWeight: 500, fontSize: "0.9375rem" }}>
                API Configuration
              </h3>
            </div>
            <div style={{ padding: "8px 0" }}>
              {/* API Key */}
              <div
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                style={{
                  padding: "12px 20px",
                  borderBottom: "1px solid var(--slate-800)",
                }}
              >
                <label style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--text-primary)" }}>
                  API Key
                </label>
                <div style={{ display: "flex", gap: 6, width: "100%", maxWidth: 300 }}>
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={formSettings.apiKey}
                    onChange={(e) => setFormSettings((prev) => ({ ...prev, apiKey: e.target.value }))}
                    className="input"
                    style={{ padding: "6px 10px", fontSize: "0.8125rem", flex: 1 }}
                  />
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="btn-secondary"
                    style={{ padding: "0 8px" }}
                  >
                    {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Base URL */}
              <div
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                style={{
                  padding: "12px 20px",
                  borderBottom: "1px solid var(--slate-800)",
                }}
              >
                <label style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--text-primary)" }}>
                  Base URL
                </label>
                <input
                  type="text"
                  value={formSettings.baseUrl}
                  onChange={(e) => setFormSettings((prev) => ({ ...prev, baseUrl: e.target.value }))}
                  className="input"
                  style={{ padding: "6px 10px", fontSize: "0.8125rem", maxWidth: 300 }}
                />
              </div>

              {/* Model */}
              <div
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                style={{ padding: "12px 20px" }}
              >
                <label style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--text-primary)" }}>
                  Model selection
                </label>
                <select
                  value={formSettings.model}
                  onChange={(e) => setFormSettings((prev) => ({ ...prev, model: e.target.value }))}
                  style={{
                    background: "var(--slate-950)",
                    border: "1px solid var(--slate-700)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-primary)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.8125rem",
                    padding: "6px 10px",
                    outline: "none",
                    width: "100%",
                    maxWidth: 300,
                  }}
                >
                  <option value="gemini-2.0-flash">gemini-2.0-flash (default)</option>
                  <option value="gpt-4o">gpt-4o</option>
                  <option value="claude-sonnet-4">claude-sonnet-4</option>
                </select>
              </div>
            </div>
          </motion.div>

          {/* ── Retrieval Settings ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
            className="card"
            style={{ padding: 0 }}
          >
            <div
              className="flex items-center gap-3"
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--slate-800)",
              }}
            >
              <span style={{ color: "var(--cobalt)" }}>
                <Database size={18} />
              </span>
              <h3 style={{ fontFamily: "var(--font-headline)", fontWeight: 500, fontSize: "0.9375rem" }}>
                Retrieval Settings
              </h3>
            </div>
            <div style={{ padding: "8px 0" }}>
              {[
                { label: "Chunk Size", key: "chunkSize" as const, type: "number" },
                { label: "Overlap", key: "overlap" as const, type: "number" },
                { label: "Top K Results", key: "topK" as const, type: "number" },
                { label: "Similarity Threshold", key: "similarityThreshold" as const, type: "number", step: "0.05" },
              ].map((field, idx) => (
                <div
                  key={field.key}
                  className="flex items-center justify-between"
                  style={{
                    padding: "12px 20px",
                    borderBottom: idx < 3 ? "1px solid var(--slate-800)" : "none",
                  }}
                >
                  <label style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--text-primary)" }}>
                    {field.label}
                  </label>
                  <input
                    type={field.type}
                    step={field.step}
                    value={formSettings[field.key]}
                    onChange={(e) =>
                      setFormSettings((prev) => ({
                        ...prev,
                        [field.key]: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="input"
                    style={{ padding: "6px 10px", fontSize: "0.8125rem", maxWidth: 120, textAlign: "right" }}
                  />
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── Security ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 }}
            className="card"
            style={{ padding: 0 }}
          >
            <div
              className="flex items-center gap-3"
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--slate-800)",
              }}
            >
              <span style={{ color: "var(--cobalt)" }}>
                <Shield size={18} />
              </span>
              <h3 style={{ fontFamily: "var(--font-headline)", fontWeight: 500, fontSize: "0.9375rem" }}>
                Security Settings
              </h3>
            </div>
            <div style={{ padding: "8px 0" }}>
              {/* Enable SSO */}
              <div
                className="flex items-center justify-between"
                style={{
                  padding: "12px 20px",
                  borderBottom: "1px solid var(--slate-800)",
                }}
              >
                <label style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--text-primary)" }}>
                  Enable SSO Authentication
                </label>
                <div
                  onClick={() =>
                    setFormSettings((prev) => ({ ...prev, enableSso: !prev.enableSso }))
                  }
                  style={{
                    width: 40,
                    height: 22,
                    borderRadius: 11,
                    background: formSettings.enableSso ? "var(--cobalt)" : "var(--slate-700)",
                    padding: 2,
                    cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "white",
                      transform: formSettings.enableSso ? "translateX(18px)" : "translateX(0)",
                      transition: "transform 0.2s",
                    }}
                  />
                </div>
              </div>

              {/* Session Timeout */}
              <div
                className="flex items-center justify-between"
                style={{
                  padding: "12px 20px",
                  borderBottom: "1px solid var(--slate-800)",
                }}
              >
                <label style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--text-primary)" }}>
                  Session Timeout (Minutes)
                </label>
                <input
                  type="number"
                  value={formSettings.sessionTimeout}
                  onChange={(e) =>
                    setFormSettings((prev) => ({
                      ...prev,
                      sessionTimeout: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="input"
                  style={{ padding: "6px 10px", fontSize: "0.8125rem", maxWidth: 120, textAlign: "right" }}
                />
              </div>

              {/* Audit Logging */}
              <div className="flex items-center justify-between" style={{ padding: "12px 20px" }}>
                <label style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--text-primary)" }}>
                  Enable Audit Logging
                </label>
                <div
                  onClick={() =>
                    setFormSettings((prev) => ({ ...prev, auditLogging: !prev.auditLogging }))
                  }
                  style={{
                    width: 40,
                    height: 22,
                    borderRadius: 11,
                    background: formSettings.auditLogging ? "var(--cobalt)" : "var(--slate-700)",
                    padding: 2,
                    cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "white",
                      transform: formSettings.auditLogging ? "translateX(18px)" : "translateX(0)",
                      transition: "transform 0.2s",
                    }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
