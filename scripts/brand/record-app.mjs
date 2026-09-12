// Records the application actually being used, so the introduction can show
// the product moving rather than a screenshot of it standing still.
//
//   YOUTUBE_TRANSCRIPT_MODE=mock npm run dev -- --port 3400
//   URSLY_CAPTURE_ORIGIN=http://localhost:3400 node scripts/brand/record-app.mjs
//
// URSLY_CAPTURE_SURFACES=desktop films one surface instead of every surface.
//
// Writes scripts/brand/footage/app-<surface>.<lang>.webm. The journey is
// driven slowly on purpose: this footage is watched, not asserted on, so every
// step holds long enough to be read at a glance. Each take is one continuous
// pass through the product, because the film cuts its scenes out of different
// stretches of the same journey rather than restarting the recording per
// scene, and a cut between two takes would show the app jumping.
//
// Needs ffmpeg, which the renderer needs anyway: every take is cut to begin at
// the moment the app is ready to be used, so that nothing in the file is the
// development server still waking up and an offset into it means the same thing
// from one re-record to the next.
//
// The run prints the offset of the two moments the film has to land on -- the
// source text appearing and the answer appearing. Those are the numbers that
// go into the `cues` table in scripts/brand/intro-video.mjs.
import { execFile } from "node:child_process";
import { mkdirSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { chromium, devices } from "playwright";

const ORIGIN = process.env.URSLY_CAPTURE_ORIGIN ?? "http://localhost:3100";
const OUT = "scripts/brand/footage";
const INTRO_KEY = "ursly-intro-v1";

// The gate that offers the introduction on a first visit covers the workspace,
// and the workspace is the thing being filmed. Seeding the key the gate writes
// on dismissal puts the browser in the state of a returning visitor.
const INTRO_SEEN = "seen";

// The development server floats its own toolbar and a "Compiling" pill over
// the corner of the page. They belong to the toolchain, not to the product, so
// they never belong in footage; hiding them also makes a take recorded against
// `next dev` indistinguishable from one recorded against a production build.
const HIDE_DEV_OVERLAYS = "nextjs-portal { display: none !important; }";

/** A one-page PDF built by hand, the same fixture the browser tests upload. */
function pdfFixture(text) {
  const content = `BT /F1 12 Tf 72 720 Td (${text.replace(/[()\\]/g, " ")}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => `${String(n).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

const SOURCE_TEXT =
  "Short breaks restore attention. A mind that pauses returns sharper than one that never stopped.";

const COPY = {
  en: {
    tab: "PDF document",
    file: "PDF file",
    go: "Continue to questions",
    voice: "Start Voice Chat",
    ask: "Ask a question",
    send: "Send",
    question: "What does this say about attention?",
  },
  fr: {
    tab: "Document PDF",
    file: "Fichier PDF",
    go: "Passer aux questions",
    voice: "Démarrer la conversation vocale",
    ask: "Poser une question",
    send: "Envoyer",
    question: "Que dit ce texte sur l’attention ?",
  },
};

// How long each step of the journey is left standing. These are the film's
// pacing, not the app's: every one of them is a decision about how long a
// viewer needs to take the step in, and they are gathered here because tuning
// the pace of the take is the thing this script gets re-run for.
const BEATS = {
  rest: 3000, // The workspace at rest, before anything moves.
  tab: 1100, // After the source type is chosen.
  chosen: 2200, // The dropzone holding a named file, ready to go in.
  ready: 1000, // After the extraction lands, before the text is opened.
  source: 4500, // The extracted text, open and being read.
  voice: 4000, // The live session, held so "Connected" and the line under the
  // controls saying it is listening both have time to be read. The film argues
  // voice first over this stretch, so it is the beat that has to carry it.
  typing: 75, // Per character, which is a person typing rather than a paste.
  asked: 900, // The finished question, before it is sent.
  answer: 7500, // The answer, held until it has been read.
  scroll: 900, // A smooth scroll, given time to arrive.
};

// English is the source language; the French take exists so the French film
// never shows an English product.
const LANGUAGES = ["en", "fr"];

// Which surfaces this run films. Recording one take costs a journey through
// the product and a video encode, so when only one surface has moved there is
// no reason to put the other one's finished take back through the camera.
const ONLY = process.env.URSLY_CAPTURE_SURFACES?.split(",")
  .map((name) => name.trim())
  .filter(Boolean);

const SURFACES = [
  // Narrower than a laptop really is, because the film does not show a whole
  // laptop. The renderer covers a nearly square stage with this take anchored
  // to its left edge, which keeps around the leftmost two thirds of whatever
  // is recorded; filmed at a true 1440 the crop lands between the two columns
  // and throws the answer away, which is the one thing the scene exists to
  // show. At 1100 the two-column layout is still intact and the crop reaches
  // well into the conversation.
  { name: "desktop", viewport: { width: 1100, height: 900 } },
  {
    name: "phone",
    viewport: { width: 390, height: 844 },
    mobile: devices["iPhone 13"],
    // A phone shows the source card and the conversation card stacked, so the
    // journey has to travel between them. Playwright would jump there on its
    // own when it clicks, and an instant jump reads as a cut; scrolling makes
    // it read as someone using the thing.
    scrolls: true,
  },
];

const run = promisify(execFile);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`;

/**
 * Walks the one journey this file knows, either for the camera or -- with
 * every hold collapsed -- as a warm-up. Reports `rest` as the length of the
 * lead-in to be cut off the raw capture, and the two moments the film has to
 * cut to as offsets into what will be left once it is gone.
 */
async function journey(page, surface, language, { t0, filmed }) {
  const words = COPY[language];
  const hold = (ms) => pause(filmed ? ms : 0);
  const since = () => Date.now() - t0;
  const marks = {};

  // The app moved to its own route when the landing page became the story:
  // `/<lang>` now argues for the product and `/<lang>/app` is the product.
  const url = `${ORIGIN}/${language}/app`;
  const response = await page.goto(url, { waitUntil: "networkidle" });
  if (!response?.ok())
    throw new Error(`${url} answered ${response?.status() ?? "nothing"}`);
  await page.addStyleTag({ content: HIDE_DEV_OVERLAYS });
  // Web fonts land after the network goes quiet and reflow every heading, so a
  // take that starts before they arrive opens on the page changing shape.
  await page.evaluate(() => document.fonts.ready);

  // Everything up to here is the development server compiling and the browser
  // painting, which is the toolchain being watched rather than the product.
  // The take is cut to start here, so this is the zero the offsets count from.
  marks.rest = since();

  // The opening hold: whoever is watching needs a moment to read the workspace
  // before anything starts moving.
  await hold(BEATS.rest);

  await page.getByRole("tab", { name: words.tab }).click();
  await hold(BEATS.tab);
  await page.getByLabel(words.file).setInputFiles({
    name: "attention.pdf",
    mimeType: "application/pdf",
    buffer: pdfFixture(SOURCE_TEXT),
  });
  await hold(BEATS.chosen);
  await page.getByRole("button", { name: words.go }).click();
  await page
    .locator(".preview-text")
    .waitFor({ state: "attached", timeout: 60_000 });
  await hold(BEATS.ready);

  // The extracted text arrives inside a closed disclosure. Opening it is the
  // point of the shot: it is the moment the source becomes something read.
  const preview = page.locator(".preview");
  if (await page.locator(".preview:not([open]) summary").count())
    await preview.locator("summary").click();
  if (surface.scrolls) await reveal(page, page.locator(".preview-text"));
  await page.locator(".preview-text").waitFor({ state: "visible" });
  marks.source = since() - marks.rest;
  await hold(BEATS.source);

  // Voice before the keyboard, because that is the order the product puts them
  // in and the order the film argues them in. The session is real: in mock
  // mode the app still opens one, reports itself connected and sits there
  // listening, so nothing here is a picture of a feature.
  const startVoice = page.getByRole("button", { name: words.voice });
  if (surface.scrolls) await reveal(page, startVoice);
  await startVoice.click();
  // The mute control is rendered only once the session reports itself
  // connected, which makes it the one honest signal that what is on screen is
  // a live session rather than a button that has just been pressed.
  await page
    .locator(".voice-controls button.secondary")
    .waitFor({ state: "visible", timeout: 60_000 });
  marks.voice = since() - marks.rest;
  await hold(BEATS.voice);

  const ask = page.getByLabel(words.ask, { exact: true });
  if (surface.scrolls) await reveal(page, ask);
  // Typed one character at a time, because a question appearing all at once
  // looks like a screenshot and a question being typed looks like a person.
  await ask.click();
  await ask.pressSequentially(words.question, { delay: BEATS.typing });
  await hold(BEATS.asked);
  await page.getByRole("button", { name: words.send, exact: true }).click();

  // The assistant's turn is dispatched with its text already in it, so the
  // bubble appearing and the answer being readable are the same instant.
  const reply = page.locator(".message.assistant .message-text").first();
  await reply.waitFor({ state: "visible", timeout: 60_000 });
  if (surface.scrolls) await reveal(page, reply);
  marks.answer = since() - marks.rest;
  await hold(BEATS.answer);

  return marks;
}

/**
 * Brings an element into the middle of the frame the way a person would get
 * there, rather than the way an automated click does.
 */
async function reveal(page, locator) {
  await locator.evaluate((node) =>
    node.scrollIntoView({ behavior: "smooth", block: "center" }),
  );
  await pause(BEATS.scroll);
}

function contextOptions(surface, extra = {}) {
  return {
    viewport: surface.viewport,
    deviceScaleFactor: 2,
    reducedMotion: "no-preference",
    colorScheme: "light",
    permissions: ["microphone"],
    ...(surface.mobile
      ? { isMobile: true, hasTouch: true, userAgent: surface.mobile.userAgent }
      : {}),
    ...extra,
  };
}

async function seedIntroSeen(context) {
  await context.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // Private modes refuse storage; the gate then covers the take, which
        // whoever watches the footage will notice immediately.
      }
    },
    [INTRO_KEY, INTRO_SEEN],
  );
}

/**
 * A development server compiles a route the first time it is asked for one,
 * and the first upload of a run therefore stalls for the better part of a
 * minute. Walking the journey once with the camera off buys every filmed take
 * a server that answers at the speed the product actually answers at.
 */
async function warmUp(browser) {
  const context = await browser.newContext(contextOptions(SURFACES[0]));
  await seedIntroSeen(context);
  try {
    for (const language of LANGUAGES) {
      const page = await context.newPage();
      await journey(page, SURFACES[0], language, {
        t0: Date.now(),
        filmed: false,
      });
      await page.close();
    }
  } finally {
    await context.close();
  }
}

/**
 * Cuts the head off a take. Recording starts when the page is created, so the
 * first seconds of every raw capture are a development server compiling and a
 * browser painting -- a blank frame where the film expects the workspace. The
 * film cues its scenes at offsets into this file, and an offset is only worth
 * writing down if it means the same thing on every re-record, so the take is
 * trimmed to begin at the moment the app is standing there ready to be used.
 */
async function trimLeadIn(source, target, lead) {
  await run("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    // Seeking before the input costs a decode from the previous keyframe and
    // saves a decode of everything being thrown away.
    "-ss",
    (lead / 1000).toFixed(3),
    "-i",
    source,
    // VP9 rather than the VP8 the browser hands back, because it is the one of
    // the two that splits a frame across cores: re-encoding half a minute of
    // 1440x900 single-threaded costs minutes per take, and there are four.
    "-c:v",
    "libvpx-vp9",
    "-row-mt",
    "1",
    "-threads",
    "8",
    "-cpu-used",
    "6",
    // The renderer scales this footage down into a laptop on a 1920x1080 frame,
    // so the quality that matters is the quality that survives that scaling
    // rather than the quality of the pixels as recorded. This is high enough
    // that the app's smallest type is still sharp once it lands in the film,
    // and low enough that re-recording is a minute rather than a coffee break.
    "-crf",
    "24",
    "-b:v",
    "0",
    "-an",
    target,
  ]);
}

async function record(browser, surface, language) {
  const dir = join(OUT, `.${surface.name}.${language}`);
  rmSync(dir, { recursive: true, force: true });
  const context = await browser.newContext(
    contextOptions(surface, {
      recordVideo: { dir, size: surface.viewport },
    }),
  );
  await seedIntroSeen(context);
  // Recording begins with the page, so the page is what the raw take counts
  // from; `marks.rest` then says how much of it is lead-in.
  const t0 = Date.now();
  const page = await context.newPage();
  const marks = await journey(page, surface, language, { t0, filmed: true });

  await context.close();
  const [file] = readdirSync(dir).filter((name) => name.endsWith(".webm"));
  const target = join(OUT, `app-${surface.name}.${language}.webm`);
  await trimLeadIn(join(dir, file), target, marks.rest);
  rmSync(dir, { recursive: true, force: true });
  console.log(
    `recorded ${target} \u2014 source text at ${seconds(marks.source)}, voice at ${seconds(marks.voice)}, answer at ${seconds(marks.answer)}`,
  );
}

mkdirSync(OUT, { recursive: true });
const surfaces = SURFACES.filter(({ name }) => !ONLY || ONLY.includes(name));
if (!surfaces.length) throw new Error(`No surface matches ${ONLY?.join(",")}`);
const browser = await chromium.launch({
  // A build machine has no microphone, and a permission dialogue is browser
  // furniture rather than product. A fake device that is granted without
  // asking puts a real voice session on screen with nothing in front of it.
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
  ],
});
try {
  await warmUp(browser);
  for (const surface of surfaces)
    for (const language of LANGUAGES) await record(browser, surface, language);
} finally {
  await browser.close();
}
