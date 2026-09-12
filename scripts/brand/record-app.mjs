// Records the application actually being used, so the introduction can show
// the product moving rather than a screenshot of it standing still.
//
//   npm run dev            # anything serving the app, by default on :3100
//   node scripts/brand/record-app.mjs
//
// Writes scripts/brand/footage/app-<surface>.<lang>.webm. The journey is
// driven slowly on purpose: this footage is watched, not asserted on, so every
// step holds long enough to be read at a glance.
import { mkdirSync, renameSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, devices } from "playwright";

const ORIGIN = process.env.URSLY_CAPTURE_ORIGIN ?? "http://localhost:3100";
const OUT = "scripts/brand/footage";
const INTRO_KEY = "ursly-intro-v1";

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
    ask: "Ask a question",
    send: "Send",
    question: "What does this say about attention?",
  },
  fr: {
    tab: "Document PDF",
    file: "Fichier PDF",
    go: "Passer aux questions",
    ask: "Poser une question",
    send: "Envoyer",
    question: "Que dit ce texte sur l’attention ?",
  },
};

const SURFACES = [
  { name: "desktop", viewport: { width: 1440, height: 900 }, scale: 1 },
  {
    name: "phone",
    viewport: { width: 390, height: 844 },
    scale: 1,
    mobile: devices["iPhone 13"],
  },
];

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function record(browser, surface, language) {
  const dir = join(OUT, `.${surface.name}.${language}`);
  rmSync(dir, { recursive: true, force: true });
  const context = await browser.newContext({
    viewport: surface.viewport,
    deviceScaleFactor: 2,
    reducedMotion: "no-preference",
    recordVideo: { dir, size: surface.viewport },
    ...(surface.mobile
      ? { isMobile: true, hasTouch: true, userAgent: surface.mobile.userAgent }
      : {}),
  });
  await context.addInitScript(
    (key) => localStorage.setItem(key, "seen"),
    INTRO_KEY,
  );
  const page = await context.newPage();
  const words = COPY[language];

  await page.goto(`${ORIGIN}/${language}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  // The opening hold: whoever is watching needs a moment to read the page
  // before anything starts moving.
  await pause(1800);

  await page.getByRole("tab", { name: words.tab }).click();
  await pause(900);
  await page.getByLabel(words.file).setInputFiles({
    name: "attention.pdf",
    mimeType: "application/pdf",
    buffer: pdfFixture(SOURCE_TEXT),
  });
  await pause(1200);
  await page.getByRole("button", { name: words.go }).click();
  await page
    .locator(".preview-text")
    .waitFor({ state: "attached", timeout: 30_000 });
  // The extracted text arrives inside a closed disclosure. Opening it is the
  // point of the shot: it is the moment the source becomes something read.
  if (await page.locator(".preview:not([open]) summary").count())
    await page.locator(".preview summary").click();
  await pause(1800);

  // Typed one character at a time, because a question appearing all at once
  // looks like a screenshot and a question being typed looks like a person.
  await page.getByLabel(words.ask, { exact: true }).click();
  await page
    .getByLabel(words.ask, { exact: true })
    .pressSequentially(words.question, { delay: 55 });
  await pause(700);
  await page.getByRole("button", { name: words.send, exact: true }).click();
  await pause(9000);

  await context.close();
  const [file] = readdirSync(dir).filter((name) => name.endsWith(".webm"));
  const target = join(OUT, `app-${surface.name}.${language}.webm`);
  renameSync(join(dir, file), target);
  rmSync(dir, { recursive: true, force: true });
  console.log(`recorded ${target}`);
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const surface of SURFACES)
  for (const language of ["en", "fr"]) await record(browser, surface, language);
await browser.close();
