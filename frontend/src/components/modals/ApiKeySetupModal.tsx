"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Key,
  ShieldCheck,
  ExternalLink,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useAuthStore, useToastStore } from "@/lib/store";
import { api } from "@/lib/api";

interface ProviderOption {
  id: string;
  name: string;
  recommended?: boolean;
  link: string;
  linkText: string;
  placeholder: string;
  badge?: string;
  description: string;
}

const PROVIDERS: ProviderOption[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    recommended: true,
    badge: "Free & Recommended",
    link: "https://aistudio.google.com/app/apikey",
    linkText: "Get free Gemini API Key from Google AI Studio",
    placeholder: "AIzaSy...",
    description: "Generous free tier with fast inference and large context windows.",
  },
  {
    id: "groq",
    name: "Groq",
    badge: "Ultra Fast",
    link: "https://console.groq.com/keys",
    linkText: "Get API Key from Groq Console",
    placeholder: "gsk_...",
    description: "Blazing fast Llama-3.1 and Mixtral inference.",
  },
  {
    id: "openai",
    name: "OpenAI",
    link: "https://platform.openai.com/api-keys",
    linkText: "Get API Key from OpenAI Platform",
    placeholder: "sk-...",
    description: "Industry-standard GPT-4o and reasoning models.",
  },
  {
    id: "claude",
    name: "Anthropic Claude",
    link: "https://console.anthropic.com/settings/keys",
    linkText: "Get API Key from Anthropic Console",
    placeholder: "sk-ant-...",
    description: "Claude 3.5 Sonnet and Haiku models.",
  },
];

