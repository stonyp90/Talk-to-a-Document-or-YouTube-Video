import { describe, expect, it } from "vitest";
import { buildOpenApiDocument } from "./openapi";

describe("OpenAPI document", () => {
  const document = buildOpenApiDocument("https://example.test");

  it("declares every public route", () => {
    expect(Object.keys(document.paths).sort()).toEqual([
      "/api/auth/confirm",
      "/api/auth/request-code",
      "/api/auth/session",
      "/api/conversation/turns",
      "/api/health",
      "/api/ingest",
      "/api/realtime/session",
      "/api/text-chat",
      "/api/text-chat/stream",
      "/api/uploads",
      "/api/uploads/extract",
      "/api/videos/search",
    ]);
  });

  it("derives request bodies from the schemas the routes validate with", () => {
    const chat = document.paths["/api/text-chat"].post as {
      requestBody: {
        content: { "application/json": { schema: Record<string, unknown> } };
      };
    };
    expect(
      JSON.stringify(chat.requestBody.content["application/json"].schema),
    ).toContain("question");
  });

  it("documents the rate-limited and expiry responses clients must handle", () => {
    const chat = document.paths["/api/text-chat"].post as {
      responses: Record<string, unknown>;
    };
    expect(Object.keys(chat.responses).sort()).toEqual([
      "200",
      "400",
      "401",
      "409",
      "429",
    ]);
  });

  it("publishes the streamed answer as an event stream of the frames it writes", () => {
    const stream = document.paths["/api/text-chat/stream"].post as {
      responses: Record<string, { content: Record<string, unknown> }>;
    };
    expect(Object.keys(stream.responses["200"].content)).toEqual([
      "text/event-stream",
    ]);
    expect(JSON.stringify(stream.responses["200"].content)).toContain("delta");
  });

  it("documents the shared-memory endpoint voice turns are posted to", () => {
    const turns = document.paths["/api/conversation/turns"].post as {
      requestBody: {
        content: { "application/json": { schema: Record<string, unknown> } };
      };
      responses: Record<string, unknown>;
    };
    expect(
      JSON.stringify(turns.requestBody.content["application/json"].schema),
    ).toContain("turns");
    expect(Object.keys(turns.responses).sort()).toEqual([
      "200",
      "400",
      "401",
      "409",
      "429",
    ]);
  });

  it("declares the sign-in gate on every endpoint that spends provider credit", () => {
    const paid = [
      "/api/ingest",
      "/api/uploads",
      "/api/uploads/extract",
      "/api/realtime/session",
      "/api/text-chat",
      "/api/text-chat/stream",
      "/api/conversation/turns",
      "/api/videos/search",
    ];
    for (const path of paid) {
      const operation = document.paths[path].post as {
        responses: Record<string, unknown>;
      };
      expect(Object.keys(operation.responses), path).toContain("401");
      expect(Object.keys(operation.responses), path).toContain("429");
    }
  });

  it("documents the spoken search as a query in, captioned videos out", () => {
    const search = document.paths["/api/videos/search"].post as {
      requestBody: {
        content: { "application/json": { schema: Record<string, unknown> } };
      };
      responses: Record<string, { content?: Record<string, unknown> }>;
      description: string;
    };
    expect(
      JSON.stringify(search.requestBody.content["application/json"].schema),
    ).toContain("query");
    expect(JSON.stringify(search.responses["200"].content)).toContain(
      "videoId",
    );
    // The caption filter is the reason this endpoint exists rather than a
    // plain search: an uncaptioned video cannot be read, so it is not a source.
    expect(search.description).toMatch(/caption/i);
    expect(Object.keys(search.responses).sort()).toEqual([
      "200",
      "400",
      "401",
      "429",
    ]);
  });

  it("leaves health and the document itself open", () => {
    const health = document.paths["/api/health"].get as {
      responses: Record<string, unknown>;
    };
    expect(Object.keys(health.responses)).toEqual(["200"]);
  });

  it("documents the code request as an answer with no body at all", () => {
    const request = document.paths["/api/auth/request-code"].post as {
      responses: Record<string, { content?: unknown }>;
    };
    expect(Object.keys(request.responses).sort()).toEqual([
      "204",
      "400",
      "429",
    ]);
    expect(request.responses["204"].content).toBeUndefined();
  });

  it("never advertises the stored form of a sign-in code", () => {
    // The code itself is a request field on /api/auth/confirm, which is where
    // the reader sends it. What must never surface is how it is kept.
    expect(JSON.stringify(document).toLowerCase()).not.toContain("codehash");
  });

  it("returns the session token on the one endpoint that earned it, and nowhere else", () => {
    // A client with no cookie jar has to be handed the session somehow, and the
    // response that sets the cookie is the only place that reveals nothing new.
    const carriers = Object.entries(document.paths).filter(([, operations]) =>
      JSON.stringify(operations).includes('"token"'),
    );
    expect(carriers.map(([path]) => path)).toEqual(["/api/auth/confirm"]);
  });

  it("never advertises a field that would carry a provider key", () => {
    expect(JSON.stringify(document).toLowerCase()).not.toContain("apikey");
  });
});
