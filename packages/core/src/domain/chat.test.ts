import { describe, expect, it } from "vitest";
import {
  MAX_CHAT_FRAME_CHARACTERS,
  decodeClientMessage,
  encodeServerMessage,
  parseClientFrame,
} from "./chat";
import { InputValidationError } from "./ingestion";

const source = {
  kind: "pdf" as const,
  sourceName: "brief.pdf",
  text: "The budget is 42.",
  characters: 17,
};

describe("decoding what a client says on the socket", () => {
  it("accepts an attach that carries only a session id", () => {
    expect(
      decodeClientMessage({
        type: "attach",
        sourceId: "0f1d8c2e-6a3b-4a7d-9f21-2c5e9b6d4a10",
      }),
    ).toEqual({
      type: "attach",
      sourceId: "0f1d8c2e-6a3b-4a7d-9f21-2c5e9b6d4a10",
    });
  });

  it("accepts an attach that carries the whole source for rehydration", () => {
    expect(decodeClientMessage({ type: "attach", source })).toEqual({
      type: "attach",
      source,
    });
  });

  it("accepts a question with the ask identifier the client will match on", () => {
    expect(
      decodeClientMessage({
        type: "ask",
        askId: "ask-1",
        question: "  What is the budget?  ",
        sourceId: "0f1d8c2e-6a3b-4a7d-9f21-2c5e9b6d4a10",
      }),
    ).toEqual({
      type: "ask",
      askId: "ask-1",
      question: "What is the budget?",
      sourceId: "0f1d8c2e-6a3b-4a7d-9f21-2c5e9b6d4a10",
    });
  });

  it("keeps the keepalive in the protocol so idle connections survive", () => {
    expect(decodeClientMessage({ type: "ping" })).toEqual({ type: "ping" });
  });

  it("refuses a message that is not an object", () => {
    expect(() => decodeClientMessage("attach")).toThrow(InputValidationError);
  });

  it("refuses a type the server does not serve", () => {
    expect(() => decodeClientMessage({ type: "shutdown" })).toThrow(
      /not supported/i,
    );
  });

  it("refuses an ask with no question", () => {
    expect(() =>
      decodeClientMessage({ type: "ask", askId: "ask-1", question: "   " }),
    ).toThrow(/question/i);
  });

  it("refuses an ask with no identifier to answer against", () => {
    expect(() =>
      decodeClientMessage({ type: "ask", question: "What is the budget?" }),
    ).toThrow(InputValidationError);
  });

  it("refuses a source whose shape the domain does not recognise", () => {
    expect(() =>
      decodeClientMessage({
        type: "attach",
        source: { kind: "epub", sourceName: "x", text: "y", characters: 1 },
      }),
    ).toThrow(InputValidationError);
  });
});

describe("reading a frame off the wire", () => {
  it("parses the JSON text a socket delivers", () => {
    expect(parseClientFrame(JSON.stringify({ type: "ping" }))).toEqual({
      type: "ping",
    });
  });

  it("refuses text that is not JSON", () => {
    expect(() => parseClientFrame("ping")).toThrow(InputValidationError);
  });

  it("refuses a frame larger than the transport should carry", () => {
    expect(() =>
      parseClientFrame("x".repeat(MAX_CHAT_FRAME_CHARACTERS + 1)),
    ).toThrow(/too large/i);
  });

  it("honours a frame limit supplied by configuration", () => {
    expect(() => parseClientFrame(JSON.stringify({ type: "ping" }), 4)).toThrow(
      /too large/i,
    );
  });
});

describe("what the server sends back", () => {
  it("serialises a server message as one JSON frame", () => {
    expect(
      encodeServerMessage({
        type: "answer.delta",
        askId: "ask-1",
        messageId: "m-1",
        text: "42",
      }),
    ).toBe(
      '{"type":"answer.delta","askId":"ask-1","messageId":"m-1","text":"42"}',
    );
  });
});
