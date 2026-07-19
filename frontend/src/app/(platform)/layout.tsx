"use client";
import { Sidebar } from "@/components/layout/Sidebar";
import { useSidebarStore, useSettingsStore, useAuthStore } from "@/lib/store";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const isOpen = useSidebarStore((s) => s.isOpen);
  const theme = useSettingsStore((s) => s.settings.theme);
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    const htmlEl = document.documentElement;
    // Remove any existing theme- classes
    htmlEl.classList.forEach((cls) => {
      if (cls.startsWith("theme-")) {
        htmlEl.classList.remove(cls);
      }
    });
    // Add current theme class
    htmlEl.classList.add(`theme-${theme}`);
  }, [theme]);

  const sidebarWidth = isOpen ? 260 : 72;

  return (
    <div
      className="h-screen w-screen overflow-hidden"
      style={{
        background: "var(--bg-base)",
        padding: "16px",
      }}
    >
      {/* Viewport-inset container */}
      <div
        className="h-full w-full relative"
        style={{
          borderRadius: "24px",
          border: "1px solid var(--border-default)",
          overflow: "hidden",
          background: "var(--bg-glass)",
          backdropFilter: "blur(50px) saturate(200%)",
          WebkitBackdropFilter: "blur(50px) saturate(200%)",
          boxShadow: "0 40px 100px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
        }}
      >
        <Sidebar />
        
        <motion.div
          animate={{ marginLeft: sidebarWidth }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          style={{
            height: "100%",
            background: "var(--bg-base)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            position: "relative",
            zIndex: 10,
            borderLeft: "1px solid var(--border-subtle)",
            boxShadow: "-10px 0 30px rgba(0,0,0,0.3)"
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div 
              key={pathname}
              initial={{ opacity: 0, y: 15, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -15, filter: "blur(10px)" }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="flex-1 w-full overflow-y-auto" 
              style={{ maxWidth: "100%", position: "relative" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
      <ToastContainer />
    </div>
  );
}
