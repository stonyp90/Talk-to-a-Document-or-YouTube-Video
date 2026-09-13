import { afterEach, describe, expect, it, vi } from "vitest";
import config from "../apps/web/next.config";

afterEach(() => vi.unstubAllEnvs());

describe("local preview and deployed security headers", () => {
  for (const origin of [
    "http://localhost:3200",
    "http://127.0.0.1:3200",
    "http://[::1]:3200",
    "https://ursly.com",
    "http://ursly.com",
    "http://localhost.example.com",
    "https://localhost:3200",
    "invalid",
    "",
  ]) {
    it(`loads assets without weakening non-loopback policies: ${origin || "unset"}`, async () => {
      vi.stubEnv("SITE_URL", origin);
      const rules = await config.headers!();
      const headers = rules[0].headers;
      const csp = headers.find((header) => header.key === "Content-Security-Policy")!.value;
      const localHttp = /^http:\/\/(localhost:|127\.0\.0\.1:|\[::1\]:)/.test(origin);
      expect(csp.includes("upgrade-insecure-requests")).toBe(!localHttp);
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
      expect(headers).toContainEqual({ key: "X-Content-Type-Options", value: "nosniff" });
    });
  }
});
