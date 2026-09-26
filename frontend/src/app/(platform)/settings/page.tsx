"use client";
import { motion } from "framer-motion";
import {
  Key, Database, Shield, Save, Sun, Eye, EyeOff,
  CheckCircle2, AlertCircle, Trash2, Loader2, Sparkles, ExternalLink, Plus
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useSettingsStore, useToastStore, useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const { settings, saveSettings } = useSettingsStore();
  const { addToast } = useToastStore();
  const { token, setHasApiKey } = useAuthStore();

  const [formSettings, setFormSettings] = useState(settings);
  const [saved, setSaved] = useState(false);

  // LLM API Keys state
  const [llmKeysData, setLlmKeysData] = useState<{
    has_api_key: boolean;
    default_provider: string;
    providers: Record<string, { configured: boolean; preview: string | null }>;
  } | null>(null);
  const [newKeyProvider, setNewKeyProvider] = useState("gemini");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [showNewKey, setShowNewKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.auth.getLlmKeys(token);
      setLlmKeysData(data);
      if (data.has_api_key) {
        setHasApiKey(true);
      }
    } catch (err) {
      console.error("Failed to load LLM keys:", err);
    }
  }, [token, setHasApiKey]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleSaveLlmKey = async () => {
    if (!newKeyValue.trim()) {
      setKeyError("Please enter an API key.");
      return;
    }
    setSavingKey(true);
    setKeyError(null);
    try {
      const res = await api.auth.saveLlmKey(
        { provider: newKeyProvider, api_key: newKeyValue.trim(), set_as_default: true, validate_key: true },
        token!
      );
      addToast(res.message || "API key verified and saved successfully", "success");
      setNewKeyValue("");
      fetchKeys();
    } catch (err: any) {
      setKeyError(err.message || "Failed to validate key.");
    } finally {
      setSavingKey(false);
    }
  };

  const handleDeleteLlmKey = async (provider: string) => {
    if (!token) return;
    try {
      await api.auth.deleteLlmKey(provider, token);
      addToast(`${provider.toUpperCase()} key removed`, "info");
      fetchKeys();
    } catch (err: any) {
      addToast(err.message || "Failed to delete key", "error");
    }
  };

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
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--slate-800)" }}>
              <div className="mb-4">
                <h4 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                  Personal AI API Keys (BYOK)
                </h4>
                <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  The platform runs on your personal LLM API keys. Keys are encrypted at rest using AES/HMAC and remembered across logins.
                </p>
              </div>

              {/* Status List of Providers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                {[
                  { id: "gemini", name: "Google Gemini", free: true, link: "https://aistudio.google.com/app/apikey" },
                  { id: "groq", name: "Groq", free: false, link: "https://console.groq.com/keys" },
                  { id: "openai", name: "OpenAI", free: false, link: "https://platform.openai.com/api-keys" },
                  { id: "claude", name: "Anthropic Claude", free: false, link: "https://console.anthropic.com/settings/keys" },
                ].map((prov) => {
                  const info = llmKeysData?.providers?.[prov.id];
                  const isConfigured = info?.configured;
                  return (
                    <div
                      key={prov.id}
                      className="p-3 rounded-xl border flex items-center justify-between gap-3"
                      style={{
                        background: isConfigured ? "rgba(46, 91, 255, 0.05)" : "var(--bg-elevated)",
                        borderColor: isConfigured ? "rgba(46, 91, 255, 0.3)" : "var(--slate-800)",
                      }}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)" }}>
                            {prov.name}
                          </span>
                          {prov.free && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Free
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                          {isConfigured ? (
                            <span className="font-mono text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 size={11} /> {info?.preview || "Configured"}
                            </span>
                          ) : (
                            <a
                              href={prov.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:underline inline-flex items-center gap-0.5"
                            >
                              Get key <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      </div>
                      {isConfigured && (
                        <button
                          type="button"
                          onClick={() => handleDeleteLlmKey(prov.id)}
                          className="btn-ghost p-1.5 text-rose-400 hover:text-rose-300"
                          title={`Remove ${prov.name} key`}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add / Update Key Form */}
              <div
                className="p-4 rounded-xl border"
                style={{
                  background: "var(--bg-elevated)",
                  borderColor: "var(--slate-800)",
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Plus size={14} className="text-blue-400" />
                  <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)" }}>
                    Add or Update Provider Key
                  </span>
                </div>

                {keyError && (
                  <div className="mb-3 p-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{keyError}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={newKeyProvider}
                    onChange={(e) => setNewKeyProvider(e.target.value)}
                    className="input sm:w-44 text-xs"
                    style={{ padding: "8px 10px" }}
                  >
                    <option value="gemini">Google Gemini (Recommended)</option>
                    <option value="groq">Groq</option>
                    <option value="openai">OpenAI</option>
                    <option value="claude">Anthropic Claude</option>
                  </select>

                  <div className="flex-1 relative flex">
                    <input
                      type={showNewKey ? "text" : "password"}
                      value={newKeyValue}
                      onChange={(e) => {
                        setNewKeyValue(e.target.value);
                        setKeyError(null);
                      }}
                      placeholder={`Enter ${newKeyProvider.toUpperCase()} API key...`}
                      className="input text-xs flex-1 pr-9"
                      style={{ padding: "8px 10px" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewKey(!showNewKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showNewKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveLlmKey}
                    disabled={savingKey || !newKeyValue.trim()}
                    className="btn-primary text-xs py-2 px-3 flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
                  >
                    {savingKey ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Validating...</span>
                      </>
                    ) : (
                      <>
                        <Shield size={13} />
                        <span>Validate & Save</span>
                      </>
                    )}
                  </button>
                </div>
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
                  <option value="gemini-2.5-flash">gemini-2.5-flash (default)</option>
                  <option value="gemini-3.8-flash">gemini-3.8-flash</option>
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
