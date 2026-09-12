import type { Page } from "@playwright/test";

/**
 * The two things the browser gives this product that a test cannot: a speech
 * engine and a server that writes an answer a word at a time. Both are driven
 * from the test here, so the journeys stay about the product rather than about
 * a microphone, and so no spoken or typed question ever reaches a paid provider.
 */

type SpeechEngine = {
  lang: string;
  hear: (transcript: string, final: boolean) => void;
  fail: (error: string) => void;
};

type SpeechWindow = Window & {
  __urslySpeech?: { instances: SpeechEngine[]; spoken: string[] };
};

type AnswerStream = {
  say: (text: string) => void;
  finish: (answer: string) => void;
  cancelled: () => boolean;
};

type AnswerWindow = Window & { __urslyAnswer?: AnswerStream };

/**
 * Installs the fake speech engine. Two details of the real API decide whether
 * the interface behaves, so the fake reproduces both: the engine hands back
 * every result of the session on each event, with an offset to the new ones,
 * and it labels the ones it has settled on. A fake that emitted a bare
 * transcript would let a hypothesis run commands nobody said.
 *
 * Spoken confirmations are silenced unless `replies` is asked for, because the
 * echo guard they open would otherwise swallow the next phrase in every test.
 */
export async function installSpeech(
  page: Page,
  { replies = false }: { replies?: boolean } = {},
) {
  await page.addInitScript((speaks: boolean) => {
    const spoken: string[] = [];

    class FakeSpeechRecognition {
      static instances: FakeSpeechRecognition[] = [];
      continuous = false;
      interimResults = false;
      lang = "";
      maxAlternatives = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onresult: ((event: unknown) => void) | null = null;
      /** Only the results the engine has settled on survive to the next event. */
      settled: Array<{ 0: { transcript: string }; isFinal: boolean }> = [];

      constructor() {
        FakeSpeechRecognition.instances.push(this);
      }

      start() {
        this.onstart?.();
      }

      stop() {
        this.onend?.();
      }

      hear(transcript: string, final: boolean) {
        const resultIndex = this.settled.length;
        const results = [
          ...this.settled,
          { 0: { transcript }, isFinal: final },
        ];
        // A revised hypothesis replaces itself rather than adding a result.
        if (final) this.settled = results;
        this.onresult?.({
          resultIndex,
          results: Object.assign([...results], { length: results.length }),
        });
      }

      fail(error: string) {
        const event = new Event("error");
        Object.assign(event, { error });
        this.onerror?.(event);
      }
    }

    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      value: FakeSpeechRecognition,
    });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      // A reply that never ends holds the echo guard open for its full window,
      // which is exactly the condition the guard exists for.
      value: speaks
        ? {
            speak: (utterance: { text: string }) => spoken.push(utterance.text),
            cancel: () => {},
          }
        : undefined,
    });
    Object.defineProperty(window, "__urslySpeech", {
      configurable: true,
      value: { instances: FakeSpeechRecognition.instances, spoken },
    });
  }, replies);
}

/** Hands the interface a phrase, settled unless it is called a hypothesis. */
export async function hear(page: Page, transcript: string, final = true) {
  await page.evaluate(
    (phrase) =>
      (window as SpeechWindow).__urslySpeech?.instances
        .at(-1)
        ?.hear(phrase.transcript, phrase.final),
    { transcript, final },
  );
}

/** Raises one of the engine's own error codes, such as `not-allowed`. */
export async function failSpeech(page: Page, error: string) {
  await page.evaluate(
    (reason) =>
      (window as SpeechWindow).__urslySpeech?.instances.at(-1)?.fail(reason),
    error,
  );
}

/** What Ursly has said out loud, when replies were installed. */
export async function spokenReplies(page: Page): Promise<string[]> {
  return page.evaluate(
    () => (window as SpeechWindow).__urslySpeech?.spoken ?? [],
  );
}

/** A whole server-sent answer, written the way `/api/text-chat/stream` writes one. */
export function answerStream(
  deltas: string[],
  sourceId = "e2e-source",
): string {
  const frames: Array<Record<string, unknown>> = deltas.map((text) => ({
    type: "delta",
    text,
  }));
  frames.push({ type: "done", answer: deltas.join(""), sourceId });
  return frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join("");
}

/**
 * Opens the answer stream under the test's control, one delta at a time.
 * Playwright can only fulfil a route with a body that is already complete, and
 * an answer that arrives all at once cannot be watched arriving or stopped
 * halfway, which is the whole point of streaming one.
 */
export async function installAnswerStream(page: Page) {
  await page.addInitScript(() => {
    const encoder = new TextEncoder();
    let open: ReadableStreamDefaultController<Uint8Array> | undefined;
    let cancelled = false;
    const frame = (payload: Record<string, unknown>) =>
      open?.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

    Object.defineProperty(window, "__urslyAnswer", {
      configurable: true,
      value: {
        say: (text: string) => frame({ type: "delta", text }),
        finish: (answer: string) => {
          frame({ type: "done", answer, sourceId: "e2e-source" });
          open?.close();
        },
        cancelled: () => cancelled,
      } satisfies AnswerStream,
    });

    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      if (!String(input).includes("/api/text-chat/stream"))
        return nativeFetch(input, init);
      const body = new ReadableStream<Uint8Array>({
        start: (controller) => {
          open = controller;
        },
        cancel: () => {
          cancelled = true;
        },
      });
      // A real fetch tears its body down when the caller aborts. Without that,
      // a stopped answer would keep arriving after the reader stopped it.
      init?.signal?.addEventListener("abort", () => {
        try {
          open?.error(new DOMException("Answer cancelled", "AbortError"));
        } catch {
          /* The stream has already closed; there is nothing left to stop. */
        }
      });
      return new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    };
  });
}

/** Writes the next few words of the answer being streamed. */
export async function say(page: Page, text: string) {
  await page.evaluate(
    (delta) => (window as AnswerWindow).__urslyAnswer?.say(delta),
    text,
  );
}

/** Closes the streamed answer with the whole text the server settled on. */
export async function finishAnswer(page: Page, answer: string) {
  await page.evaluate(
    (text) => (window as AnswerWindow).__urslyAnswer?.finish(text),
    answer,
  );
}
