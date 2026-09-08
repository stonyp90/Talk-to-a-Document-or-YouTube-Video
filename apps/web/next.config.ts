import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  turbopack: { root: path.join(import.meta.dirname, "../..") },
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
  async rewrites() {
    const apiBaseUrl = process.env.API_BASE_URL;
    return apiBaseUrl
      ? [{ source: "/api/:path*", destination: `${apiBaseUrl}/api/:path*` }]
      : [];
  },
};

export default nextConfig;
