import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { publicOrigin } from "./http";

/** A request as the Lambda adapter hands it over: bound to a private address. */
const behindProxy = (headers: Record<string, string>) =>
  new Request("https://0.0.0.0:3000/api/openapi", { headers });

beforeEach(() => {
  // Explicit in every case: the precedence between configuration and headers
  // is the whole subject here, so no case may inherit an ambient origin.
  vi.stubEnv("APP_ORIGIN", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("publicOrigin", () => {
  /**
   * The live defect: the function answered with the address the process is
   * bound to, which no caller can reach. It arrives as the Host header, since
   * the adapter forwards over loopback to a server that only knows its own
   * bind address. There is no usable answer here, and saying so leaves the
   * document to name itself relatively — always right, unlike a dead host.
   */
  it("never publishes the address it is bound to", () => {
    expect(
      publicOrigin(
        behindProxy({ host: "0.0.0.0:3000", "x-forwarded-proto": "https" }),
      ),
    ).toBeUndefined();
  });

  it("publishes the configured origin when the proxy forwards nothing", () => {
    vi.stubEnv("APP_ORIGIN", "https://demo.example.test");
    expect(publicOrigin(behindProxy({}))).toBe("https://demo.example.test");
  });

  /**
   * The configured origin is the deployment's own statement of where it is
   * reached; a header is whatever the caller decided to send. The document is
   * publicly cacheable, so an unverified host in it is a host other callers
   * can be handed. Configuration wins, and the header is never consulted.
   */
  it("prefers what the deployment configured over what a caller claims", () => {
    vi.stubEnv("APP_ORIGIN", "https://ursly.io");
    expect(
      publicOrigin(
        behindProxy({
          host: "ursly.io",
          "x-forwarded-host": "evil.example.test",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe("https://ursly.io");
  });

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

  /**
   * Every one of these is somewhere the server can be listening, and nowhere a
   * public client can call. Publishing one is the defect wearing another
   * address, so each has to fall through to the configured origin rather than
   * be taken at its word.
   */
  it.each([
    ["the unspecified IPv4 address", "0.0.0.0:3000"],
    ["the unspecified IPv6 address", "[::]:3000"],
    ["an IPv4 loopback literal", "127.0.0.1:3000"],
    ["an IPv6 loopback literal", "[::1]:3000"],
    ["the loopback name", "localhost:3000"],
    ["a private 10/8 address", "10.0.1.23:3000"],
    ["a private 172.16/12 address", "172.16.0.9:3000"],
    ["a private 192.168/16 address", "192.168.1.5:3000"],
    ["a link-local address", "169.254.169.254"],
    ["an IPv6 unique-local address", "[fd00::1]:3000"],
    ["an IPv6 link-local address", "[fe80::1]:3000"],
    ["a container name the public cannot resolve", "web:3000"],
  ])("refuses %s as a published host", (_description, host) => {
    vi.stubEnv("APP_ORIGIN", "https://ursly.io");
    expect(publicOrigin(behindProxy({ host }))).toBe("https://ursly.io");
    expect(publicOrigin(behindProxy({ "x-forwarded-host": host }))).toBe(
      "https://ursly.io",
    );
  });

  /**
   * The request's own URL is the process's view of itself, not something a
   * caller can set, so loopback is allowed here where it is refused above: in
   * development it is exactly right, and nobody else is listening.
   */
  it("trusts the request itself in local development", () => {
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
      publicOrigin(
        new Request("http://localhost:3600/api/openapi", {
          headers: { "x-forwarded-host": "not a host" },
        }),
      ),
    ).toBe("http://localhost:3600");
    vi.stubEnv("APP_ORIGIN", "ftp://files.example.test");
    expect(publicOrigin(behindProxy({}))).toBeUndefined();
  });
});
