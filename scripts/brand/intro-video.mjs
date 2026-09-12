// Draws the twenty-four second introduction, in both languages, from nothing
// but this repository:
//
//   node scripts/brand/intro-video.mjs
//
// It used to need a screen recording that was never committed, which meant the
// video could not be rebuilt by anyone who did not already have that file, and
// could not be rebuilt in CI at all. Every frame is now drawn here as SVG and
// rasterised with ImageMagick (`magick`), with real screenshots of the running
// app -- captured by scripts/brand/capture-app.mjs and committed under
// scripts/brand/stills -- composited in where the argument is about the
// product rather than about the idea. ffmpeg assembles the frames and
// cross-fades the four scenes into one continuous take.
//
// The argument the video makes is not invented here. It lives in
// apps/web/app/content/intro-video.ts, which the page, the structured data and
// the transcript all read; the English below is that file's wording verbatim,
// the French is its translation. This is a build script and cannot import the
// app's TypeScript dictionary, so the two have to be kept in step by hand --
// which is also why this script now writes the .vtt captions instead of
// leaving them hand-maintained beside the video, free to drift.
//
// Outputs, unchanged in name and shape from the previous renderer plus the
// captions: apps/web/public/brand/ursly-intro.<lang>.{mp4,webm,vtt} and
// apps/mobile/assets/ursly-intro.<lang>.mp4. Requires ImageMagick and an
// ffmpeg built with libx264 and libvpx on PATH.
import { execFile } from "node:child_process";
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync } from "node:fs";
import { tmpdir, cpus } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const WIDTH = 1920;
const HEIGHT = 1080;

// Four scenes of six seconds, the same numbers INTRO_SCENE_SECONDS and
// INTRO_DURATION_SECONDS give the page, so the captions, the schema.org
// duration and the frames can never disagree.
const SCENE_SECONDS = 6;
const SCENES = 4;
const DURATION_SECONDS = SCENE_SECONDS * SCENES;

// Frames are drawn at half the delivered rate: the motion here is slow fades
// and slow rises, which survive the doubling, and drawing every frame twice
// over would double a render that already runs a few hundred `magick` calls.
const RENDER_FPS = 15;
const OUTPUT_FPS = 30;

// Long enough to read as one continuous take, short enough that a scene is
// fully legible for well over five of its six seconds. Each cross-fade
// straddles the caption boundary rather than sitting after it, so the words on
// screen and the words in the .vtt change at the same instant.
const CROSSFADE_SECONDS = 0.8;

// The brand palette, as declared for every other generated asset.
const paper = "#f8f5ef";
const ink = "#292735";
const muted = "#6d6878";
const accent = "#b34f38";
const screen = "#ffffff";
const hairline = "#e2dcd2";

// ImageMagick's own SVG renderer resolves these family names through
// fontconfig. Arial rather than Helvetica for the sans: Helvetica on this
// platform has no glyph for the arrow in the rail, and silently drops it.
const SERIF = { svg: "Georgia, serif", magick: "Georgia" };
const SANS = { svg: "Arial, Helvetica, sans-serif", magick: "Arial" };

// The type column on the left; the right third of the frame belongs to
// whatever the scene is showing.
const MARGIN = 96;
const COLUMN = 880;
const HEADLINE_SIZE = 74;
const HEADLINE_LEADING = 90;
const HEADLINE_BASELINE = 470; // The last headline line sits here whatever the wrap.
const LEDE_SIZE = 34;
const LEDE_LEADING = 48;
const RAIL_Y = 962;

// How an element arrives: a third of a second of travel, from a little below.
const ENTER_SECONDS = 0.7;
const ENTER_STAGGER = 0.14;
const RISE = 26;

const STILLS = "scripts/brand/stills";
const WEB = "apps/web/public/brand";
const MOBILE = "apps/mobile/assets";

