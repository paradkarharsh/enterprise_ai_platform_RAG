"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useAuthStore, useToastStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Shield, Mail, Lock, User, ArrowRight, Loader2, ArrowLeft } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, setAuth } = useAuthStore();
  const { addToast } = useToastStore();

  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/chat");
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      addToast("Please fill in all required fields", "error");
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        // Sign In
        const response = (await api.auth.login({ email, password })) as any;
        const userDetails = (await api.auth.me(response.access_token)) as any;
        setAuth(userDetails, response.access_token);
        addToast(`Welcome back, ${userDetails.full_name || userDetails.username}!`, "success");
        router.push("/chat");
      } else {
        // Register
        if (!username) {
          addToast("Username is required", "error");
          setLoading(false);
          return;
        }
        const response = (await api.auth.register({
          email,
          username,
          password,
          full_name: fullName || undefined
        })) as any;
        const userDetails = (await api.auth.me(response.access_token)) as any;
        setAuth(userDetails, response.access_token);
        addToast("Account created successfully!", "success");
        router.push("/chat");
      }
    } catch (err: unknown) {
      addToast((err as Error).message || "Authentication failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      {/* Background Gradients */}
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(var(--cobalt-glow-strong) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      <motion.div
        animate={{ scale: [1, 1.05, 1], opacity: [0.2, 0.3, 0.2] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-12 left-1/4 w-[500px] h-[500px] rounded-full blur-[140px]"
        style={{ background: "var(--cobalt-glow)" }}
      />

      {/* Floating Home Link */}
      <Link href="/" className="absolute top-8 left-8 btn-ghost flex items-center gap-2" style={{ textDecoration: "none", fontSize: "0.875rem" }}>
        <ArrowLeft size={16} /> Back to Home
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Brand header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg, var(--cobalt), var(--cobalt-dim))", boxShadow: "0 8px 24px var(--cobalt-glow-strong)" }}
          >
            <Shield size={24} style={{ color: "var(--text-inverse)" }} />
          </div>
          <h2
            className="text-3xl font-semibold mb-2"
            style={{ fontFamily: "var(--font-headline)", letterSpacing: "-0.03em" }}
          >
            {isLogin ? "Welcome Back" : "Create Account"}
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            {isLogin ? "Access the Manthan AI Platform console" : "Get started with agentic knowledge intelligence"}
          </p>
        </div>

        {/* Auth Card */}
        <div
          className="glass-card"
          style={{
            padding: "32px",
            background: "var(--bg-glass)",
            border: "1px solid var(--border-default)",
            borderRadius: "24px",
            boxShadow: "0 24px 60px rgba(0, 0, 0, 0.4)",
          }}
        >
          {/* Tab Selector */}
          <div
            className="flex p-1 rounded-xl mb-8"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
          >
            <button
              type="button"
              className="flex-1 py-2 text-center rounded-lg text-sm font-medium transition-all duration-200"
              onClick={() => {
                setIsLogin(true);
                setEmail("");
                setPassword("");
              }}
              style={{ 
                cursor: "pointer", 
                border: "none", 
                background: isLogin ? "var(--bg-base)" : "transparent",
                color: isLogin ? "var(--text-primary)" : "var(--text-secondary)",
                boxShadow: isLogin ? "var(--shadow-sm)" : "none"
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className="flex-1 py-2 text-center rounded-lg text-sm font-medium transition-all duration-200"
              onClick={() => {
                setIsLogin(false);
                setEmail("");
                setPassword("");
              }}
              style={{ 
                cursor: "pointer", 
                border: "none", 
                background: !isLogin ? "var(--bg-base)" : "transparent",
                color: !isLogin ? "var(--text-primary)" : "var(--text-secondary)",
                boxShadow: !isLogin ? "var(--shadow-sm)" : "none"
              }}
            >
              Register
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col gap-4"
                >
                  <div className="flex flex-col gap-1.5">
                    <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Username
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-3 flex items-center" style={{ color: "var(--text-secondary)" }}>
                        <User size={16} />
                      </span>
                      <input
                        type="text"
                        placeholder="john_doe"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required={!isLogin}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border transition-all duration-200"
                        style={{
                          background: "var(--bg-elevated)",
                          borderColor: "var(--border-default)",
                          color: "var(--text-primary)",
                          outline: "none",
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Full Name
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-3 flex items-center" style={{ color: "var(--text-secondary)" }}>
                        <User size={16} />
                      </span>
                      <input
                        type="text"
                        placeholder="John Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border transition-all duration-200"
                        style={{
                          background: "var(--bg-elevated)",
                          borderColor: "var(--border-default)",
                          color: "var(--text-primary)",
                          outline: "none",
                        }}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-col gap-1.5">
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center" style={{ color: "var(--text-secondary)" }}>
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border transition-all duration-200"
                  style={{
                    background: "var(--bg-elevated)",
                    borderColor: "var(--border-default)",
                    color: "var(--text-primary)",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center" style={{ color: "var(--text-secondary)" }}>
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border transition-all duration-200"
                  style={{
                    background: "var(--bg-elevated)",
                    borderColor: "var(--border-default)",
                    color: "var(--text-primary)",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={loading}
              className="w-full btn-primary flex items-center justify-center gap-2 mt-4"
              style={{
                height: "44px",
                borderRadius: "12px",
                fontWeight: 600,
                fontSize: "0.95rem",
                boxShadow: "0 4px 16px var(--cobalt-glow-strong)"
              }}
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  {isLogin ? "Sign In" : "Register"} <ArrowRight size={16} />
                </>
              )}
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
