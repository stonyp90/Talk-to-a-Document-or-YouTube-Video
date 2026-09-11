// Composes the localized intro videos from the real screen recordings that
// scripts/brand/capture-intro.mjs makes: the web application in a desktop
// browser, then the native app on iPhone, then on Android. Text sits on the
// left, the device on the right, and the chapters cross-fade. English is the
// source language; French is the explicit translation.
//
//   node scripts/brand/capture-intro.mjs && node scripts/brand/intro-video.mjs
//
// Requires ImageMagick (`magick`) and ffmpeg with libx264 and libvpx on PATH.
// Output goes to apps/web/public/brand as ursly-intro.<lang>.mp4 (H.264, for
// Safari and mobile), ursly-intro.<lang>.webm (VP9, for browsers without
// H.264 such as the Chromium builds used in tests) and ursly-intro.<lang>.vtt
// (the captions, which IntroGate also lists as the transcript), and to
// apps/mobile/assets as mp4 only.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const captures = join(root, ".brand-captures");
const web = join(root, "apps/web/public/brand");
const mobile = join(root, "apps/mobile/assets");

const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;
const FADE = 0.5;
// Chapter lengths add up to 24 seconds once the two cross-fades overlap.
const CHAPTERS = [
  { id: "web", seconds: 8 },
  { id: "ios", seconds: 8.5 },
  { id: "android", seconds: 8.5 },
];
const DURATION = CHAPTERS.reduce((sum, c) => sum + c.seconds, 0) - FADE * (CHAPTERS.length - 1);

const paper = "#f8f5ef";
const ink = "#292735";
const muted = "#6d6878";
const accent = "#b34f38";
const line = "#e6e1da";
const chrome = "#ebe6de";

const copy = {
  en: {
    web: {
      eyebrow: "ON THE WEB",
      headline: ["A source.", "A conversation."],
      lede: "Bring a document or a video. Ursly reads it, then you ask.",
    },
    ios: {
      eyebrow: "ON IPHONE",
      headline: ["Voice to action,", "by default."],
      lede: "The same Ursly in your pocket. Keyboard is one tap away, motion is coming.",
    },
    android: {
      eyebrow: "ON ANDROID",
      headline: ["Source. Question.", "Understanding."],
      lede: "Every answer stays grounded in what you brought.",
    },
    rail: "SOURCE  →  QUESTION  →  UNDERSTANDING",
    captions: [
      [0, 4, "Ursly on the web. A source, a conversation."],
      [4, 8, "Bring a document or a video. Ursly reads it, then you ask."],
      [8, 16, "The same Ursly on iPhone: voice to action by default, keyboard one tap away."],
      [16, 24, "And on Android. Source, question, understanding."],
    ],
  },
  fr: {
    web: {
      eyebrow: "SUR LE WEB",
      headline: ["Une source.", "Une conversation."],
      lede: "Apportez un document ou une vidéo. Ursly le lit, puis vous questionnez.",
    },
    ios: {
      eyebrow: "SUR IPHONE",
      headline: ["La voix d’abord,", "par défaut."],
      lede: "Le même Ursly dans votre poche. Le clavier est à un geste, le mouvement arrive.",
    },
    android: {
      eyebrow: "SUR ANDROID",
      headline: ["Source. Question.", "Compréhension."],
      lede: "Chaque réponse reste ancrée dans ce que vous avez apporté.",
    },
    rail: "SOURCE  →  QUESTION  →  COMPRÉHENSION",
    captions: [
      [0, 4, "Ursly sur le web. Une source, une conversation."],
      [4, 8, "Apportez un document ou une vidéo. Ursly le lit, puis vous questionnez."],
      [8, 16, "Le même Ursly sur iPhone : la voix d’abord, le clavier à un geste."],
      [16, 24, "Et sur Android. Source, question, compréhension."],
    ],
  },
};

const escape = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Where each device sits on the 1920×1080 stage, and how big. */
const stage = {
  web: { x: 660, y: 194, w: 1180, h: 738 },
  ios: { x: 1330, y: 60, h: 960 },
  android: { x: 1330, y: 60, h: 960 },
};

function probe(file) {
  const json = execFileSync("ffprobe", [
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height", "-of", "json", file,
  ]).toString();
  const { width, height } = JSON.parse(json).streams[0];
  return { width, height };
}

