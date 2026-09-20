import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRealtimeSession,
  answerTextQuestion,
  streamTextAnswer,
} from "../../../apps/web/src/composition";

const source = {
  kind: "pdf" as const,
  sourceName: "guide.pdf",
  text: "The demo answer is forty-two.",
  characters: 30,
};

/** Collects a stream the way a route does, one delta at a time. */
async function collect(deltas: AsyncIterable<string>): Promise<string[]> {
  const received: string[] = [];
  for await (const delta of deltas) received.push(delta);
  return received;
}

/** A fake SSE body that hands the parser the bytes in the given pieces. */
function sseBody(pieces: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const piece of pieces) controller.enqueue(encoder.encode(piece));
        controller.close();
      },
    }),
  );
}

beforeEach(() => vi.stubEnv("PROVIDER_MODE", "mock"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Realtime provider boundary", () => {
  it("returns a short-lived local session without exposing a server key", async () => {
    const session = await createRealtimeSession(source);
    expect(session.mode).toBe("mock");
    expect(session.clientSecret).toMatch(/^mock_/);
    expect(session.instructions).toContain(source.text);
  });

  it("supports text fallback in local mode", async () => {
    const answer = await answerTextQuestion(source, "What is the answer?");
    expect(answer).toContain("The demo answer is forty-two");
  });
});

describe("streamed text answers", () => {
  it("delivers the local demo answer as several deltas", async () => {
    const deltas = await collect(streamTextAnswer(source, "What is it?"));
    expect(deltas.length).toBeGreaterThan(1);
    expect(deltas.join("")).toBe(
      await answerTextQuestion(source, "What is it?"),
    );
  });

  it("reassembles provider frames split across chunk boundaries", async () => {
    vi.stubEnv("PROVIDER_MODE", "live");
    vi.stubEnv("OPENAI_API_KEY", "server-only-canary-secret");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        sseBody([
          'data: {"type":"response.output_text.delta","delta":"The ans',
          'wer "}\n\ndata: {"type":"response.output_text.delta","delta":"is 42."}\n\n',
          'data: {"type":"response.completed"}\n\n',
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const deltas = await collect(streamTextAnswer(source, "Answer?"));
    expect(deltas).toEqual(["The answer ", "is 42."]);
    const options = fetchMock.mock.calls[0][1];
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(options.body).stream).toBe(true);
    expect(JSON.parse(options.body).input).toEqual([
      { role: "user", content: "Answer?" },
    ]);
  });

  it("reports a refused stream by status without naming the key", async () => {
    vi.stubEnv("PROVIDER_MODE", "live");
    vi.stubEnv("OPENAI_API_KEY", "server-only-canary-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("denied", { status: 401 })),
    );
    const failure = await collect(streamTextAnswer(source, "Answer?")).catch(
      (error: Error) => error,
    );
    expect((failure as Error).message).toBe("OpenAI text stream failed (401).");
    expect(
      JSON.stringify(failure, Object.getOwnPropertyNames(failure)),
    ).not.toContain("server-only-canary-secret");
  });

  it("fails the stream when the provider reports a failed response", async () => {
    vi.stubEnv("PROVIDER_MODE", "live");
    vi.stubEnv("OPENAI_API_KEY", "test-server-key");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          sseBody([
            'data: {"type":"response.output_text.delta","delta":"Partial"}\n\n',
            'data: {"type":"response.failed","response":{"error":{"message":"upstream"}}}\n\n',
          ]),
        ),
    );
    await expect(collect(streamTextAnswer(source, "Answer?"))).rejects.toThrow(
      /could not complete/,
    );
  });

  it("carries recent exchanges so a streamed follow-up reads naturally", async () => {
    vi.stubEnv("PROVIDER_MODE", "live");
    vi.stubEnv("OPENAI_API_KEY", "test-server-key");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(sseBody(['data: {"type":"response.completed"}\n\n']));
    vi.stubGlobal("fetch", fetchMock);
    await collect(
      streamTextAnswer(source, "And for video?", [
        { role: "user", text: "What is the limit?" },
        { role: "assistant", text: "25 MB." },
      ]),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).input).toEqual([
      { role: "user", content: "What is the limit?" },
      { role: "assistant", content: "25 MB." },
      { role: "user", content: "And for video?" },
    ]);
  });

  it("stops pulling from the provider when the reader walks away", async () => {
    vi.stubEnv("PROVIDER_MODE", "live");
    vi.stubEnv("OPENAI_API_KEY", "test-server-key");
    const cancelled = vi.fn();
    const encoder = new TextEncoder();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(
                encoder.encode(
                  'data: {"type":"response.output_text.delta","delta":"First"}\n\n',
                ),
              );
            },
            cancel: cancelled,
          }),
        ),
      ),
    );
    for await (const delta of streamTextAnswer(source, "Answer?")) {
      expect(delta).toBe("First");
      break;
    }
    expect(cancelled).toHaveBeenCalled();
  });
});

describe("voice controls in the realtime session", () => {
  it("names the assistant and asks for intent-driven controls", async () => {
    const session = await createRealtimeSession(source, {
      assistantName: "Nova",
    });
    expect(session.instructions).toContain("Your name is Nova.");
    expect(session.instructions).toContain("set_voice_output");
    // Guidance is instruction, so it has to sit before the untrusted source.
    expect(session.instructions.indexOf("Your name is Nova.")).toBeLessThan(
      session.instructions.indexOf(source.text),
    );
  });

  it("sends the tools and the caller's speed to the provider", async () => {
    vi.stubEnv("PROVIDER_MODE", "live");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const request = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({ value: "ek_test", expires_at: 1 }),
    );
    vi.stubGlobal("fetch", request);
    await createRealtimeSession(source, { speed: 9 });
    const body = JSON.parse(String(request.mock.calls[0][1]?.body));
    expect(body.session.audio.output.speed).toBe(1.5);
    expect(
      body.session.tools.map((tool: { name: string }) => tool.name),
    ).toEqual([
      "set_voice_output",
      "set_voice_speed",
      "set_assistant_name",
      "express_mood",
    ]);
    expect(body.session.tools[0].type).toBe("function");
  });
});