// English is the source language; French is the translation the site ships,
// worded exactly as the page words it -- typographic apostrophes included,
// because the page's transcript and these captions are two renderings of one
// sentence and anything that compares them will call a straight quote a
// difference.
const copy = {
  en: {
    rail: "SOURCE  →  QUESTION  →  UNDERSTANDING",
    beta: "BETA",
    modes: { voice: "Voice", motion: "Motion", keyboard: "Keyboard" },
    site: "ursly.io",
    scenes: [
      {
        headline: "The next generation of internet.",
        lede: "Internet without a keyboard and a mouse.",
      },
      { headline: "Voice to action.", lede: "Say it, and Ursly does it." },
      {
        headline: "Motion to action.",
        lede: "In beta, built for the headsets coming next.",
      },
      {
        headline: "The keyboard still works.",
        lede: "It is simply no longer the way in.",
      },
    ],
  },
  fr: {
    rail: "SOURCE  →  QUESTION  →  COMPRÉHENSION",
    beta: "BÊTA",
    modes: { voice: "Voix", motion: "Mouvement", keyboard: "Clavier" },
    site: "ursly.io",
    scenes: [
      {
        headline: "La nouvelle génération d’internet.",
        lede: "Internet sans clavier ni souris.",
      },
      { headline: "Voix vers action.", lede: "Dites-le, Ursly le fait." },
      {
        headline: "Mouvement vers action.",
        lede: "En bêta, pensé pour les casques qui arrivent.",
      },
      {
        headline: "Le clavier fonctionne toujours.",
        lede: "Ce n’est simplement plus la porte d’entrée.",
      },
    ],
  },
};

const number = (value) => Math.round(value * 100) / 100;
const clamp = (value) => Math.min(1, Math.max(0, value));
// Decelerating: things arrive quickly and settle, rather than sliding at a
// constant speed, which always reads as a slideshow.
const ease = (progress) => 1 - (1 - progress) ** 3;

/** How far into its entrance an element is, `after` seconds into the scene. */
const entered = (t, after) => ease(clamp((t - after) / ENTER_SECONDS));

const escape = (value) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const text = ({
  x,
  y,
  value,
  size,
  font = SANS,
  fill = ink,
  weight,
  spacing,
  anchor,
  opacity = 1,
}) =>
  `<text x="${number(x)}" y="${number(y)}" fill="${fill}" font-family="${font.svg}" font-size="${number(size)}"` +
  (weight ? ` font-weight="${weight}"` : "") +
  (spacing ? ` letter-spacing="${spacing}"` : "") +
  (anchor ? ` text-anchor="${anchor}"` : "") +
  (opacity < 1 ? ` opacity="${number(opacity)}"` : "") +
  `>${escape(value)}</text>`;

const box = ({ x, y, width, height, r = 0, fill, opacity = 1 }) =>
  `<rect x="${number(x)}" y="${number(y)}" width="${number(width)}" height="${number(height)}"` +
  (r ? ` rx="${number(r)}"` : "") +
  ` fill="${fill}"` +
  (opacity < 1 ? ` opacity="${number(opacity)}"` : "") +
  `/>`;

/** Wraps `body` in the entrance it is making: faded down, nudged up. */
const arriving = (progress, body) =>
  `<g opacity="${number(progress)}" transform="translate(0,${number((1 - progress) * RISE)})">${body}</g>`;

// ImageMagick's SVG renderer ignores stroke widths on <line>, so every rule
// and outline in these scenes is a filled rectangle. A ring is drawn the same
// way a ring is cut: a disc, with a smaller disc of the background punched out
// of it, which only works over flat paper -- so nothing rippling passes behind
// anything else.
const ring = (cx, cy, radius, thickness, fill, opacity) =>
  `<circle cx="${number(cx)}" cy="${number(cy)}" r="${number(radius)}" fill="${fill}" opacity="${number(opacity)}"/>` +
  // Opaque, whatever the ring's own opacity: a translucent punch would leave
  // the disc it is cutting out of faintly filled in.
  `<circle cx="${number(cx)}" cy="${number(cy)}" r="${number(Math.max(0, radius - thickness))}" fill="${paper}"/>`;

/**
 * Measured rather than guessed: the same rasteriser that draws the frame is
 * asked how wide a string will be, so a longer translation rewraps itself
 * instead of running off the edge of the frame.
 */
const measured = new Map();
async function width(value, font, size) {
  const key = `${font.magick}|${size}|${value}`;
  const known = measured.get(key);
  if (known !== undefined) return known;
  const { stdout } = await run("magick", [
    "-background",
    "none",
    "-font",
    font.magick,
    "-pointsize",
    String(size),
    `label:${value}`,
    "-format",
    "%w",
    "info:",
  ]);
  const result = Number(stdout.trim());
  measured.set(key, result);
  return result;
}