/** The base layer of a chapter: paper, text and the frame around the device. */
function overlay(id, text, rail, box) {
  const wide = id === "web";
  const headlineSize = wide ? 60 : 78;
  const textX = 96;
  const parts = [`<rect width="${WIDTH}" height="${HEIGHT}" fill="${paper}"/>`];
  parts.push(
    `<text x="${textX}" y="116" fill="${ink}" font-family="Arial, sans-serif" font-size="42" font-weight="700" letter-spacing="4">URSLY</text>`,
    `<text x="${textX + 2}" y="${wide ? 330 : 360}" fill="${accent}" font-family="Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="4">${escape(text.eyebrow)}</text>`,
    `<text x="${textX}" y="${wide ? 410 : 460}" fill="${ink}" font-family="Georgia, serif" font-size="${headlineSize}">${escape(text.headline[0])}</text>`,
    `<text x="${textX}" y="${wide ? 410 + headlineSize * 1.15 : 460 + headlineSize * 1.15}" fill="${ink}" font-family="Georgia, serif" font-size="${headlineSize}">${escape(text.headline[1])}</text>`,
  );
  // The lede wraps by hand: a narrow column beside the browser, a wide one beside a phone.
  const ledeWidth = wide ? 34 : 58;
  const words = text.lede.split(" ");
  const lines = [""];
  for (const word of words) {
    if ((lines.at(-1) + " " + word).trim().length > ledeWidth) lines.push("");
    lines[lines.length - 1] = (lines.at(-1) + " " + word).trim();
  }
  const ledeY = wide ? 410 + headlineSize * 1.15 + 70 : 460 + headlineSize * 1.15 + 80;
  lines.forEach((l, i) =>
    parts.push(`<text x="${textX + 2}" y="${ledeY + i * 40}" fill="${muted}" font-family="Arial, sans-serif" font-size="27">${escape(l)}</text>`),
  );
  parts.push(
    `<text x="${textX + 4}" y="1000" fill="${muted}" font-family="Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="3">${escape(rail)}</text>`,
  );
  if (wide) {
    // A quiet browser window: shadow, chrome bar, three dots.
    parts.push(
      `<rect x="${box.x - 8}" y="${box.y - 44}" width="${box.w + 16}" height="${box.h + 52}" rx="18" fill="#000" fill-opacity="0.08"/>`,
      `<rect x="${box.x - 1}" y="${box.y - 37}" width="${box.w + 2}" height="${box.h + 38}" rx="14" fill="${chrome}" stroke="${line}"/>`,
      ...[0, 1, 2].map((i) => `<circle cx="${box.x + 20 + i * 20}" cy="${box.y - 18}" r="6" fill="${line}"/>`),
      `<rect x="${box.x + 90}" y="${box.y - 29}" width="${box.w - 180}" height="22" rx="11" fill="${paper}"/>`,
      `<text x="${box.x + box.w / 2}" y="${box.y - 13}" text-anchor="middle" fill="${muted}" font-family="Arial, sans-serif" font-size="14">ursly.io</text>`,
    );
  } else {
    parts.push(
      `<rect x="${box.x - 12}" y="${box.y - 12}" width="${box.w + 24}" height="${box.h + 24}" rx="64" fill="#000" fill-opacity="0.10" transform="translate(0 14)"/>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${parts.join("\n")}</svg>\n`;
}

/** A phone bezel with a transparent, rounded hole exactly the size of the recording. */
function bezel(box) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <path fill-rule="evenodd" fill="${ink}" d="M${box.x - 12} ${box.y + 52} a64 64 0 0 1 64 -64 h${box.w + 24 - 128} a64 64 0 0 1 64 64 v${box.h + 24 - 128} a64 64 0 0 1 -64 64 h-${box.w + 24 - 128} a64 64 0 0 1 -64 -64 z
    M${box.x} ${box.y + 48} a48 48 0 0 1 48 -48 h${box.w - 96} a48 48 0 0 1 48 48 v${box.h - 96} a48 48 0 0 1 -48 48 h-${box.w - 96} a48 48 0 0 1 -48 -48 z"/>
</svg>
`;
}

function vtt(captions) {
  const stamp = (s) => `00:${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.000`;
  return `WEBVTT\n\n${captions.map(([from, to, text]) => `${stamp(from)} --> ${stamp(to)}\n${text}`).join("\n\n")}\n`;
}

const work = mkdtempSync(join(tmpdir(), "ursly-intro-"));
for (const directory of [web, mobile]) mkdirSync(directory, { recursive: true });

function render(inputs, filter, output, codecArgs) {
  execFileSync(
    "ffmpeg",
    ["-y", "-loglevel", "error", ...inputs, "-filter_complex", filter, "-map", "[out]", "-t", String(DURATION), "-r", String(FPS), "-an", ...codecArgs, output],
    { stdio: "inherit" },
  );
}

for (const lang of Object.keys(copy)) {
  const text = copy[lang];
  const inputs = [];
  const filters = [];
  const chapterLabels = [];
  CHAPTERS.forEach((chapter, index) => {
    const id = chapter.id;
    const file = ["webm", "mp4"].map((ext) => join(captures, `${id}.${lang}.${ext}`)).find(existsSync);
    if (!file) throw new Error(`Missing capture ${id}.${lang}; run scripts/brand/capture-intro.mjs first.`);
    const meta = JSON.parse(readFileSync(join(captures, `${id}.${lang}.json`), "utf8"));
    const size = probe(file);
    const box = { ...stage[id] };
    if (!box.w) box.w = Math.round((box.h * size.width) / size.height / 2) * 2;
    const overlayPng = join(work, `overlay.${lang}.${id}.png`);
    writeFileSync(overlayPng.replace(/png$/, "svg"), overlay(id, text[id], text.rail, box));
    execFileSync("magick", [overlayPng.replace(/png$/, "svg"), overlayPng], { stdio: "inherit" });
    const video = inputs.length / 2;
    inputs.push("-i", file);
    const base = inputs.length / 2;
    inputs.push("-loop", "1", "-framerate", String(FPS), "-t", String(chapter.seconds + 1), "-i", overlayPng);
    const start = Math.max(0, meta.offset);
    // Each journey is played just fast enough to fit its chapter, so nothing
    // is cut off and the pace stays honest.
    const speed = Math.max(1, meta.duration / chapter.seconds);
    filters.push(
      `[${video}:v]trim=start=${start}:end=${start + meta.duration + 1},setpts=(PTS-STARTPTS)/${speed.toFixed(3)},fps=${FPS},scale=${box.w}:${box.h}:flags=lanczos,tpad=stop_mode=clone:stop_duration=3[dev${index}]`,
      `[${base}:v][dev${index}]overlay=${box.x}:${box.y}:shortest=1[on${index}]`,
    );
    let label = `on${index}`;
    if (id !== "web") {
      const bezelPng = join(work, `bezel.${lang}.${id}.png`);
      writeFileSync(bezelPng.replace(/png$/, "svg"), bezel(box));
      execFileSync("magick", ["-background", "none", bezelPng.replace(/png$/, "svg"), bezelPng], { stdio: "inherit" });
      const ring = inputs.length / 2;
      inputs.push("-loop", "1", "-framerate", String(FPS), "-t", String(chapter.seconds + 1), "-i", bezelPng);
      filters.push(`[${label}][${ring}:v]overlay=0:0:shortest=1[fr${index}]`);
      label = `fr${index}`;
    }
    filters.push(`[${label}]format=yuv420p,trim=end=${chapter.seconds},setpts=PTS-STARTPTS[c${index}]`);
    chapterLabels.push(`c${index}`);
  });
  // Cross-fade the chapters into one 24-second take.
  let previous = chapterLabels[0];
  let elapsed = CHAPTERS[0].seconds;
  chapterLabels.slice(1).forEach((label, i) => {
    const name = i === chapterLabels.length - 2 ? "out" : `x${i}`;
    filters.push(`[${previous}][${label}]xfade=transition=fade:duration=${FADE}:offset=${elapsed - FADE}[${name}]`);
    elapsed += CHAPTERS[i + 1].seconds - FADE;
    previous = name;
  });
  const filter = filters.join(";");
  const mp4 = join(work, `ursly-intro.${lang}.mp4`);
  const webm = join(work, `ursly-intro.${lang}.webm`);
  render(inputs, filter, mp4, [
    "-c:v", "libx264", "-preset", "medium", "-crf", "23",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
  ]);
  render(inputs, filter, webm, [
    "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "33", "-row-mt", "1",
    "-pix_fmt", "yuv420p",
  ]);
  copyFileSync(mp4, join(web, `ursly-intro.${lang}.mp4`));
  copyFileSync(webm, join(web, `ursly-intro.${lang}.webm`));
  copyFileSync(mp4, join(mobile, `ursly-intro.${lang}.mp4`));
  writeFileSync(join(web, `ursly-intro.${lang}.vtt`), vtt(text.captions));
  console.log(`rendered ${lang} (${DURATION}s)`);
}
