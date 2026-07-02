"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, RotateCcw, Copy, ThumbsUp, ThumbsDown,
  Bot, User, Loader2, Paperclip, Cpu, Globe, Code, Zap,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useChatStore, useToastStore } from "@/lib/store";

const suggestedPrompts = [
  { icon: <Cpu size={16} />, text: "Explain the architecture of GPT-4", category: "TECHNICAL" },
  { icon: <Globe size={16} />, text: "Compare Google and Microsoft cloud strategies", category: "ANALYSIS" },
  { icon: <Zap size={16} />, text: "What are the latest AI trends in 2025?", category: "RESEARCH" },
  { icon: <Code size={16} />, text: "How does RAG improve LLM accuracy?", category: "TECHNICAL" },
];

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { messages, addMessage, updateLastMessage, isLoading, setLoading, setMessages } = useChatStore();
  const { addToast } = useToastStore();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);



  const handleSend = async (customMsg?: string) => {
    const textToSend = typeof customMsg === "string" ? customMsg : input;
    if (!textToSend.trim() || isLoading) return;
    const userMessage = textToSend.trim();
    if (customMsg === undefined) setInput("");

    addMessage({
      id: Date.now().toString(),
      role: "user",
      content: userMessage,
      timestamp: new Date().toISOString(),
    });

    setLoading(true);
    setIsStreaming(true);

    addMessage({
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      isStreaming: true,
    });

    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const res = await fetch(`${API_BASE}/api/v1/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, stream: true }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === "content") {
                  accumulated += data.content;
                  updateLastMessage(accumulated);
                } else if (data.type === "error") {
                  throw new Error(data.error);
                }
              } catch { /* skip invalid JSON */ }
            }
          }
        }
      }
    } catch (err: unknown) {
      const error = err as Error;
      let errorMsg = "I'm unable to reach the AI backend right now.";
      const rawMsg = error.message || "";

      if (error.name === "AbortError" || rawMsg.includes("abort")) {
        errorMsg = "⏱️ **Connection timed out.** The backend server didn't respond within 60 seconds.\n\n> Start the backend with: `uvicorn app.main:app --port 8000`";
      } else if (rawMsg.includes("Failed to fetch") || rawMsg.includes("NetworkError")) {
        errorMsg = "🔌 **Cannot connect to backend.** The server may not be running.\n\n> Start the backend with: `uvicorn app.main:app --port 8000`";
      } else if (rawMsg.includes("quota") || rawMsg.includes("429")) {
        errorMsg = "⚡ **API quota exceeded.** The AI provider rate limit has been reached. The system will automatically fall back to the built-in AI engine. Please try again.";
      } else if (rawMsg.includes("HTTP")) {
        errorMsg = `⚠️ **Server error**: ${rawMsg}`;
      }

      updateLastMessage(errorMsg);
      addToast("Failed to communicate with AI backend", "error");
    } finally {
      setLoading(false);
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    addToast("Response copied to clipboard", "success");
  };

  const handleRetry = () => {
    const userMsgs = messages.filter(m => m.role === 'user');
    if (userMsgs.length === 0) return;
    const lastUserMsg = userMsgs[userMsgs.length - 1].content;
    const newMessages = messages.slice(0, -2);
    setMessages(newMessages);
    handleSend(lastUserMsg);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    addToast(`Uploading ${file.name}...`, "info");

    addMessage({
      id: Date.now().toString(),
      role: "user",
      content: `Uploading document: **${file.name}**`,
      timestamp: new Date().toISOString(),
    });

    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE}/api/v1/upload/`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(errData.detail || `Upload failed (HTTP ${res.status})`);
      }

      const data = await res.json();
      addToast(`${file.name} ingested successfully!`, "success");
      addMessage({
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `I have parsed and indexed **${file.name}**.\n\n**Ingestion Results:**\n| Metric | Value |\n|---|---|\n| **Status** | ✅ ${data.status || "indexed"} |\n| **Pages** | ${data.page_count ?? "N/A"} |\n| **Chunks** | ${data.chunk_count ?? 0} |\n| **Entities** | ${data.entity_count ?? 0} |\n| **File Size** | ${data.file_size ? (data.file_size / 1024).toFixed(1) + " KB" : "N/A"} |\n\nYou can now query this document's contents.`,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const error = err as Error;
      addToast(`Upload failed: ${error.message}`, "error");
      addMessage({
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `❌ Failed to upload **${file.name}**: ${error.message}\n\n> Make sure the backend is running at \`http://localhost:8000\``,
        timestamp: new Date().toISOString(),
      });
    }

    // Reset the file input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col" style={{ background: "var(--bg-base)", height: "calc(100vh - 24px)" }}>
      {/* ── Messages Area ── */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          /* ── Empty State ── */
            <div className="flex flex-col items-center px-6 min-h-full py-12">
            <motion.div
              initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.6, type: "spring", stiffness: 200, damping: 25 }}
              className="text-center w-full my-auto"
              style={{ maxWidth: "640px" }}
            >
              {/* Logo */}
              <div
                className="flex items-center justify-center"
                style={{
                  width: 72, height: 72, borderRadius: "20px",
                  margin: "0 auto 2rem auto",
                  overflow: "hidden",
                  boxShadow: "0 12px 32px rgba(0,0,0,0.15)",
                }}
              >
                <img src="/logo.png" alt="NeuralArch Logo" style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.8)" }} />
              </div>

              <h1
                style={{
                  fontFamily: "var(--font-headline)", fontSize: "2.75rem",
                  fontWeight: 600, letterSpacing: "-0.03em",
                  color: "var(--text-primary)",
                  marginBottom: "1rem",
                }}
              >
                How can I help you today?
              </h1>
              <p style={{ color: "var(--text-secondary)", fontSize: "1rem", lineHeight: 1.6, marginBottom: "3rem" }}>
                Query the enterprise knowledge graph, analyze tickets, or summarize docs.
              </p>

              {/* Prompt Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {suggestedPrompts.map((prompt, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.1, type: "spring", stiffness: 200, damping: 20 }}
                    whileHover={{ scale: 1.02, backgroundColor: "var(--bg-hover)" }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setInput(prompt.text); inputRef.current?.focus(); }}
                    className="text-left cursor-pointer glass-card"
                    style={{
                      padding: "20px 24px",
                      borderRadius: "16px",
                    }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-lg" style={{ background: "var(--cobalt-glow)", color: "var(--cobalt)" }}>
                        {prompt.icon}
                      </div>
                      <span className="text-label" style={{ color: "var(--text-tertiary)", fontSize: 11, fontWeight: 600 }}>{prompt.category}</span>
                    </div>
                    <p style={{ color: "var(--text-primary)", fontSize: "0.875rem", lineHeight: 1.5, fontWeight: 500 }}>{prompt.text}</p>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </div>
        ) : (
          /* ── Messages ── */
          <div className="px-6 py-8 space-y-6" style={{ maxWidth: "720px", margin: "0 auto" }}>
            <AnimatePresence>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                >
                  {msg.role === "assistant" && (
                    <div
                      className="flex-shrink-0 flex items-center justify-center"
                      style={{
                        width: 32, height: 32, borderRadius: "var(--radius-sm)",
                        background: "var(--cobalt)", marginTop: 2,
                      }}
                    >
                      <Bot size={14} color="white" />
                    </div>
                  )}
                  <div
                    style={{
                      maxWidth: "78%",
                      borderRadius: msg.role === "user" ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
                      padding: "16px 20px",
                      background: msg.role === "user" ? "linear-gradient(135deg, var(--cobalt), var(--cobalt-dim))" : "var(--bg-glass)",
                      backdropFilter: msg.role === "user" ? "none" : "blur(20px) saturate(180%)",
                      color: msg.role === "user" ? "white" : "var(--text-primary)",
                      border: msg.role === "assistant" ? "1px solid var(--border-default)" : "none",
                      boxShadow: msg.role === "user" ? "0 8px 24px rgba(10,132,255,0.2)" : "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose" style={{ fontSize: "0.875rem" }}>
                        <ReactMarkdown>{msg.content || (msg.isStreaming ? "●" : "")}</ReactMarkdown>
                        {msg.isStreaming && isStreaming && (
                          <span
                            className="inline-block animate-pulse"
                            style={{
                              width: 6, height: 16, marginLeft: 2,
                              borderRadius: 1, background: "var(--cobalt)",
                            }}
                          />
                        )}
                      </div>
                    ) : (
                      <p style={{ fontSize: "0.875rem", lineHeight: 1.5 }}>{msg.content}</p>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div
                      className="flex-shrink-0 flex items-center justify-center"
                      style={{
                        width: 32, height: 32, borderRadius: "var(--radius-sm)",
                        background: "var(--slate-800)", marginTop: 2,
                      }}
                    >
                      <User size={14} style={{ color: "var(--text-secondary)" }} />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Action buttons */}
            {messages.length > 0 && messages[messages.length - 1].role === "assistant" && !isStreaming && (
              <div className="flex items-center gap-1" style={{ marginLeft: 44 }}>
                {[
                  { icon: <Copy size={13} />, action: () => copyMessage(messages[messages.length - 1].content), label: "Copy" },
                  { icon: <RotateCcw size={13} />, action: handleRetry, label: "Retry" },
                  { icon: <ThumbsUp size={13} />, action: () => addToast("Thank you for your feedback!", "success"), label: "Good" },
                  { icon: <ThumbsDown size={13} />, action: () => addToast("Feedback recorded. We will improve our responses.", "warning"), label: "Bad" },
                ].map((btn, i) => (
                  <button
                    key={i}
                    onClick={btn.action}
                    className="btn-icon"
                    title={btn.label}
                    style={{ width: "1.75rem", height: "1.75rem" }}
                  >
                    {btn.icon}
                  </button>
                ))}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── Input Area ── */}
      <div className="px-6 pb-5 pt-3" style={{ borderTop: "1px solid var(--slate-800)" }}>
        <div style={{ maxWidth: "760px", margin: "0 auto", position: "relative" }}>
          <div
            style={{
              background: "var(--bg-glass)",
              backdropFilter: "blur(24px) saturate(180%)",
              border: "1px solid var(--border-default)",
              borderRadius: "24px",
              padding: "12px 16px",
              display: "flex",
              alignItems: "flex-end",
              gap: "12px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
              transition: "border-color 0.3s, box-shadow 0.3s",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--border-hover)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.4), 0 0 0 2px var(--cobalt-glow)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)"; }}
          >
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-icon flex-shrink-0"
              style={{ width: "2rem", height: "2rem" }}
            >
              <Paperclip size={16} />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your knowledge base..."
              rows={1}
              className="flex-1 resize-none bg-transparent outline-none"
              style={{
                color: "var(--text-primary)",
                fontFamily: "var(--font-body)",
                fontSize: "0.875rem",
                lineHeight: 1.5,
                maxHeight: "120px",
                minHeight: "24px",
                padding: "6px 0",
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "24px";
                target.style.height = Math.min(target.scrollHeight, 120) + "px";
              }}
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.93 }}
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="flex-shrink-0"
              style={{
                background: (!input.trim() || isLoading) ? "var(--slate-800)" : "linear-gradient(135deg, var(--cobalt), var(--cobalt-light))",
                color: (!input.trim() || isLoading) ? "var(--text-tertiary)" : "white",
                padding: "10px",
                borderRadius: "50%",
                border: "none",
                cursor: (!input.trim() || isLoading) ? "not-allowed" : "pointer",
                boxShadow: (!input.trim() || isLoading) ? "none" : "0 4px 12px var(--cobalt-glow-strong)",
                transition: "all 0.2s",
              }}
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </motion.button>
          </div>
          <p className="text-center mt-3" style={{ color: "var(--text-tertiary)", fontSize: "0.6875rem", fontFamily: "var(--font-mono)" }}>
            NeuralArch can make mistakes · Verify important information
          </p>
        </div>
      </div>
    </div>
  );
}