async function wrap(value, font, size, limit) {
  const lines = [];
  let line = "";
  for (const word of value.split(" ")) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && (await width(candidate, font, size)) > limit) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Everything about a scene that does not change from frame to frame: the
 * wrapped lines and the baselines they sit on. Measuring once per language
 * rather than once per frame keeps the render to one `magick` call per frame.
 */
async function layout(language) {
  const scenes = [];
  for (const scene of copy[language].scenes) {
    const headline = await wrap(scene.headline, SERIF, HEADLINE_SIZE, COLUMN);
    const lede = await wrap(scene.lede, SANS, LEDE_SIZE, COLUMN);
    const ledeTop = HEADLINE_BASELINE + 76;
    scenes.push({
      headline,
      lede,
      // The headline grows upward from a fixed last baseline, so a two-line
      // wrap never pushes the lede or what follows it out of place.
      headlineTop: HEADLINE_BASELINE - (headline.length - 1) * HEADLINE_LEADING,
      ledeTop,
      featureTop: ledeTop + (lede.length - 1) * LEDE_LEADING + 96,
    });
  }
  return scenes;
}

/** The rail and the four scene ticks: on screen for all 24s. */
function furniture(words, index, t) {
  const trackWidth = 34;
  const gap = 14;
  const ticksLeft = WIDTH - MARGIN - (SCENES * trackWidth + (SCENES - 1) * gap);
  const ticks = Array.from({ length: SCENES }, (_, i) => {
    const x = ticksLeft + i * (trackWidth + gap);
    const done = i < index;
    const base = box({
      x,
      y: RAIL_Y - 14,
      width: trackWidth,
      height: 6,
      r: 3,
      fill: done ? accent : muted,
      opacity: done ? 0.55 : 0.25,
    });
    if (i !== index) return base;
    // The live tick fills across its own six seconds: the only element on
    // screen that says how much of the video is left.
    const fill = box({
      x,
      y: RAIL_Y - 14,
      width: trackWidth * clamp(t / SCENE_SECONDS),
      height: 6,
      r: 3,
      fill: accent,
    });
    return base + fill;
  }).join("");

  // No wordmark is drawn. A letter-spaced sans is not the Ursly mark, and the
  // real one is already on screen: inside the app stills, and at the close.
  return (
    text({
      x: MARGIN,
      y: RAIL_Y,
      value: words.rail,
      size: 18,
      fill: muted,
      weight: "700",
      spacing: "3",
    }) + ticks
  );
}

/** The headline and lede of a scene, arriving line by line. */
function words(scene, t, start = 0.1) {
  const headline = scene.headline
    .map((line, i) =>
      arriving(
        entered(t, start + i * ENTER_STAGGER),
        text({
          x: MARGIN,
          y: scene.headlineTop + i * HEADLINE_LEADING,
          value: line,
          size: HEADLINE_SIZE,
          font: SERIF,
        }),
      ),
    )
    .join("");
  const after = start + scene.headline.length * ENTER_STAGGER;
  const lede = scene.lede
    .map((line, i) =>
      arriving(
        entered(t, after + i * ENTER_STAGGER),
        text({
          x: MARGIN,
          y: scene.ledeTop + i * LEDE_LEADING,
          value: line,
          size: LEDE_SIZE,
          fill: muted,
        }),
      ),
    )
    .join("");
  return headline + lede;
}

// Where each committed still sits in the frame, and how big it is drawn. The
// renderer rounds the corners of the PNG to match, so the product appears to
// be inside the device rather than pasted over it.
const DESKTOP_STILL = { x: 940, y: 322, width: 880, height: 550, r: 10 };
const PHONE_STILL = { x: 1400, y: 128, width: 340, height: 736, r: 32 };

/**
 * Scene one: the claim. A browser window holding the real product, because
 * "the next generation of internet" is a large thing to say and the answer to
 * it should be something you could click on today.
 */
