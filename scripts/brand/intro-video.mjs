// Renders the localized intro videos from one screen recording and a text
// overlay per language. The recording is the phone chapter captured for the
// iOS walkthrough; it is not committed, so point INTRO_SOURCE_RECORDING at it.
//
//   INTRO_SOURCE_RECORDING=/path/to/00-intro.mp4 node scripts/brand/intro-video.mjs
//
// Requires ImageMagick (`magick`) and ffmpeg with libx264 and libvpx on PATH.
// Output goes to apps/web/public/brand as ursly-intro.<lang>.mp4 (H.264, for
// Safari and mobile) and ursly-intro.<lang>.webm (VP9, for browsers without
// H.264 such as Chromium builds used in tests), and to apps/mobile/assets as
// mp4 only.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const recording = process.env.INTRO_SOURCE_RECORDING;
if (!recording) {
  console.error("Set INTRO_SOURCE_RECORDING to the phone recording (mp4).");
  process.exit(1);
}

const DURATION_SECONDS = 24;
const paper = "#f8f5ef";
const ink = "#292735";
const muted = "#6d6878";
const accent = "#b34f38";

// English is the source language; French is the explicit translation.
const copy = {
  en: {
    brand: "URSLY",
    headline: ["A source.", "A conversation."],
    lede: "Turn documents and videos into understanding.",
    modes: "Voice to action  ·  Keyboard  ·  Motion (beta)",
    rail: "SOURCE  →  QUESTION  →  UNDERSTANDING",
  },
  fr: {
    brand: "URSLY",
    headline: ["Une source.", "Une conversation."],
    lede: "Transformez vos documents et vidéos en compréhension.",
    modes: "Voix vers action  ·  Clavier  ·  Mouvement (bêta)",
    rail: "SOURCE  →  QUESTION  →  COMPRÉHENSION",
  },
};

const escape = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function overlay({ brand, headline, lede, modes, rail }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <rect width="1920" height="1080" fill="${paper}"/>
  <text x="96" y="116" fill="${ink}" font-family="Arial, sans-serif" font-size="42" font-weight="700" letter-spacing="4">${escape(brand)}</text>
  <text x="96" y="390" fill="${ink}" font-family="Georgia, serif" font-size="78">${escape(headline[0])}</text>
  <text x="96" y="485" fill="${ink}" font-family="Georgia, serif" font-size="78">${escape(headline[1])}</text>
  <text x="100" y="565" fill="${muted}" font-family="Arial, sans-serif" font-size="30">${escape(lede)}</text>
  <text x="100" y="645" fill="${accent}" font-family="Arial, sans-serif" font-size="28" font-weight="700">${escape(modes)}</text>
  <text x="100" y="950" fill="${muted}" font-family="Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="3">${escape(rail)}</text>
</svg>
`;
}

const work = mkdtempSync(join(tmpdir(), "ursly-intro-"));
const web = "apps/web/public/brand";
const mobile = "apps/mobile/assets";
for (const directory of [web, mobile]) mkdirSync(directory, { recursive: true });

const composite =
  "[0:v]crop=520:1080:1080:0,scale=520:1080:flags=lanczos[phone];[1:v][phone]overlay=1400:0:shortest=1";

function render(recordingPath, overlayPng, output, codecArgs) {
  execFileSync(
    "ffmpeg",
    [
      "-y", "-loglevel", "error",
      "-i", recordingPath,
      "-loop", "1", "-i", overlayPng,
      "-filter_complex", composite,
      "-t", String(DURATION_SECONDS),
      "-an",
      ...codecArgs,
      output,
    ],
    { stdio: "inherit" },
  );
}

for (const [lang, text] of Object.entries(copy)) {
  const svg = join(work, `overlay.${lang}.svg`);
  const png = join(work, `overlay.${lang}.png`);
  const mp4 = join(work, `ursly-intro.${lang}.mp4`);
  const webm = join(work, `ursly-intro.${lang}.webm`);
  writeFileSync(svg, overlay(text));
  execFileSync("magick", [svg, png], { stdio: "inherit" });
  render(recording, png, mp4, [
    "-c:v", "libx264", "-preset", "medium", "-crf", "25",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
  ]);
  render(recording, png, webm, [
    "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34", "-row-mt", "1",
    "-pix_fmt", "yuv420p",
  ]);
  copyFileSync(mp4, join(web, `ursly-intro.${lang}.mp4`));
  copyFileSync(webm, join(web, `ursly-intro.${lang}.webm`));
  copyFileSync(mp4, join(mobile, `ursly-intro.${lang}.mp4`));
  console.log(`rendered ${lang}`);
}
