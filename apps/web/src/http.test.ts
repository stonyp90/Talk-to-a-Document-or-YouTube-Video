import { afterEach, describe, expect, it, vi } from "vitest";
import { publicOrigin } from "./http";

/** A request as the Lambda adapter hands it over: bound to a private address. */
const behindProxy = (headers: Record<string, string>) =>
  new Request("https://0.0.0.0:3000/api/openapi", { headers });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("publicOrigin", () => {
  it("names the host the proxy says the caller reached", () => {
    expect(
      publicOrigin(
        behindProxy({
          host: "0.0.0.0:3000",
          "x-forwarded-host": "ursly.io",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe("https://ursly.io");
  });

  it("falls back to the Host header when only the scheme is forwarded", () => {
    expect(
      publicOrigin(
        behindProxy({ host: "ursly.io", "x-forwarded-proto": "https" }),
      ),
    ).toBe("https://ursly.io");
  });

  it("keeps the first hop of a forwarded chain and drops any path", () => {
    expect(
      publicOrigin(
        behindProxy({
          "x-forwarded-host": "ursly.io, internal.lb.local",
          "x-forwarded-proto": "https, http",
        }),
      ),
    ).toBe("https://ursly.io");
    expect(
      publicOrigin(behindProxy({ "x-forwarded-host": "ursly.io/api" })),
    ).toBe("https://ursly.io");
  });

  it("uses the configured origin when the proxy forwards nothing", () => {
    vi.stubEnv("APP_ORIGIN", "https://demo.example.test");
    expect(publicOrigin(behindProxy({}))).toBe("https://demo.example.test");
  });

  it("trusts the request itself in local development", () => {
    vi.stubEnv("APP_ORIGIN", "");
    expect(
      publicOrigin(
        new Request("http://localhost:3600/api/openapi", {
          headers: { host: "localhost:3600" },
        }),
      ),
    ).toBe("http://localhost:3600");
  });

  it("ignores a forwarded host or configured origin it cannot use", () => {
    vi.stubEnv("APP_ORIGIN", "not an origin");
    expect(
      publicOrigin(behindProxy({ "x-forwarded-host": "not a host" })),
    ).toBe("https://0.0.0.0:3000");
    vi.stubEnv("APP_ORIGIN", "ftp://files.example.test");
    expect(publicOrigin(behindProxy({}))).toBe("https://0.0.0.0:3000");
  });
});