function claim(scene, t) {
  const arrival = entered(t, 0.5);
  const card = { x: DESKTOP_STILL.x - 20, y: DESKTOP_STILL.y - 62 };
  const chrome =
    box({
      x: card.x - 6,
      y: card.y - 6,
      width: DESKTOP_STILL.width + 52,
      height: DESKTOP_STILL.height + 126,
      r: 30,
      fill: hairline,
    }) +
    box({
      x: card.x,
      y: card.y,
      width: DESKTOP_STILL.width + 40,
      height: DESKTOP_STILL.height + 114,
      r: 26,
      fill: screen,
    }) +
    // Rounded rectangles rather than circles: ImageMagick's SVG renderer does
    // not apply a group's opacity to a <circle>, so a circle inside an
    // entrance would sit there at full strength while the rest faded in.
    [0, 1, 2]
      .map((i) =>
        box({
          x: card.x + 27 + i * 28,
          y: card.y + 25,
          width: 14,
          height: 14,
          r: 7,
          fill: muted,
          opacity: 0.3,
        }),
      )
      .join("") +
    box({
      x: card.x + 140,
      y: card.y + 20,
      width: 300,
      height: 24,
      r: 12,
      fill: hairline,
      opacity: 0.8,
    });
  return {
    body: words(scene, t) + arriving(arrival, chrome),
    still: {
      name: "desktop",
      ...DESKTOP_STILL,
      y: DESKTOP_STILL.y + (1 - arrival) * RISE,
      opacity: arrival,
    },
  };
}

/**
 * Scene two: voice, and the phone that hears it. The bars are the brand mark's
 * own wave, moving -- the one element in the video that is alive rather than
 * arriving, because a voice is a thing that is happening.
 */
function voice(scene, t) {
  const arrival = entered(t, 0.5);
  const bars = 9;
  const wave = Array.from({ length: bars }, (_, i) => {
    const swing = Math.abs(Math.sin(t * 2.4 + i * 0.7));
    // The whole bar grows in, floor included, so the wave is not a row of
    // waiting dots while the scene is still arriving.
    const height = (18 + swing * 74) * entered(t, 0.9);
    return box({
      x: MARGIN + i * 30,
      y: scene.featureTop + 48 - height / 2,
      width: 16,
      height,
      r: 8,
      fill: accent,
      opacity: 0.55 + swing * 0.45,
    });
  }).join("");
  const bezel =
    box({
      x: PHONE_STILL.x - 22,
      y: PHONE_STILL.y - 24,
      width: PHONE_STILL.width + 44,
      height: PHONE_STILL.height + 48,
      r: 56,
      fill: ink,
    }) +
    box({
      x: PHONE_STILL.x + PHONE_STILL.width / 2 - 46,
      y: PHONE_STILL.y - 12,
      width: 92,
      height: 8,
      r: 4,
      fill: paper,
      opacity: 0.25,
    });
  return {
    body: words(scene, t) + wave + arriving(arrival, bezel),
    still: {
      name: "phone",
      ...PHONE_STILL,
      y: PHONE_STILL.y + (1 - arrival) * RISE,
      opacity: arrival,
    },
  };
}

/**
 * Scene three: what comes after voice. A visor and a gesture, drawn rather
 * than photographed, because this one is honestly still in beta and a
 * screenshot would claim more than we can.
 */
