import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
  async rewrites() {
    const apiBaseUrl = process.env.API_BASE_URL;
    return apiBaseUrl
      ? [{ source: "/api/:path*", destination: `${apiBaseUrl}/api/:path*` }]
      : [];
  },
};

export default nextConfig;
