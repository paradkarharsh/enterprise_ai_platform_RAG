import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Manthan AI — Enterprise Knowledge Intelligence Platform",
  description: "High-performance enterprise knowledge intelligence platform combining Retrieval-Augmented Generation, Knowledge Graphs, and Multi-Agent Workflows.",
  keywords: ["AI", "Knowledge Graph", "RAG", "Enterprise Search", "LLM"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable} suppressHydrationWarning>
      <body>
        {children}
      </body>
    </html>
  );
}