function motion(scene, t, words_) {
  const arrival = entered(t, 0.5);
  const cx = 1430;
  const glass = { x: cx - 240, y: 344, width: 480, height: 172, r: 80 };
  // A light travelling across the visor, trailing behind itself: the headset
  // is looking around, which is the whole difference between this scene and a
  // picture of a headset.
  const sweep = (Math.sin(t * 1.15) + 1) / 2;
  const scanning = glass.x + 44 + sweep * (glass.width - 88);
  const visor =
    box({
      x: cx - 298,
      y: 392,
      width: 62,
      height: 92,
      r: 24,
      fill: ink,
      opacity: 0.45,
    }) +
    box({
      x: cx + 236,
      y: 392,
      width: 62,
      height: 92,
      r: 24,
      fill: ink,
      opacity: 0.45,
    }) +
    box({ x: cx - 270, y: 318, width: 540, height: 224, r: 92, fill: ink }) +
    box({ ...glass, fill: paper, opacity: 0.1 }) +
    // Three bars of falling height and opacity: the trail is the brand mark's
    // wave, dragged across the visor.
    [
      [0.85, 1],
      [0.4, 0.72],
      [0.18, 0.48],
    ]
      .map(([opacity, share], i) => {
        const height = (glass.height - 68) * share;
        return box({
          x: scanning - i * 38 * Math.sign(Math.cos(t * 1.15) || 1) - 11,
          y: glass.y + glass.height / 2 - height / 2,
          width: 22,
          height,
          r: 11,
          fill: accent,
          opacity,
        });
      })
      .reverse()
      .join("");
  // Rings leaving the hand a beat apart, each fading as it widens. They are
  // drawn outward-in because a ring is a disc with the background punched out
  // of it, and the punch would otherwise erase the ring inside it.
  const period = 1.8;
  const hand = { x: cx, y: 762 };
  const ripples = [0, 1, 2]
    .map((i) => {
      const phase = ((t - 0.9 - i * (period / 3)) % period) / period;
      return { phase, radius: 34 + phase * 150 };
    })
    .filter(({ phase }) => t > 0.9 && phase >= 0)
    .sort((a, b) => b.radius - a.radius)
    .map(({ phase, radius }) =>
      ring(hand.x, hand.y, radius, 7, accent, (1 - phase) * 0.7 * arrival),
    )
    .join("");
  const chipWidth = 118;
  const chip =
    box({
      x: MARGIN,
      y: scene.featureTop + 8,
      width: chipWidth,
      height: 46,
      r: 23,
      fill: accent,
    }) +
    text({
      x: MARGIN + chipWidth / 2,
      y: scene.featureTop + 39,
      value: words_.beta,
      size: 22,
      fill: paper,
      weight: "700",
      spacing: "2",
      anchor: "middle",
    });
  return {
    body:
      words(scene, t) +
      arriving(entered(t, 1.1), chip) +
      arriving(arrival, visor) +
      ripples +
      `<circle cx="${hand.x}" cy="${hand.y}" r="22" fill="${ink}" opacity="${number(arrival)}"/>`,
    still: null,
  };
}

/**
 * Scene four: the keyboard, named for what it now is. It is drawn in the muted
 * grey everything secondary is drawn in, struck through as the scene settles,
 * while voice and motion keep the accent -- so the hierarchy is visible to
 * someone who has the sound off and does not read the caption.
 */
function legacy(scene, t, words_) {
  const arrival = entered(t, 0.5);
  const keys = 11;
  const rows = 4;
  const board = { x: 1130, y: 420, width: 690, height: 300 };
  const keyWidth = 50;
  const keyHeight = 42;
  const keyGap = 10;
  const padding = (board.width - (keys * keyWidth + (keys - 1) * keyGap)) / 2;
  const keyboard =
    box({ ...board, r: 30, fill: muted, opacity: 0.1 }) +
    Array.from({ length: rows }, (_, row) =>
      row === rows - 1
        ? box({
            x: board.x + padding + 2 * (keyWidth + keyGap),
            y: board.y + 28 + row * (keyHeight + keyGap),
            width: 7 * keyWidth + 6 * keyGap,
            height: keyHeight,
            r: 10,
            fill: muted,
            opacity: 0.28,
          })
        : Array.from({ length: keys }, (_, key) =>
            box({
              x:
                board.x +
                padding +
                key * (keyWidth + keyGap) +
                (row % 2 ? keyGap : 0),
              y: board.y + 28 + row * (keyHeight + keyGap),
              width: keyWidth,
              height: keyHeight,
              r: 10,
              fill: muted,
              opacity: 0.28,
            }),
          ).join(""),
    ).join("");
  // The strike is drawn, not typeset, so it can be seen to happen.
  const strike = box({
    x: board.x + 24,
    y: board.y + board.height / 2 - 4,
    width: (board.width - 48) * entered(t, 1.8),
    height: 8,
    r: 4,
    fill: ink,
    opacity: 0.55,
  });

  const chipHeight = 52;
  const chips = [
    { label: words_.modes.voice, live: true },
    { label: words_.modes.motion, live: true },
    { label: words_.modes.keyboard, live: false },
  ];
  let x = MARGIN;
  const chipRow = [];
  for (const [i, chip] of chips.entries()) {
    const chipWidth = 44 + chip.label.length * 15;
    const body =
      box({
        x,
        y: scene.featureTop,
        width: chipWidth,
        height: chipHeight,
        r: 26,
        fill: chip.live ? accent : muted,
        opacity: chip.live ? 1 : 0.16,
      }) +
      text({
        x: x + chipWidth / 2,
        y: scene.featureTop + 34,
        value: chip.label,
        size: 24,
        fill: chip.live ? paper : muted,
        weight: "700",
        anchor: "middle",
      }) +
      (chip.live
        ? ""
        : box({
            x: x + 18,
            y: scene.featureTop + chipHeight / 2 - 2,
            width: (chipWidth - 36) * entered(t, 2.2),
            height: 4,
            r: 2,
            fill: muted,
          }));
    chipRow.push(arriving(entered(t, 1.1 + i * ENTER_STAGGER), body));
    x += chipWidth + 18;
  }

  return {
    body:
      words(scene, t) +
      chipRow.join("") +
      arriving(arrival, keyboard) +
      strike +
      arriving(
        entered(t, 2.6),
        text({
          x: WIDTH - MARGIN,
          y: 116,
          value: words_.site,
          size: 30,
          fill: accent,
          weight: "700",
          anchor: "end",
        }),
      ),
    still: null,
  };
}

