import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET } from "../../../apps/web/app/api/openapi/route";

type Document = { servers: Array<{ url: string }> };

const serversOf = async (request: Request) =>
  ((await (await GET(request)).json()) as Document).servers;

beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

it("publishes the origin the caller reached, not the internal bind address", async () => {
  const response = await GET(
    new Request("https://0.0.0.0:3000/api/openapi", {
      headers: {
        host: "0.0.0.0:3000",
        "x-forwarded-host": "ursly.io",
        "x-forwarded-proto": "https",
      },
    }),
  );
  expect(((await response.json()) as Document).servers).toEqual([
    { url: "https://ursly.io" },
  ]);
  // The document depends on the host, so a shared cache must key on it.
  expect(response.headers.get("vary")?.toLowerCase()).toContain(
    "x-forwarded-host",
  );
});

/**
 * The published defect, at the level a client sees it: a spec whose server is
 * the address the process listens on sends every generated client to a dead
 * host. With nothing to go on the document names itself relatively instead,
 * which resolves to wherever it was fetched from and cannot be wrong.
 */
it("never publishes the address it is bound to", async () => {
  expect(
    await serversOf(
      new Request("https://0.0.0.0:3000/api/openapi", {
        headers: { host: "0.0.0.0:3000", "x-forwarded-proto": "https" },
      }),
    ),
  ).toEqual([{ url: "/" }]);
});

/**
 * The document is publicly cacheable, so a host taken from a header is a host
 * one caller can put in front of the next. The configured origin settles it.
 */
it("does not let a caller choose the origin it publishes", async () => {
  vi.stubEnv("APP_ORIGIN", "https://ursly.io");
  expect(
    await serversOf(
      new Request("https://0.0.0.0:3000/api/openapi", {
        headers: {
          host: "0.0.0.0:3000",
          "x-forwarded-host": "evil.example.test",
          "x-forwarded-proto": "https",
        },
      }),
    ),
  ).toEqual([{ url: "https://ursly.io" }]);
});

it("serves its own origin when nothing is in front of it", async () => {
  expect(
    await serversOf(
      new Request("http://localhost:3600/api/openapi", {
        headers: { host: "localhost:3600" },
      }),
    ),
  ).toEqual([{ url: "http://localhost:3600" }]);
});
