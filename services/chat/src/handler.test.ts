import { afterEach, expect, it, vi } from "vitest";
import { callbackEndpoint, createHandler, type GatewayEvent } from "./handler";
import type { ServerMessage } from "../../../packages/core/src/domain/chat";

const event = (over: Partial<GatewayEvent> = {}): GatewayEvent => ({
  requestContext: {
    routeKey: "$default",
    connectionId: "connection-1",
    domainName: "abc123.execute-api.us-east-1.amazonaws.com",
    stage: "production",
    ...over.requestContext,
  },
  headers: over.headers,
  body: over.body,
});

afterEach(() => vi.unstubAllEnvs());

it("accepts a connection from an origin the deployment named", async () => {
  vi.stubEnv("CHAT_ALLOWED_ORIGINS", "https://ursly.io");
  const handle = createHandler({ sender: () => () => {} });
  expect(
    await handle(
      event({
        requestContext: { routeKey: "$connect", connectionId: "connection-1" },
        headers: { Origin: "https://ursly.io" },
      }),
    ),
  ).toEqual({ statusCode: 200 });
});

it("refuses a connection from anywhere else", async () => {
  vi.stubEnv("CHAT_ALLOWED_ORIGINS", "https://ursly.io");
  const handle = createHandler({ sender: () => () => {} });
  expect(
    await handle(
      event({
        requestContext: { routeKey: "$connect", connectionId: "connection-1" },
        headers: { origin: "https://evil.example" },
      }),
    ),
  ).toEqual({ statusCode: 403 });
});

it("acknowledges a disconnect without touching the conversation", async () => {
  const handle = createHandler({ sender: () => () => {} });
  expect(
    await handle(
      event({
        requestContext: {
          routeKey: "$disconnect",
          connectionId: "connection-1",
        },
      }),
    ),
  ).toEqual({ statusCode: 200 });
});

it("posts every frame of one answer back to the same connection", async () => {
  const posted: ServerMessage[] = [];
  const handle = createHandler({
    sender: () => (message) => {
      posted.push(message);
    },
    channel: {
      async handle(frame, send) {
        expect(frame).toBe('{"type":"ping"}');
        await send({ type: "pong" });
      },
    },
  });
  expect(await handle(event({ body: '{"type":"ping"}' }))).toEqual({
    statusCode: 200,
  });
  expect(posted).toEqual([{ type: "pong" }]);
});

it("posts replies to the gateway endpoint that serves the connection", () => {
  expect(callbackEndpoint(event())).toBe(
    "https://abc123.execute-api.us-east-1.amazonaws.com/production",
  );
});

it("prefers a callback endpoint the deployment configured, since a custom domain cannot serve one", () => {
  vi.stubEnv(
    "CHAT_CALLBACK_URL",
    "https://abc123.execute-api.us-east-1.amazonaws.com/live",
  );
  expect(callbackEndpoint(event())).toBe(
    "https://abc123.execute-api.us-east-1.amazonaws.com/live",
  );
});
