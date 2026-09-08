import { expect, test, type Page } from "@playwright/test";
import { pdfFixture } from "../pdf-fixture";

// Explicit fault injection: delayed fetch completions intentionally ignore abort,
// modelling a response already queued when a source/session is invalidated.
type RaceHarness = {
  releaseSession: () => void;
  releaseText: () => void;
  sessionRequested: number;
  textRequested: number;
  microphoneRequests: number;
  stoppedTracks: number;
  closedPeers: number;
  signal?: AbortSignal | null;
  delaySession: boolean;
  hangUpload: boolean;
  uploadRequested: number;
  connectPeer: () => void;
  disconnectPeer: () => void;
  breakSend: () => void;
  emitError: () => void;
};
declare global {
  interface Window {
    race: RaceHarness;
  }
}
test.use({
  baseURL:
    process.env.RACE_BASE_URL ??
    process.env.E2E_BASE_URL ??
    "http://localhost:3000",
});
const status = (page: Page) => page.locator(".conversation-card .status");
const start = (page: Page) =>
  page.getByRole("button", { name: "Start Voice Chat", exact: true });
const stop = (page: Page) =>
  page.getByRole("button", { name: "Stop", exact: true });

async function ingest(page: Page, id = "dQw4w9WgXcQ") {
  await page.getByRole("tab", { name: "YouTube video" }).click();
  await page.getByLabel("YouTube URL").fill(`https://youtu.be/${id}`);
  await page.getByRole("button", { name: "Extract source text" }).click();
  await expect(page.locator(".preview-text")).toHaveText(`Source ${id}`);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window);
    const harness: RaceHarness = (window.race = {
      releaseSession: () => {},
      releaseText: () => {},
      sessionRequested: 0,
      textRequested: 0,
      microphoneRequests: 0,
      stoppedTracks: 0,
      closedPeers: 0,
      delaySession: true,
      hangUpload: false,
      uploadRequested: 0,
      connectPeer: () => {},
      disconnectPeer: () => {},
      breakSend: () => {},
      emitError: () => {},
    });
    window.fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith("/api/health"))
        return Response.json({ ok: true, directUpload: harness.hangUpload });
      if (url.endsWith("/api/uploads") && harness.hangUpload) {
        harness.uploadRequested++;
        return new Promise<Response>(() => {});
      }
      if (url.endsWith("/api/ingest")) {
        const id = String((init?.body as FormData).get("url"))
          .split("/")
          .at(-1);
        return Response.json({
          source: {
            kind: "youtube",
            sourceName: id,
            text: `Source ${id}`,
            characters: 18,
          },
        });
      }
      if (url.endsWith("/api/realtime/session")) {
        harness.sessionRequested++;
        harness.signal = init?.signal;
        const response = () =>
          Response.json({
            mode: "live",
            clientSecret: "fault-injection-secret",
          });
        if (!harness.delaySession) return response();
        return new Promise<Response>((resolve) => {
          harness.releaseSession = () => resolve(response());
        });
      }
      if (url.endsWith("/api/text-chat")) {
        harness.textRequested++;
        return new Promise<Response>((resolve) => {
          harness.releaseText = () =>
            resolve(
              Response.json({ answer: "STALE ANSWER FROM PREVIOUS SOURCE" }),
            );
        });
      }
      if (url === "https://api.openai.com/v1/realtime/calls")
        return new Response("fake-sdp");
      return nativeFetch(input, init);
    };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          harness.microphoneRequests++;
          const track = {
            enabled: true,
            stop: () => {
              harness.stoppedTracks++;
            },
          };
          return { getTracks: () => [track], getAudioTracks: () => [track] };
        },
      },
    });
    class Peer {
      connectionState = "new";
      onconnectionstatechange?: () => void;
      channel = {
        onmessage: undefined as ((event: { data: string }) => void) | undefined,
        readyState: "connecting",
        onopen: undefined as (() => void) | undefined,
        send: () => {},
        close: () => {},
      };
      constructor() {
        harness.connectPeer = () => {
          this.connectionState = "connected";
          this.channel.readyState = "open";
          this.onconnectionstatechange?.();
          this.channel.onopen?.();
        };
        harness.disconnectPeer = () => {
          this.connectionState = "disconnected";
          this.onconnectionstatechange?.();
        };
        harness.breakSend = () => {
          this.channel.send = () => {
            throw new Error("Injected data channel send failure");
          };
        };
        harness.emitError = () =>
          this.channel.onmessage?.({
            data: JSON.stringify({
              type: "error",
              error: { message: "Injected provider error" },
            }),
          });
      }
      addTrack() {}
      createDataChannel() {
        return this.channel;
      }
      async createOffer() {
        return { type: "offer", sdp: "fake-offer" };
      }
      async setLocalDescription() {}
      async setRemoteDescription() {}
      close() {
        harness.closedPeers++;
      }
    }
    Object.defineProperty(window, "RTCPeerConnection", {
      configurable: true,
      value: Peer,
    });
  });
  await page.goto("/");
  await ingest(page);
});

test("blackholed session setup times out with a retry action", async ({
  page,
}) => {
  await page.clock.install();
  await start(page).click();
  await expect
    .poll(() => page.evaluate(() => window.race.sessionRequested))
    .toBe(1);
  await page.clock.runFor(25001);
  await expect(status(page)).toHaveText("Needs attention");
  await expect(page.locator(".error")).toContainText(/timed out.*retry/i);
  await expect(start(page)).toBeEnabled();
  await page.evaluate(() => window.race.releaseSession());
  expect(await page.evaluate(() => window.race.microphoneRequests)).toBe(0);
});

