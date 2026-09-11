// Records the three real experiences the introduction is cut from: the web
// application in a desktop browser, the native app in the iOS Simulator and
// the native app in the Android emulator. Every capture drives the actual
// product against a local API in mock mode, so what people see in the intro
// is what they get.
//
//   node scripts/brand/capture-intro.mjs [--only web,ios,android] [--lang en,fr]
//
// Environment:
//   INTRO_BASE_URL   web application (default http://localhost:3000; the
//                    native apps expect the API on that port too)
//   IOS_UDID         booted simulator, an iPhone at 100% window scale
//   IOS_APP          the built Ursly.app; reinstalled before each take so the
//                    onboarding and the remembered mode start fresh
//   ANDROID_SERIAL   emulator serial (default: the first adb device)
//   ANDROID_APK      the built APK; installed before the first take
//   ANDROID_HOME     SDK root, to find adb when it is not on PATH
//
// Output: .brand-captures/<platform>.<lang>.(webm|mp4) plus a JSON sidecar
// with the offset, in seconds, at which the scripted journey starts.
// Then run scripts/brand/intro-video.mjs to compose the video.
import { chromium } from "playwright";
import { execFile, execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const out = join(root, ".brand-captures");
mkdirSync(out, { recursive: true });

const args = new Map(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, "").split("=")),
);
const platforms = (args.get("only") ?? "web,ios,android").split(",");
const languages = (args.get("lang") ?? "en,fr").split(",");
const baseUrl = process.env.INTRO_BASE_URL ?? "http://localhost:3000";
const APP_ID = "com.talktosource.demo";

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
/** Actions land at fixed seconds from the take's start, whatever the machine. */
function timeline() {
  const start = Date.now();
  return async (seconds) => {
    const wait = start + seconds * 1000 - Date.now();
    if (wait > 0) await sleep(wait);
  };
}
function sidecar(name, data) {
  writeFileSync(join(out, `${name}.json`), JSON.stringify(data, null, 2));
}

// ---------------------------------------------------------------------------
// The sample document and the questions, English first with French twins.
// ---------------------------------------------------------------------------
const copy = {
  en: {
    pdfName: "small-breaks.pdf",
    pdfText:
      "The power of small breaks\n\nFocus grows in the moments when we pause, too. A short break gives us space to step back, see an idea with fresh eyes and return to a task with a clearer intention.\n\nTry this ritual: choose one task, put distractions aside for twenty minutes, then take two minutes to breathe and move. Before returning, write down your next small action.\n\nThe aim is not to fill every minute. It is to give more attention to what matters.",
    question: "What is the ritual this text suggests?",
    continueButton: "Continue to questions",
    pdfInput: "PDF file",
    askInput: "Ask a question",
    send: "Send",
  },
  fr: {
    pdfName: "petites-pauses.pdf",
    pdfText:
      "Le pouvoir des petites pauses\n\nLa concentration se cultive aussi dans les moments où l’on s’arrête. Une courte pause permet de prendre du recul, de relire une idée avec un regard neuf et de revenir à une tâche avec une intention plus claire.\n\nEssayez ce rituel : choisissez une seule tâche, éloignez les distractions pendant vingt minutes, puis accordez-vous deux minutes pour respirer et bouger. Avant de reprendre, notez la prochaine petite action.\n\nL’objectif n’est pas de remplir chaque minute. C’est de donner plus d’attention à ce qui compte.",
    question: "Quel rituel ce texte propose-t-il ?",
    continueButton: "Continuer vers les questions",
    pdfInput: "Fichier PDF",
    askInput: "Poser une question",
    send: "Envoyer",
  },
};

/** A small, honest PDF: Helvetica, WinAnsi so accents survive, one line per Tj. */
function pdf(text) {
  const lines = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(" ")) {
      if ((line + " " + word).trim().length > 78) {
        lines.push(line.trim());
        line = "";
      }
      line += " " + word;
    }
    lines.push(line.trim());
  }
  const escape = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const content = `BT /F1 12 Tf 16 TL 72 720 Td ${lines.map((l) => `(${escape(l)}) Tj T*`).join(" ")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
  ];
  let body = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body, "latin1");
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .map((n) => `${String(n).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body, "latin1");
}

