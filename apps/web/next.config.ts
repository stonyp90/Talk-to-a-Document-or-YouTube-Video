import type { NextConfig } from "next";
import path from "node:path";

/**
 * Origins the browser legitimately talks to: this app, OpenAI for the direct
 * WebRTC negotiation, whichever object store holds presigned uploads, and the
 * live discussion channel. The socket is served by its own endpoint in every
 * environment, so its address has to be named here or the browser will refuse
 * to open it — and, like the object store, it is fixed when the image is built.
 */
function connectSources(): string {
  const objectStore = process.env.OBJECT_STORE_PUBLIC_ENDPOINT;
  const chatSocket = process.env.NEXT_PUBLIC_CHAT_SOCKET_URL;
  return [
    "'self'",
    "https://api.openai.com",
    "https://*.s3.amazonaws.com",
    "https://*.amazonaws.com",
    ...(objectStore ? [objectStore] : []),
    ...(chatSocket ? [socketOrigin(chatSocket)] : []),
  ].join(" ");
}

/** A policy names an origin, never a path. */
function socketOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

/**
 * Next.js inlines its own bootstrap scripts and styles, so those keywords stay.
 * The directives that matter against injection and clickjacking are still
 * enforced: nothing may be framed, no plugins, no base-tag rewriting, and the
 * browser may only reach the origins above.
 */
const contentSecurityPolicy = () =>
  [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline'" +
      (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
    `connect-src ${connectSources()}`,
    "upgrade-insecure-requests",
  ].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  turbopack: { root: path.join(import.meta.dirname, "../..") },
  // Playwright and local browser checks use both loopback hostnames. Allow
  // Next's development resources so the client can hydrate and accept input.
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // The app needs the microphone to hear a question and the camera to
            // read a hand. Neither picture nor sound leaves the page in motion
            // mode: frames are compared and discarded. It needs nothing else.
            value:
              "microphone=(self), camera=(self), geolocation=(), payment=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
  async rewrites() {
    const apiBaseUrl = process.env.API_BASE_URL;
    return apiBaseUrl
      ? [{ source: "/api/:path*", destination: `${apiBaseUrl}/api/:path*` }]
      : [];
  },
};

export default nextConfig;
