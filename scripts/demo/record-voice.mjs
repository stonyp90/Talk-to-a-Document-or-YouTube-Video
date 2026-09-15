/**
 * Record real voice-to-action and source conversation against a live local stack.
 * Requires macOS say, ffmpeg, and Node with tsx: node --import tsx scripts/demo/record-voice.mjs
 * The caller is macOS Samantha, not the founder. Audio is injected as a microphone
 * fixture; all recognition, WebRTC connections and model answers are real.
 * No provider response, recognition result or UI state is fabricated.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import { pdfFixture } from "../../tests/pdf-fixture.ts";
const run = promisify(execFile);
const origin = process.env.DEMO_ORIGIN ?? "http://localhost:3300";
const out = resolve(
  process.env.DEMO_OUTPUT ?? "output/verification/voice-demo",
);
await mkdir(out, { recursive: true });
const health = await (await fetch(`${origin}/api/health`)).json();
if (health.mode !== "live" || health.commandSpeech !== "realtime")
  throw new Error("Use a live stack with command transcription enabled.");
const lines = {
  upload: "Upload.",
  talk: "Let's talk.",
  question:
    "What does the document say about attention? Please answer briefly.",
  followup: "How could I put that into practice during my workday?",
};
for (const [name, text] of Object.entries(lines)) {
  await run(
    "say",
    ["-v", "Samantha", "-r", "172", "-o", `${out}/${name}.aiff`, text],
    { timeout: 60000 },
  );
  await run("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-i",
    `${out}/${name}.aiff`,
    "-ar",
    "48000",
    "-ac",
    "1",
    `${out}/${name}.wav`,
  ]);
}
const browser = await chromium.launch({
  args: [
    "--autoplay-policy=no-user-gesture-required",
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1080 },
  deviceScaleFactor: 1,
  locale: "en-CA",
  recordVideo: { dir: out, size: { width: 1440, height: 1080 } },
});
await context.addInitScript(() => {
  localStorage.setItem("ursly-intro-v1", "seen");
  window.__demo = {
    events: [],
    marks: [],
    peers: [],
    tracks: [],
    audioStartedAt: 0,
  };
  const Native = RTCPeerConnection;
  window.RTCPeerConnection = class extends Native {
    constructor(...args) {
      super(...args);
      window.__demo.peers.push(this);
      this.addEventListener("track", (e) => {
        window.__demo.tracks.push(e.track);
        window.__demo.audio
          .createMediaStreamSource(e.streams[0])
          .connect(window.__demo.mix);
      });
    }
    createDataChannel(...args) {
      const channel = super.createDataChannel(...args);
      channel.addEventListener("message", (e) => {
        const data = JSON.parse(e.data);
        window.__demo.events.push({
          at: Date.now(),
          channel: channel.label,
          type: data.type,
          itemId: data.item_id,
          transcript: data.transcript,
          status: data.response?.status,
        });
      });
      return channel;
    }
  };
  navigator.mediaDevices.getUserMedia = async () => {
    const d = window.__demo;
    if (!d.audio) {
      d.audio = new AudioContext();
      d.mic = d.audio.createMediaStreamDestination();
      d.mix = d.audio.createMediaStreamDestination();
      // Keep silent audio frames flowing between utterances so provider VAD sees
      // the end of speech. An ended file source alone stops producing frames.
      d.silence = d.audio.createConstantSource();
      d.silence.offset.value = 0;
      d.silence.connect(d.mic);
      d.silence.start();
      d.chunks = [];
      d.recorder = new MediaRecorder(d.mix.stream);
      d.recorder.ondataavailable = (e) => d.chunks.push(e.data);
      d.audioStartedAt = Date.now();
      d.recorder.start();
    }
    await d.audio.resume();
    return d.mic.stream.clone();
  };
});
const t0 = Date.now();
const page = await context.newPage();
const video = page.video();
const marks = {};
const mark = (name) => {
  marks[name] = (Date.now() - t0) / 1000;
  console.log(name);
};
async function say(name) {
  mark(`spoken_${name}`);
  await page.evaluate(
    async (data) => {
      const d = window.__demo;
      const buffer = await d.audio.decodeAudioData(
        Uint8Array.from(atob(data), (c) => c.charCodeAt(0)).buffer,
      );
      const source = d.audio.createBufferSource();
      source.buffer = buffer;
      source.connect(d.mic);
      source.connect(d.mix);
      await new Promise((resolve) => {
        source.onended = resolve;
        source.start();
      });
    },
    (await readFile(`${out}/${name}.wav`)).toString("base64"),
  );
}
async function listen() {
  await page.getByRole("button", { name: "Speak", exact: true }).click();
  await expect(page.locator("#voice-actions-heading")).toHaveText("Listening", {
    timeout: 30000,
  });
  await page.waitForTimeout(400);
}
try {
  await page.goto(`${origin}/en/app`);
  await page.evaluate(() => document.fonts.ready);
  await page.getByLabel("PDF file").waitFor();
  await page.waitForTimeout(1200);
  mark("workspace");
  await listen();
  await say("upload");
  await expect(page.locator(".voice-commands-status")).toContainText(
    "Open the PDF upload picker",
    { timeout: 18000 },
  );
  mark("upload_action");
  await page.locator(".voice-picker-input").setInputFiles({
    name: "attention-notes.pdf",
    mimeType: "application/pdf",
    buffer: pdfFixture(
      "Short breaks restore attention. Take a five-minute pause after each focus session.",
    ),
  });
  await page
    .getByRole("button", { name: "Continue to questions", exact: true })
    .click();
  await page.locator(".preview summary").click();
  await expect(page.locator(".preview-text")).toContainText(
    "Short breaks restore attention. Take a five-minute pause after each focus session.",
  );
  mark("source_ready");
  await page.waitForTimeout(2200);
  if (
    await page.getByRole("button", { name: "Speak", exact: true }).isVisible()
  )
    await listen();
  await say("talk");
  await expect(page.locator(".conversation-card .status")).toHaveText(
    "Connected",
    { timeout: 35000 },
  );
  mark("voice_connected");
  await page.locator(".voice-panel").scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await say("question");
  await page.waitForFunction(
    () =>
      window.__demo.events.some(
        (e) => e.type === "response.done" && e.status === "completed",
      ),
    null,
    { timeout: 45000 },
  );
  await expect(page.locator(".message.user").first()).toContainText(
    /attention/i,
    { timeout: 15000 },
  );
  await expect(page.locator(".message.assistant").first()).toContainText(
    /break|pause/i,
  );
  await expect(page.locator(".message").first()).toHaveClass(/user/);
  await page.waitForFunction(
    () =>
      window.__demo.events.filter(
        (e) => e.type === "output_audio_buffer.stopped",
      ).length >= 1,
    null,
    { timeout: 45000 },
  );
  await page.locator(".message.assistant").last().scrollIntoViewIfNeeded();
  mark("first_answer");
  await page.waitForTimeout(1200);
  await say("followup");
  await page.waitForFunction(
    () =>
      window.__demo.events.filter(
        (e) => e.type === "response.done" && e.status === "completed",
      ).length >= 2,
    null,
    { timeout: 45000 },
  );
  await expect(page.locator(".message.user")).toHaveCount(2, {
    timeout: 15000,
  });
  await page.waitForFunction(
    () =>
      window.__demo.events.filter(
        (e) => e.type === "output_audio_buffer.stopped",
      ).length >= 2,
    null,
    { timeout: 45000 },
  );
  await page.locator(".message.assistant").last().scrollIntoViewIfNeeded();
  mark("followup_answer");
  await page.waitForTimeout(1800);
  await page
    .getByRole("button", { name: "Mute microphone", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Unmute microphone", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  mark("muted");
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.locator(".conversation-card .status")).toHaveText("Ended");
  mark("stopped");
  await page.waitForTimeout(1800);
  const capture = await page.evaluate(async () => {
    const d = window.__demo;
    await new Promise((resolve) => {
      d.recorder.onstop = resolve;
      d.recorder.stop();
    });
    const bytes = new Uint8Array(await new Blob(d.chunks).arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return {
      audio: btoa(binary),
      audioStartedAt: d.audioStartedAt,
      events: d.events,
      allPeersClosed: d.peers.every((p) => p.connectionState === "closed"),
    };
  });
  const messages = await page.locator(".message").allTextContents();
  await page.screenshot({ path: `${out}/conversation.png`, fullPage: true });
  await writeFile(`${out}/audio.webm`, Buffer.from(capture.audio, "base64"));
  await writeFile(
    `${out}/evidence.json`,
    JSON.stringify(
      {
        origin,
        recordedAt: new Date().toISOString(),
        videoStartedAt: t0,
        audioStartedAt: capture.audioStartedAt,
        audioOffsetSeconds: (capture.audioStartedAt - t0) / 1000,
        input:
          "macOS Samantha audio fixture; no physical microphone certification",
        providers:
          "Live OpenAI transcription and Realtime WebRTC; no mocked provider responses",
        marks,
        messages,
        events: capture.events,
        allPeersClosed: capture.allPeersClosed,
      },
      null,
      2,
    ),
  );
  await context.close();
  const path = await video.path();
  const offset = ((capture.audioStartedAt - t0) / 1000).toFixed(3);
  await run("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-i",
    path,
    "-itsoffset",
    offset,
    "-i",
    `${out}/audio.webm`,
    "-map",
    "0:v",
    "-map",
    "1:a",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "21",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-af",
    "apad",
    "-shortest",
    "-movflags",
    "+faststart",
    `${out}/ursly-voice-demo.mp4`,
  ]);
  console.log(`Recorded ${out}/ursly-voice-demo.mp4`);
} catch (error) {
  await page
    .screenshot({ path: `${out}/failure.png`, fullPage: true })
    .catch(() => {});
  await writeFile(
    `${out}/failure.json`,
    JSON.stringify(
      {
        error: error.message,
        marks,
        events: await page.evaluate(() => window.__demo.events).catch(() => []),
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