// ---------------------------------------------------------------------------
// Web: the real application in a desktop browser, 1440×900, so the whole
// workspace stays in view while the conversation happens.
// ---------------------------------------------------------------------------
async function captureWeb(lang) {
  const text = copy[lang];
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: lang === "fr" ? "fr-CA" : "en-CA",
    recordVideo: { dir: out, size: { width: 1440, height: 900 } },
  });
  const created = Date.now();
  await context.addInitScript(() => localStorage.setItem("ursly-intro-v1", "seen"));
  const page = await context.newPage();
  await page.goto(`${baseUrl}/${lang}`);
  // Next.js pins a build badge to the corner; it is not part of the product.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  // The mouse is part of the story: show it resting before it moves.
  await page.mouse.move(720, 470);
  await page.getByLabel(text.pdfInput).waitFor();
  await sleep(300);
  const offset = (Date.now() - created) / 1000;
  const at = timeline();

  await at(1.2);
  await page.getByLabel(text.pdfInput).setInputFiles({
    name: text.pdfName,
    mimeType: "application/pdf",
    buffer: pdf(text.pdfText),
  });
  await at(2.2);
  const go = page.getByRole("button", { name: text.continueButton });
  await go.hover();
  await at(2.6);
  await go.click();
  await page.locator(".preview").waitFor();
  await at(4.2);
  const ask = page.getByLabel(text.askInput, { exact: true });
  await ask.click();
  await at(4.6);
  await ask.pressSequentially(text.question, { delay: 55 });
  await at(7.6);
  const send = page.getByRole("button", { name: text.send, exact: true });
  await send.hover();
  await at(7.9);
  await send.click();
  await page.locator(".message-author").nth(1).waitFor();
  await at(11.5);
  await page.close();
  const path = await page.video().path();
  await context.close();
  await browser.close();
  renameSync(path, join(out, `web.${lang}.webm`));
  sidecar(`web.${lang}`, { offset, duration: 11.5, width: 1440, height: 900 });
  console.log(`web ${lang}: recorded, journey starts at ${offset.toFixed(2)}s`);
}

// ---------------------------------------------------------------------------
// iOS: the native app in the Simulator, recorded by simctl and driven through
// the accessibility tree the Simulator exposes (scripts/brand/sim-ax.swift),
// so it works whatever Space the Simulator window is on.
// ---------------------------------------------------------------------------
const IOS = {
  skipOnboarding: "Skip onboarding",
  language: "About Ursly and language",
  french: "Français",
  closeSheet: "Close",
  keyboardMode: "Keyboard to action",
  sample: "Try a sample text",
  composer: "Your question",
  send: "Send question",
};
const IOS_FR = {
  ...IOS,
  closeSheet: "Fermer",
  keyboardMode: "Clavier",
  sample: "Essayer un texte d’exemple",
  composer: "Votre question",
  send: "Envoyer la question",
};
function simAx() {
  const binary = join(out, "sim-ax");
  const source = join(here, "sim-ax.swift");
  if (!existsSync(binary) || statSync(binary).mtimeMs < statSync(source).mtimeMs)
    execFileSync("swiftc", ["-O", source, "-o", binary], { stdio: "inherit" });
  return binary;
}
async function captureIos(lang) {
  const udid = process.env.IOS_UDID ?? "booted";
  const app = process.env.IOS_APP;
  if (!app) throw new Error("Set IOS_APP to the built Ursly.app to record iOS.");
  const ax = simAx();
  // A fresh install each take: the tour and the remembered mode start over.
  for (const step of ["terminate", "uninstall"])
    try {
      execFileSync("xcrun", ["simctl", step, udid, APP_ID], { stdio: "ignore" });
    } catch {
      /* Nothing to end or remove yet. */
    }
  execFileSync("xcrun", ["simctl", "install", udid, app], { stdio: "inherit" });
  const targets = lang === "fr" ? IOS_FR : IOS;
  // Labels change with the language once it is switched; before that they are English.
  const press = (label) => exec(ax, ["press", label]);
  const type = (text) => exec(ax, ["set", targets.composer, text]);

  const file = join(out, `ios.${lang}.mp4`);
  const recorder = spawn("xcrun", ["simctl", "io", udid, "recordVideo", "--codec", "h264", "--force", file], { stdio: "ignore" });
  const started = Date.now();
  await sleep(1500);
  execFileSync("xcrun", ["simctl", "launch", udid, APP_ID], { stdio: "ignore" });
  await exec(ax, ["wait", IOS.skipOnboarding, "20"]);
  await sleep(1200); // the first slide settles in
  const offset = (Date.now() - started) / 1000 - 1.5;
  const duration = await phoneJourney(lang, { ...targets, skipOnboarding: IOS.skipOnboarding, language: IOS.language, french: IOS.french }, press, type);
  recorder.kill("SIGINT");
  await new Promise((done) => recorder.on("exit", done));
  sidecar(`ios.${lang}`, { offset, duration });
  console.log(`ios ${lang}: recorded, journey starts at ${offset.toFixed(2)}s`);
}

