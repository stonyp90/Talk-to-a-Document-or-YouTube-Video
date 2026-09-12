import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSpeechListener,
  speechRecognitionSupported,
  type SpeechPhrase,
} from "./speech";

/** A stand-in for the browser engine, driven by the test rather than a voice. */
class FakeRecognition {
  static instances: FakeRecognition[] = [];
  continuous = false;
  interimResults = false;
  lang = "";
  maxAlternatives = 1;
  started = 0;
  stopped = 0;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onresult: ((event: unknown) => void) | null = null;

  constructor() {
    FakeRecognition.instances.push(this);
  }
  start() {
    this.started++;
    this.onstart?.();
  }
  stop() {
    this.stopped++;
    this.onend?.();
  }
  /** Delivers results the way the engine does: a growing list with an offset. */
  emit(results: Array<{ text: string; final: boolean }>, resultIndex = 0) {
    this.onresult?.({
      resultIndex,
      results: Object.assign(
        results.map((result) => ({
          0: { transcript: result.text },
          isFinal: result.final,
          length: 1,
        })),
        { length: results.length },
      ),
    });
  }
  fail(error: string) {
    this.onerror?.(Object.assign(new Event("error"), { error }));
  }
}

beforeEach(() => {
  FakeRecognition.instances = [];
  vi.stubGlobal("window", {
    SpeechRecognition: FakeRecognition,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const collect = () => {
  const phrases: SpeechPhrase[] = [];
  return {
    phrases,
    onPhrase: (phrase: SpeechPhrase) => phrases.push(phrase),
  };
};

describe("speechRecognitionSupported", () => {
  it("finds the prefixed engine as well as the standard one", () => {
    expect(speechRecognitionSupported()).toBe(true);
    vi.stubGlobal("window", { webkitSpeechRecognition: FakeRecognition });
    expect(speechRecognitionSupported()).toBe(true);
    vi.stubGlobal("window", {});
    expect(speechRecognitionSupported()).toBe(false);
  });
});

describe("createSpeechListener", () => {
  it("listens continuously with interim results in the chosen language", () => {
    const listener = createSpeechListener({ language: "fr-CA", ...collect() });
    listener.start();
    const [engine] = FakeRecognition.instances;
    expect(engine).toMatchObject({
      continuous: true,
      interimResults: true,
      lang: "fr-CA",
    });
  });

  it("separates a settled phrase from a hypothesis still being revised", () => {
    const sink = collect();
    const listener = createSpeechListener({ language: "en-US", ...sink });
    listener.start();
    const engine = FakeRecognition.instances[0]!;
    engine.emit([{ text: "bac", final: false }]);
    engine.emit([{ text: "back please", final: true }]);
    expect(sink.phrases).toEqual([
      { text: "bac", final: false },
      { text: "back please", final: true },
    ]);
  });

  it("reports only the newly arrived results, not the whole session again", () => {
    const sink = collect();
    const listener = createSpeechListener({ language: "en-US", ...sink });
    listener.start();
    const engine = FakeRecognition.instances[0]!;
    engine.emit([{ text: "first", final: true }], 0);
    engine.emit(
      [
        { text: "first", final: true },
        { text: "second", final: true },
      ],
      1,
    );
    expect(sink.phrases.map((phrase) => phrase.text)).toEqual([
      "first",
      "second",
    ]);
  });

  it("restarts itself when the engine hangs up mid-session", () => {
    const listener = createSpeechListener({ language: "en-US", ...collect() });
    listener.start();
    const engine = FakeRecognition.instances[0]!;
    engine.onend?.();
    vi.advanceTimersByTime(400);
    expect(FakeRecognition.instances).toHaveLength(2);
    expect(FakeRecognition.instances[1]!.started).toBe(1);
    expect(listener.listening()).toBe(true);
    listener.stop();
  });

  it("stays stopped once the caller has stopped it", () => {
    const listener = createSpeechListener({ language: "en-US", ...collect() });
    listener.start();
    listener.stop();
    const opened = FakeRecognition.instances.length;
    vi.advanceTimersByTime(2000);
    expect(FakeRecognition.instances).toHaveLength(opened);
    expect(listener.listening()).toBe(false);
  });

  it("gives up for good when the microphone permission is refused", () => {
    const errors: string[] = [];
    const listener = createSpeechListener({
      language: "en-US",
      ...collect(),
      onError: (reason) => errors.push(reason),
    });
    listener.start();
    FakeRecognition.instances[0]!.fail("not-allowed");
    vi.advanceTimersByTime(2000);
    expect(errors).toEqual(["denied"]);
    expect(listener.listening()).toBe(false);
  });

  it("treats a silent stretch as nothing to report and keeps listening", () => {
    const errors: string[] = [];
    const listener = createSpeechListener({
      language: "en-US",
      ...collect(),
      onError: (reason) => errors.push(reason),
    });
    listener.start();
    FakeRecognition.instances[0]!.fail("no-speech");
    vi.advanceTimersByTime(500);
    expect(errors).toEqual([]);
    expect(listener.listening()).toBe(true);
    listener.stop();
  });

  it("stops on its own after the quiet limit so a forgotten tab stops listening", () => {
    const listener = createSpeechListener({
      language: "en-US",
      ...collect(),
      quietLimitMs: 1000,
    });
    listener.start();
    vi.advanceTimersByTime(1200);
    expect(listener.listening()).toBe(false);
  });

  it("counts speech as activity, so a conversation is never cut short", () => {
    const listener = createSpeechListener({
      language: "en-US",
      ...collect(),
      quietLimitMs: 1000,
    });
    listener.start();
    vi.advanceTimersByTime(800);
    FakeRecognition.instances[0]!.emit([{ text: "still here", final: true }]);
    vi.advanceTimersByTime(800);
    expect(listener.listening()).toBe(true);
    listener.stop();
  });

  it("changes language without losing the microphone when it is idle", () => {
    const listener = createSpeechListener({ language: "en-US", ...collect() });
    listener.setLanguage("fr-CA");
    listener.start();
    expect(FakeRecognition.instances[0]!.lang).toBe("fr-CA");
    listener.stop();
  });
});