const painters = [claim, voice, motion, legacy];

function frame(index, scene, t, words_) {
  const painted = painters[index](scene, t, words_);
  return {
    // The furniture goes on last: the wordmark, the rail and the ticks are the
    // one thing that must never be covered by whatever a scene is drawing.
    svg:
      `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">` +
      box({ x: 0, y: 0, width: WIDTH, height: HEIGHT, fill: paper }) +
      painted.body +
      furniture(words_, index, t) +
      `</svg>`,
    still: painted.still,
  };
}

/**
 * Resizes a screenshot to the size it is drawn at and rounds its corners, once
 * per language, so the per-frame composite is a single cheap operation.
 */
async function prepareStill(source, { width: w, height: h, r }, destination) {
  const mask = `${destination}.mask.png`;
  await run("magick", [
    "-size",
    `${w}x${h}`,
    "xc:black",
    "-fill",
    "white",
    "-draw",
    `roundrectangle 0,0,${w - 1},${h - 1},${r},${r}`,
    mask,
  ]);
  await run("magick", [
    source,
    "-resize",
    `${w}x${h}^`,
    "-gravity",
    "north",
    "-extent",
    `${w}x${h}`,
    mask,
    "-alpha",
    "off",
    "-compose",
    "CopyOpacity",
    "-composite",
    destination,
  ]);
}

/** Runs `worker` over `items`, a few at a time, because each one is a process. */
async function inParallel(items, worker, limit = Math.max(2, cpus().length)) {
  const queue = items.slice();
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      let next;
      while ((next = queue.shift()) !== undefined) await worker(next);
    }),
  );
}