test("blackholed text chat times out and ignores its eventual answer", async ({
  page,
}) => {
  await page.clock.install();
  await page.getByLabel("Ask a question").fill("Will this time out?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.race.textRequested))
    .toBe(1);
  await expect(
    page.getByText("Finding an answer in your source…"),
  ).toBeVisible();
  await page.clock.runFor(25001);
  await expect(page.locator(".error")).toContainText(/timed out.*retry/i);
  await expect(page.getByLabel("Ask a question")).toHaveValue(
    "Will this time out?",
  );
  await expect(page.getByText("Finding an answer in your source…")).toHaveCount(
    0,
  );
  await page.evaluate(() => window.race.releaseText());
  await expect(page.locator(".message.assistant")).toHaveCount(0);
});

test("blackholed PDF upload times out after sixty seconds and unlocks retry", async ({
  page,
}) => {
  await page.clock.install();
  await page.evaluate(() => {
    window.race.hangUpload = true;
  });
  await page.getByRole("tab", { name: "PDF document" }).click();
  await page.getByLabel("PDF file").setInputFiles({
    name: "timeout.pdf",
    mimeType: "application/pdf",
    buffer: pdfFixture(),
  });
  await page.getByRole("button", { name: "Extract source text" }).click();
  await expect
    .poll(() => page.evaluate(() => window.race.uploadRequested))
    .toBe(1);
  await page.clock.runFor(60001);
  await expect(page.locator(".error")).toContainText(/timed out.*retry/i);
  await expect(
    page.getByRole("button", { name: "Extract source text" }),
  ).toBeEnabled();
});

test("Realtime callback errors are visible and cleared when retrying", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.race.delaySession = false;
  });
  await start(page).click();
  await expect
    .poll(() => page.evaluate(() => window.race.microphoneRequests))
    .toBe(1);
  await page.evaluate(() => window.race.connectPeer());
  await expect(status(page)).toHaveText("Connected");
  await page.evaluate(() => window.race.emitError());
  await expect(status(page)).toHaveText("Needs attention");
  await expect(page.locator(".error")).toContainText(
    /Realtime processing failed/i,
  );
  await start(page).click();
  await expect(status(page)).toHaveText("Connecting");
  await expect(page.locator(".error")).toHaveCount(0);
});

test("source replacement ignores a late session response", async ({ page }) => {
  await start(page).click();
  await expect(status(page)).toHaveText("Preparing");
  await ingest(page, "abcdefghijk");
  await page.evaluate(() => window.race.releaseSession());
  await expect(status(page)).toHaveText("Ready");
  expect(await page.evaluate(() => window.race.microphoneRequests)).toBe(0);
  expect(await page.evaluate(() => window.race.signal?.aborted)).toBe(true);
});

test("Stop cancels preparing and a late session cannot restart voice", async ({
  page,
}) => {
  await start(page).click();
  await expect(status(page)).toHaveText("Preparing");
  await expect(stop(page)).toBeEnabled();
  await stop(page).click();
  await page.evaluate(() => window.race.releaseSession());
  await expect(status(page)).toHaveText("Ended");
  expect(await page.evaluate(() => window.race.microphoneRequests)).toBe(0);
  await expect(start(page)).toBeEnabled();
});

test("Stop is available while connecting and releases the peer", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.race.delaySession = false;
  });
  await start(page).click();
  await expect(status(page)).toHaveText("Connecting");
  await expect
    .poll(() => page.evaluate(() => window.race.microphoneRequests))
    .toBe(1);
  await stop(page).click();
  await expect(status(page)).toHaveText("Ended");
  expect(await page.evaluate(() => window.race.closedPeers)).toBe(1);
  expect(await page.evaluate(() => window.race.stoppedTracks)).toBe(1);
});

test("reconnecting disables Start and allows Stop", async ({ page }) => {
  await page.evaluate(() => {
    window.race.delaySession = false;
  });
  await start(page).click();
  await expect
    .poll(() => page.evaluate(() => window.race.microphoneRequests))
    .toBe(1);
  await page.evaluate(() => window.race.connectPeer());
  await expect(status(page)).toHaveText("Connected");
  await page.evaluate(() => window.race.disconnectPeer());
  await expect(status(page)).toHaveText("Reconnecting");
  await expect(start(page)).toBeDisabled();
  await stop(page).click();
  await expect(status(page)).toHaveText("Ended");
});

test("late text from an old source cannot enter the new conversation", async ({
  page,
}) => {
  await page.getByLabel("Ask a question").fill("Old question");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.race.textRequested))
    .toBe(1);
  await ingest(page, "abcdefghijk");
  await page.evaluate(() => window.race.releaseText());
  await expect(page.locator(".message")).toHaveCount(0);
});

test("realtime send failure is surfaced without an unhandled rejection", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.evaluate(() => {
    window.race.delaySession = false;
  });
  await start(page).click();
  await expect
    .poll(() => page.evaluate(() => window.race.microphoneRequests))
    .toBe(1);
  await page.evaluate(() => window.race.connectPeer());
  await expect(status(page)).toHaveText("Connected");
  await page.evaluate(() => window.race.breakSend());
  await page.getByLabel("Ask a question").fill("Can you hear me?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "1. Choose a source" }).getByRole("alert"),
  ).toContainText("Injected data channel send failure");
  expect(errors).toEqual([]);
});

// Unmount cleanup is exercised with a real React root in
// apps/web/src/lib/page-lifecycle.test.tsx; no private Next RSC rewriting is used.
