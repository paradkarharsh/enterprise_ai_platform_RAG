import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  async rewrites() {
    const apiUrl = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/+$/, "");
    // Only add rewrite if URL is valid
    if (apiUrl.startsWith("http://") || apiUrl.startsWith("https://")) {
      return [
        {
          source: "/api/v1/:path*",
          destination: `${apiUrl}/api/v1/:path*`,
        },
        {
          source: "/health",
          destination: `${apiUrl}/health`,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