// ---------------------------------------------------------------------------
// Android: the native app in the emulator, recorded and driven through adb.
// ---------------------------------------------------------------------------
// Pixels on a 1080×2400 emulator, measured on the built app.
const ANDROID = {
  skipOnboarding: [210, 2280],
  language: [960, 219],
  french: [781, 1440],
  closeSheet: [965, 1173],
  keyboardMode: [540, 2235],
  sample: [540, 1360],
  composer: [400, 1935],
  send: [1000, 1935],
};
function adbPath() {
  for (const candidate of [
    process.env.ANDROID_HOME && join(process.env.ANDROID_HOME, "platform-tools/adb"),
    process.env.ANDROID_SDK_ROOT && join(process.env.ANDROID_SDK_ROOT, "platform-tools/adb"),
    "/opt/homebrew/share/android-commandlinetools/platform-tools/adb",
    join(process.env.HOME ?? "", "Library/Android/sdk/platform-tools/adb"),
  ])
    if (candidate && existsSync(candidate)) return candidate;
  return "adb";
}
async function captureAndroid(lang) {
  const adb = adbPath();
  const serial =
    process.env.ANDROID_SERIAL ??
    execFileSync(adb, ["devices"]).toString().split("\n").map((l) => l.split("\t"))
      .find(([, state]) => state?.trim() === "device")?.[0];
  if (!serial) throw new Error("No Android emulator is attached.");
  const run = (...cmd) => exec(adb, ["-s", serial, ...cmd]);
  const shell = (...cmd) => run("shell", ...cmd);
  if (process.env.ANDROID_APK && !captureAndroid.installed) {
    await run("install", "-r", process.env.ANDROID_APK);
    captureAndroid.installed = true;
  }
  await run("reverse", "tcp:3000", "tcp:3000");
  await shell("am", "force-stop", APP_ID);
  await shell("pm", "clear", APP_ID);
  await run("reverse", "tcp:3000", "tcp:3000");
  const remote = "/sdcard/ursly-intro.mp4";
  const recorder = spawn(adb, ["-s", serial, "shell", "screenrecord", "--bit-rate", "8000000", "--time-limit", "60", remote], { stdio: "ignore" });
  const started = Date.now();
  await sleep(1200);
  await shell("am", "start", "-n", `${APP_ID}/.MainActivity`);
  await sleep(3200);
  const offset = (Date.now() - started) / 1000 - 1.5;
  const tap = ([x, y]) => shell("input", "tap", String(x), String(y));
  // `input text` takes spaces as %s; the rest of a question passes through.
  const type = (text) => shell("input", "text", text.replace(/ /g, "%s"));
  const duration = await phoneJourney(lang, ANDROID, tap, type);
  await shell("pkill", "-INT", "screenrecord");
  await new Promise((done) => recorder.on("exit", done));
  await sleep(800);
  await run("pull", remote, join(out, `android.${lang}.mp4`));
  sidecar(`android.${lang}`, { offset, duration });
  console.log(`android ${lang}: recorded, journey starts at ${offset.toFixed(2)}s`);
}

const capture = { web: captureWeb, ios: captureIos, android: captureAndroid };
for (const platform of platforms) {
  if (!capture[platform]) throw new Error(`Unknown platform ${platform}`);
  for (const lang of languages) await capture[platform](lang);
}
