"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, RotateCcw, Copy, ThumbsUp, ThumbsDown,
  Bot, User, Loader2, Paperclip, Cpu, Globe, Code, Zap, FileText,
  Search, BookOpen,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useChatStore, useToastStore, useAuthStore } from "@/lib/store";
import ReactFlow, { Background, Controls, MiniMap, Node, Edge, addEdge, Connection } from "reactflow";
import "reactflow/dist/style.css";

export default function ChatPage() {
  const defaultPromptData = [
    { iconName: "Cpu", text: "Who holds the record for most centuries in Test cricket?", category: "CRICKET" },
    { iconName: "Cpu", text: "Who is the GOAT of cricket?", category: "CRICKET" },
    { iconName: "Zap", text: "Tell me about MS Dhoni's captaincy achievements.", category: "CRICKET" },
    { iconName: "Globe", text: "Which country has won the most ICC World Cups?", category: "CRICKET" },
  ];
  
  const [prompts, setPrompts] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [searchMode, setSearchMode] = useState<"ai" | "kb">("ai");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { messages, addMessage, updateLastMessage, isLoading, setLoading, setMessages } = useChatStore();
  const { addToast } = useToastStore();
  const { token } = useAuthStore();

  // Render icon component based on name (client-side only to avoid hydration mismatch)
  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case "Globe": return <Globe size={16} />;
      case "Cpu": return <Cpu size={16} />;
      case "Zap": return <Zap size={16} />;
      case "Code": return <Code size={16} />;
      case "FileText": return <FileText size={16} />;
      default: return <Zap size={16} />;
    }
  };

  // Initialize prompts with icons on client side
  useEffect(() => {
    setPrompts(defaultPromptData.map(p => ({ ...p, icon: renderIcon(p.iconName) })));
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const fetchSuggestedQuestions = useCallback(async () => {
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(`${API_BASE}/api/v1/chat/suggested-questions`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map((item: any) => {
            let iconName = "Zap";
            if (item.category === "FOOTBALL") {
              iconName = "Globe";
            } else if (item.category === "CRICKET") {
              iconName = "Cpu";
            } else if (["PDF", "DOCX", "TXT", "CSV", "EXCEL", "MARKDOWN"].includes(item.category)) {
              iconName = "FileText";
            }
            return {
              ...item,
              icon: renderIcon(iconName),
              iconName,
            };
          });
          setPrompts(mapped);
        }
      }
    } catch (err) {
      console.error("Failed to load suggested questions:", err);
    }
  }, [token]);

  useEffect(() => {
    fetchSuggestedQuestions();
  }, [fetchSuggestedQuestions]);

  const generateMessageId = () => crypto.randomUUID();

  // Knowledge Graph Component
  const KnowledgeGraph = ({ graphData }: { graphData: any }) => {
    if (!graphData || !Array.isArray(graphData) || graphData.length === 0) {
      return null;
    }

    // Convert graph results to ReactFlow nodes and edges
    const nodes = [];
    const edges = [];
    const nodeMap = new Map();
    let nodeId = 0;

    graphData.forEach((record: any) => {
      // Handle different possible graph result formats
      if (record.n && record.m) {
        // Neo4j path result with nodes n and m
        [record.n, record.m].forEach((node: any) => {
          if (node && node.name && !nodeMap.has(node.name)) {
            nodeMap.set(node.name, `node-${nodeId++}`);
            nodes.push({
              id: nodeMap.get(node.name),
              data: { label: node.name, type: node.type || node.labels?.[0] || "Entity" },
              position: { x: Math.random() * 400, y: Math.random() * 300 },
              style: { background: "var(--cobalt)", color: "white", borderRadius: "8px", padding: "8px 12px", fontSize: "12px" },
            });
          }
        });
        if (record.n && record.m && record.n.name && record.m.name) {
          edges.push({
            id: `edge-${edges.length}`,
            source: nodeMap.get(record.n.name),
            target: nodeMap.get(record.m.name),
            label: record.r?.type || record.relationship || "RELATED",
            style: { stroke: "var(--cobalt)", strokeWidth: 2 },
            labelStyle: { fontSize: "10px", fill: "var(--text-secondary)" },
            animated: true,
          });
        }
      } else if (record.nodes && record.edges) {
        // GraphResult format with nodes and edges arrays
        record.nodes.forEach((node: any, i: number) => {
          if (!nodeMap.has(node.id)) {
            nodeMap.set(node.id, `node-${nodeId++}`);
            nodes.push({
              id: nodeMap.get(node.id),
              data: { label: node.name || node.id, type: node.label || node.type },
              position: { x: Math.random() * 400, y: Math.random() * 300 },
              style: { background: "var(--cobalt)", color: "white", borderRadius: "8px", padding: "8px 12px", fontSize: "12px" },
            });
          }
        });
        record.edges.forEach((edge: any) => {
          if (nodeMap.has(edge.source) && nodeMap.has(edge.target)) {
            edges.push({
              id: `edge-${edges.length}`,
              source: nodeMap.get(edge.source),
              target: nodeMap.get(edge.target),
              label: edge.type || edge.relationship || "RELATED",
              style: { stroke: "var(--cobalt)", strokeWidth: 2 },
              labelStyle: { fontSize: "10px", fill: "var(--text-secondary)" },
              animated: true,
            });
          }
        });
      } else if (record.id && record.name) {
        // Simple entity format
        if (!nodeMap.has(record.id)) {
          nodeMap.set(record.id, `node-${nodeId++}`);
          nodes.push({
            id: nodeMap.get(record.id),
            data: { label: record.name, type: record.type || record.labels?.[0] || "Entity" },
            position: { x: Math.random() * 400, y: Math.random() * 300 },
            style: { background: "var(--cobalt)", color: "white", borderRadius: "8px", padding: "8px 12px", fontSize: "12px" },
          });
        }
      }
    });

    if (nodes.length === 0) return null;

    return (
      <div style={{ width: "100%", height: 300, marginTop: "16px", borderRadius: "12px", border: "1px solid var(--border-default)", background: "var(--bg-glass)", overflow: "hidden" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          attributionPosition="bottom-right"
        >
          <Background color="var(--text-tertiary)" gap={20} />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    );
  };

  const handleSend = async (customMsg?: string) => {
    const textToSend = typeof customMsg === "string" ? customMsg : input;
    if (!textToSend.trim() || isLoading) return;
    const userMessage = textToSend.trim();
    if (customMsg === undefined) setInput("");

    addMessage({
      id: generateMessageId(),
      role: "user",
      content: userMessage,
      timestamp: new Date().toISOString(),
    });

    setLoading(true);
    setIsStreaming(true);

    addMessage({
      id: generateMessageId(),
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      isStreaming: true,
    });

    // ── AI Chat & Knowledge Base Streaming Mode ──
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const controller = new AbortController();
      // Increased timeout to 150 seconds to accommodate slow cold-starts on Render free tier
      const timeoutId = setTimeout(() => controller.abort(), 150000);

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // Use the full RAG pipeline for Knowledge Base, otherwise use direct AI stream
      const endpoint = searchMode === "kb" ? "/api/v1/chat/stream" : "/api/v1/chat/ai-stream";

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers,
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
      const traces: string[] = [];
      let citationsMd = "";

      let streamBuffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          streamBuffer += decoder.decode(value, { stream: true });
          const lines = streamBuffer.split("\n");
          streamBuffer = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === "content") {
                  accumulated += data.content;
                  const traceBlock = traces.length > 0
                    ? `> ⚙️ **Agent Pipeline Trace:**\n${traces.map(t => `> * ${t}`).join("\n")}\n\n`
                    : "";
                  updateLastMessage(traceBlock + accumulated + citationsMd);
                } else if (data.type === "trace") {
                  traces.push(data.content);
                  const traceBlock = `> ⚙️ **Agent Pipeline Trace:**\n${traces.map(t => `> * ${t}`).join("\n")}\n\n`;
                  updateLastMessage(traceBlock + accumulated + citationsMd);
                } else if (data.type === "citations") {
                  if (Array.isArray(data.content) && data.content.length > 0) {
                    citationsMd = "\n\n---\n**📚 Sources:**\n";
                    data.content.forEach((cite: any, i: number) => {
                      citationsMd += `${i + 1}. **${cite.title || cite.metadata?.filename || "Untitled"}**\n`;
                    });
                    const traceBlock = traces.length > 0
                      ? `> ⚙️ **Agent Pipeline Trace:**\n${traces.map(t => `> * ${t}`).join("\n")}\n\n`
                      : "";
                    updateLastMessage(traceBlock + accumulated + citationsMd);
                  }
                } else if (data.type === "graph") {
                  // Attach graph data to the last assistant message
                  const lastMsg = messages[messages.length - 1];
                  if (lastMsg && lastMsg.role === "assistant") {
                    const currentMessages = [...messages];
                    currentMessages[currentMessages.length - 1] = {
                      ...currentMessages[currentMessages.length - 1],
                      graphData: data.content,
                    };
                    setMessages(currentMessages);
                  }
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
        errorMsg = "⏱️ **Connection timed out.** The backend server didn't respond within 150 seconds. (If you are using a free Render instance, it might still be waking up! Try again in a minute).\n\n> Start the backend locally with: `uvicorn app.main:app --port 8000`";
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
      id: generateMessageId(),
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
        id: generateMessageId(),
        role: "assistant",
        content: `I have parsed and indexed **${file.name}**.\n\n**Ingestion Results:**\n| Metric | Value |\n|---|---|\n| **Status** | ✅ ${data.status || "indexed"} |\n| **Pages** | ${data.page_count ?? "N/A"} |\n| **Chunks** | ${data.chunk_count ?? 0} |\n| **Entities** | ${data.entity_count ?? 0} |\n| **File Size** | ${data.file_size ? (data.file_size / 1024).toFixed(1) + " KB" : "N/A"} |\n\nYou can now query this document's contents.`,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const error = err as Error;
      addToast(`Upload failed: ${error.message}`, "error");
      addMessage({
        id: generateMessageId(),
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
                <img src="/logo.png" alt="Manthan AI Logo" style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.8)" }} />
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
                {prompts.map((prompt, i) => (
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
                        <ReactMarkdown>{(msg.content || "").replace(/\\n/g, '\n') || (msg.isStreaming ? "●" : "")}</ReactMarkdown>
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
                    {/* Knowledge Graph visualization */}
                    {msg.role === "assistant" && msg.graphData && (
                      <KnowledgeGraph graphData={msg.graphData} />
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

          {/* ── Search Mode Toggle ── */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: "10px",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                background: "var(--bg-glass)",
                backdropFilter: "blur(16px) saturate(180%)",
                border: "1px solid var(--border-default)",
                borderRadius: "14px",
                padding: "4px",
                gap: "4px",
                position: "relative",
              }}
            >
              {([
                { key: "ai" as const, label: "AI Chat", icon: <Bot size={14} />, color: "var(--cobalt)" },
                { key: "kb" as const, label: "Knowledge Base", icon: <BookOpen size={14} />, color: "#10b981" },
              ]).map((mode) => (
                <motion.button
                  key={mode.key}
                  onClick={() => setSearchMode(mode.key)}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 16px",
                    borderRadius: "10px",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    fontFamily: "var(--font-body)",
                    letterSpacing: "-0.01em",
                    transition: "color 0.25s",
                    color: searchMode === mode.key ? "white" : "var(--text-tertiary)",
                    background: "transparent",
                    zIndex: 1,
                  }}
                >
                  {mode.icon}
                  {mode.label}
                  {searchMode === mode.key && (
                    <motion.div
                      layoutId="searchModeIndicator"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: "10px",
                        background: mode.color,
                        boxShadow: `0 4px 16px ${mode.key === "ai" ? "rgba(46,91,255,0.35)" : "rgba(16,185,129,0.35)"}`,
                        zIndex: -1,
                      }}
                    />
                  )}
                </motion.button>
              ))}
            </div>
          </div>

          <div
            style={{
              background: "var(--bg-glass)",
              backdropFilter: "blur(24px) saturate(180%)",
              border: `1px solid ${searchMode === "kb" ? "rgba(16,185,129,0.3)" : "var(--border-default)"}`,
              borderRadius: "24px",
              padding: "12px 16px",
              display: "flex",
              alignItems: "flex-end",
              gap: "12px",
              boxShadow: searchMode === "kb"
                ? "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(16,185,129,0.1)"
                : "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
              transition: "border-color 0.3s, box-shadow 0.3s",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = searchMode === "kb" ? "rgba(16,185,129,0.5)" : "var(--border-hover)"; e.currentTarget.style.boxShadow = searchMode === "kb" ? "0 8px 32px rgba(0,0,0,0.4), 0 0 0 2px rgba(16,185,129,0.2)" : "0 8px 32px rgba(0,0,0,0.4), 0 0 0 2px var(--cobalt-glow)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = searchMode === "kb" ? "rgba(16,185,129,0.3)" : "var(--border-default)"; e.currentTarget.style.boxShadow = searchMode === "kb" ? "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(16,185,129,0.1)" : "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)"; }}
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
              placeholder={searchMode === "kb" ? "Search your knowledge base..." : "Ask anything about your knowledge base..."}
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
                background: (!input.trim() || isLoading)
                  ? "var(--slate-800)"
                  : searchMode === "kb"
                    ? "linear-gradient(135deg, #10b981, #059669)"
                    : "linear-gradient(135deg, var(--cobalt), var(--cobalt-light))",
                color: (!input.trim() || isLoading) ? "var(--text-tertiary)" : "white",
                padding: "10px",
                borderRadius: "50%",
                border: "none",
                cursor: (!input.trim() || isLoading) ? "not-allowed" : "pointer",
                boxShadow: (!input.trim() || isLoading)
                  ? "none"
                  : searchMode === "kb"
                    ? "0 4px 12px rgba(16,185,129,0.35)"
                    : "0 4px 12px var(--cobalt-glow-strong)",
                transition: "all 0.2s",
              }}
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : searchMode === "kb" ? <Search size={18} /> : <Send size={18} />}
            </motion.button>
          </div>
          <p className="text-center mt-3" style={{ color: "var(--text-tertiary)", fontSize: "0.6875rem", fontFamily: "var(--font-mono)" }}>
            Manthan AI can make mistakes · Verify important information
          </p>
        </div>
      </div>
    </div>
  );
}