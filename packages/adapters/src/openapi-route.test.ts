import { afterEach, expect, it, vi } from "vitest";
import { GET } from "../../../apps/web/app/api/openapi/route";

type Document = { servers: Array<{ url: string }> };

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

it("serves its own origin when nothing is in front of it", async () => {
  vi.stubEnv("APP_ORIGIN", "");
  const response = await GET(
    new Request("http://localhost:3600/api/openapi", {
      headers: { host: "localhost:3600" },
    }),
  );
  expect(((await response.json()) as Document).servers).toEqual([
    { url: "http://localhost:3600" },
  ]);
});