const timestamp = (seconds) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}.000`;

/**
 * The captions, from the same table the frames are drawn from. They used to be
 * written by hand next to the video, which is one copy of the script too many.
 */
const captions = (words_) =>
  `WEBVTT\n\n${words_.scenes
    .map(
      (scene, i) =>
        `${timestamp(i * SCENE_SECONDS)} --> ${timestamp((i + 1) * SCENE_SECONDS)}\n` +
        `${scene.headline} ${scene.lede}\n`,
    )
    .join("\n")}`;

async function main() {
  const work = mkdtempSync(join(tmpdir(), "ursly-intro-"));
  for (const directory of [WEB, MOBILE])
    mkdirSync(directory, { recursive: true });

  // Each clip carries half a cross-fade past its own six seconds at every edge
  // it shares with a neighbour, which is what makes the four clips add up to
  // exactly twenty-four seconds once ffmpeg has overlapped them.
  const clips = Array.from({ length: SCENES }, (_, i) => {
    const lead = i === 0 ? 0 : CROSSFADE_SECONDS / 2;
    const tail = i === SCENES - 1 ? 0 : CROSSFADE_SECONDS / 2;
    const frames = Math.round((SCENE_SECONDS + lead + tail) * RENDER_FPS);
    return { index: i, lead, frames, seconds: frames / RENDER_FPS };
  });

  for (const [language, words_] of Object.entries(copy)) {
    const scenes = await layout(language);
    const stills = {
      desktop: join(work, `still-desktop.${language}.png`),
      phone: join(work, `still-phone.${language}.png`),
    };
    await prepareStill(
      join(STILLS, `app-desktop.${language}.png`),
      DESKTOP_STILL,
      stills.desktop,
    );
    await prepareStill(
      join(STILLS, `app-phone.${language}.png`),
      PHONE_STILL,
      stills.phone,
    );

    const jobs = [];
    for (const clip of clips) {
      const directory = join(work, `${language}-scene${clip.index}`);
      mkdirSync(directory, { recursive: true });
      for (let i = 0; i < clip.frames; i += 1) {
        // Time is measured from the moment the caption for this scene starts,
        // which is a little after the clip does for every scene but the first.
        jobs.push({ clip, directory, i, t: i / RENDER_FPS - clip.lead });
      }
    }

    await inParallel(jobs, async ({ clip, directory, i, t }) => {
      const drawn = frame(clip.index, scenes[clip.index], t, words_);
      const svg = join(directory, `frame-${String(i).padStart(5, "0")}.svg`);
      const png = join(directory, `frame-${String(i).padStart(5, "0")}.png`);
      writeFileSync(svg, drawn.svg);
      const composite = drawn.still
        ? [
            "(",
            stills[drawn.still.name],
            "-alpha",
            "set",
            "-channel",
            "A",
            "-evaluate",
            "multiply",
            String(number(drawn.still.opacity)),
            "+channel",
            ")",
            "-geometry",
            `+${Math.round(drawn.still.x)}+${Math.round(drawn.still.y)}`,
            "-composite",
          ]
        : [];
      await run("magick", [svg, ...composite, png]);
    });

    const inputs = clips.flatMap((clip) => [
      "-framerate",
      String(RENDER_FPS),
      "-i",
      join(work, `${language}-scene${clip.index}`, "frame-%05d.png"),
    ]);
    // Cross-fade the clips into one take, then split the result so both codecs
    // encode the same frames in a single pass over them.
    const graph = clips.map(
      (clip) =>
        `[${clip.index}:v]fps=${OUTPUT_FPS},format=rgb24,settb=AVTB[c${clip.index}]`,
    );
    let previous = "c0";
    let offset = clips[0].seconds - CROSSFADE_SECONDS;
    for (let i = 1; i < clips.length; i += 1) {
      const out = i === clips.length - 1 ? "take" : `x${i}`;
      graph.push(
        `[${previous}][c${i}]xfade=transition=fade:duration=${CROSSFADE_SECONDS}:offset=${number(offset)}[${out}]`,
      );
      previous = out;
      offset += clips[i].seconds - CROSSFADE_SECONDS;
    }
    graph.push("[take]split=2[h264][vp9]");

    const mp4 = join(work, `ursly-intro.${language}.mp4`);
    const webm = join(work, `ursly-intro.${language}.webm`);
    await run("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      ...inputs,
      "-filter_complex",
      graph.join(";"),
      // H.264 for Safari and the phones; VP9 for the Chromium builds the
      // end-to-end tests run, which ship without an H.264 decoder.
      "-map",
      "[h264]",
      "-an",
      "-t",
      String(DURATION_SECONDS),
      "-r",
      String(OUTPUT_FPS),
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "21",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      mp4,
      "-map",
      "[vp9]",
      "-an",
      "-t",
      String(DURATION_SECONDS),
      "-r",
      String(OUTPUT_FPS),
      "-c:v",
      "libvpx-vp9",
      "-b:v",
      "0",
      "-crf",
      "32",
      "-row-mt",
      "1",
      "-pix_fmt",
      "yuv420p",
      webm,
    ]);

    copyFileSync(mp4, join(WEB, `ursly-intro.${language}.mp4`));
    copyFileSync(webm, join(WEB, `ursly-intro.${language}.webm`));
    copyFileSync(mp4, join(MOBILE, `ursly-intro.${language}.mp4`));
    writeFileSync(join(WEB, `ursly-intro.${language}.vtt`), captions(words_));
    console.log(
      `rendered ${language}: ${DURATION_SECONDS}s, ${WIDTH}x${HEIGHT}`,
    );
  }
}

await main();