export function ApiKeySetupModal() {
  const { user, token, setHasApiKey } = useAuthStore();
  const { addToast } = useToastStore();

  const [selectedProvider, setSelectedProvider] = useState<string>("gemini");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If user is not authenticated or already has an API key configured, don't show modal
  if (!user || user.has_api_key) {
    return null;
  }

  const currentProvider = PROVIDERS.find((p) => p.id === selectedProvider) || PROVIDERS[0];

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setErrorMsg("Please enter a valid API key.");
      return;
    }

    if (!token) {
      setErrorMsg("You must be logged in to save your API key.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await api.auth.saveLlmKey(
        {
          provider: selectedProvider,
          api_key: apiKey.trim(),
          set_as_default: true,
          validate_key: true,
        },
        token
      );

      setHasApiKey(true);
      addToast(res.message || "API key verified and saved successfully!", "success");
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("Load failed")) {
        setErrorMsg("Unable to connect to the backend server. Please verify your backend service is running and accessible.");
      } else {
        setErrorMsg(msg || "Failed to validate API key. Please verify your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        style={{
          background: "rgba(3, 7, 18, 0.75)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
          <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="relative w-full max-w-lg overflow-hidden rounded-2xl border"
          style={{
            background: "linear-gradient(180deg, #0d1322 0%, #070a12 100%)",
            borderColor: "rgba(255, 255, 255, 0.12)",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.9), 0 0 40px rgba(46, 91, 255, 0.25)",
            color: "#FFFFFF",
          }}
        >
          {/* Ambient subtle glow header bar */}
          <div
            className="h-1.5 w-full"
            style={{
              background: "linear-gradient(90deg, #2E5BFF 0%, #00D2FF 50%, #9B51E0 100%)",
            }}
          />

          <div className="p-6 sm:p-8">
            {/* Header Icon & Title */}
            <div className="flex items-start gap-4 mb-5">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "rgba(46, 91, 255, 0.18)",
                  border: "1px solid rgba(46, 91, 255, 0.4)",
                  color: "#60A5FA",
                }}
              >
                <Key size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold tracking-tight text-white">Setup Your AI API Key</h2>
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                    style={{
                      background: "rgba(46, 91, 255, 0.2)",
                      color: "#93C5FD",
                      border: "1px solid rgba(46, 91, 255, 0.4)",
                    }}
                  >
                    1-Time Setup
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                  Manthan AI runs on your personal LLM API key. Add it once—it is securely encrypted and saved to your account for all future logins.
                </p>
              </div>
            </div>

            {/* Provider Selection Tabs */}
            <div className="mb-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 block">
                Select LLM Provider
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {PROVIDERS.map((prov) => {
                  const isSelected = selectedProvider === prov.id;
                  return (
                    <button
                      key={prov.id}
                      type="button"
                      onClick={() => {
                        setSelectedProvider(prov.id);
                        setErrorMsg(null);
                      }}
                      className="flex flex-col items-start p-3.5 rounded-xl text-left transition-all relative overflow-hidden cursor-pointer"
                      style={{
                        background: isSelected
                          ? "rgba(46, 91, 255, 0.16)"
                          : "rgba(255, 255, 255, 0.03)",
                        border: isSelected ? "1.5px solid #3B82F6" : "1px solid rgba(255, 255, 255, 0.08)",
                        boxShadow: isSelected ? "0 0 16px rgba(46, 91, 255, 0.2)" : "none",
                      }}
                    >
                      {prov.recommended && (
                        <div
                          className="absolute top-0 right-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-bl-lg"
                          style={{
                            background: "linear-gradient(135deg, #2E5BFF, #00D2FF)",
                            color: "#FFFFFF",
                          }}
                        >
                          Recommended
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 font-semibold text-sm text-white w-full">
                        <span>{prov.name}</span>
                        {isSelected && <CheckCircle2 size={15} className="text-blue-400 ml-auto shrink-0" />}
                      </div>
                      <span className="text-[11px] text-slate-300 mt-1 line-clamp-1">
                        {prov.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Helper link for obtaining free key */}
            <div
              className="mb-4 p-3 rounded-xl border flex items-center justify-between gap-3 text-xs"
              style={{
                background: "rgba(255, 255, 255, 0.04)",
                borderColor: "rgba(255, 255, 255, 0.09)",
              }}
            >
              <div className="flex items-center gap-2 text-slate-200">
                <Sparkles size={14} className="text-amber-400 shrink-0" />
                <span>Need a key? Get one free in 30 seconds.</span>
              </div>
              <a
                href={currentProvider.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 font-semibold shrink-0 transition-colors"
              >
                <span>{currentProvider.name} Portal</span>
                <ExternalLink size={12} />
              </a>
            </div>

            {/* Error Banner */}
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 rounded-xl border flex items-start gap-2.5 text-xs text-rose-200"
                style={{
                  background: "rgba(225, 29, 72, 0.15)",
                  borderColor: "rgba(225, 29, 72, 0.4)",
                }}
              >
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-400" />
                <span className="leading-snug">{errorMsg}</span>
              </motion.div>
            )}

            {/* Input Form */}
            <form onSubmit={handleSaveKey} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-200 mb-1.5 flex items-center justify-between">
                  <span>Enter {currentProvider.name} API Key</span>
                  <span className="text-[11px] text-slate-400 font-normal">Encrypted at rest</span>
                </label>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder={currentProvider.placeholder}
                    className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none transition-colors pr-10 text-white placeholder:text-slate-500"
                    style={{
                      background: "rgba(0, 0, 0, 0.5)",
                      borderColor: "rgba(255, 255, 255, 0.16)",
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || !apiKey.trim()}
                  className="w-full py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.99]"
                  style={{
                    background: "linear-gradient(135deg, #2E5BFF 0%, #1D4ED8 100%)",
                    color: "#FFFFFF",
                    boxShadow: "0 4px 18px 0 rgba(46, 91, 255, 0.4)",
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Validating & Encrypting Key...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={17} />
                      <span>Validate & Save API Key</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Security Note Footer */}
            <div className="mt-4 pt-3 border-t text-center" style={{ borderColor: "rgba(255, 255, 255, 0.08)" }}>
              <p className="text-[11px] text-slate-400">
                🔒 Your API key is encrypted using AES/HMAC with your server secret. You can update or change providers anytime in Settings.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
