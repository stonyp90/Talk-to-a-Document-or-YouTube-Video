import { describe, expect, it } from "vitest";
import { buildOpenApiDocument } from "./openapi";

describe("OpenAPI document", () => {
  const document = buildOpenApiDocument("https://example.test");

  it("declares every public route", () => {
    expect(Object.keys(document.paths).sort()).toEqual([
      "/api/health",
      "/api/ingest",
      "/api/realtime/session",
      "/api/text-chat",
      "/api/uploads",
      "/api/uploads/extract",
    ]);
  });

  it("derives request bodies from the schemas the routes validate with", () => {
    const chat = document.paths["/api/text-chat"].post as {
      requestBody: {
        content: { "application/json": { schema: Record<string, unknown> } };
      };
    };
    expect(JSON.stringify(chat.requestBody.content["application/json"].schema)).toContain(
      "question",
    );
  });

  it("documents the rate-limited and expiry responses clients must handle", () => {
    const chat = document.paths["/api/text-chat"].post as {
      responses: Record<string, unknown>;
    };
    expect(Object.keys(chat.responses).sort()).toEqual([
      "200",
      "400",
      "409",
      "429",
    ]);
  });

  it("never advertises a field that would carry a provider key", () => {
    expect(JSON.stringify(document).toLowerCase()).not.toContain("apikey");
  });
});
