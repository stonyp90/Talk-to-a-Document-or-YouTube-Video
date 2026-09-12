// Draws the thirty-six second introduction, in both languages, from nothing
// but this repository:
//
//   node scripts/brand/intro-video.mjs
//
// It used to need a screen recording that was never committed, which meant the
// video could not be rebuilt by anyone who did not already have that file, and
// could not be rebuilt in CI at all. Every frame is now drawn here as SVG and
// rasterised with ImageMagick (`magick`), with the running app composited in
// where the argument is about the product rather than about the idea. ffmpeg
// assembles the frames and cross-fades the six scenes into one continuous
// take.
//
// What goes on the screen is a recording of the application actually being
// driven -- scripts/brand/footage, one continuous take per surface per
// language: the workspace, a PDF going in, the real extraction, a voice
// session opening and listening, a question, and the answer coming back from
// that source. A screenshot of a product is a claim about it; the product
// moving is the thing itself. The committed screenshots under
// scripts/brand/stills remain the fallback, and the render says so on the way
// past when a recording is missing.
//
// The frame is one composition rather than six cards: paper on the left holds
// the type, a softly tinted field on the right holds the product, and the
// product runs off the right edge and off the bottom of the frame. A screen
// that continues past the edge is a place you are sitting in front of; a card
// centred in white space is a slide, and the earlier cut of this video read as
// a deck of them. Three things never restart and never dissolve -- the field,
// the wave along the top of the type, and the slow push on the product -- so
// the cross-fades carry the frame through instead of resetting it.
//
// The argument the film makes is not invented here. It lives in
// apps/web/app/content/intro-video.ts, which the dialog, the landing page and
// the transcript all read. This is a build script and cannot import the app's
// TypeScript, so the words are repeated in scripts/brand/intro-copy.mjs, and
// tests/brand/intro-copy.test.ts fails the suite the moment the two disagree
// -- against the content file for English and against the interface dictionary
// for French. It is also why this script writes the .vtt captions rather than
// leaving them hand-maintained beside the video, free to drift.
//
// Outputs, unchanged in name and shape from the previous renderer plus the
// captions: apps/web/public/brand/ursly-intro.<lang>.{mp4,webm,vtt} and
// apps/mobile/assets/ursly-intro.<lang>.mp4. Requires ImageMagick and an
// ffmpeg built with libx264 and libvpx on PATH.
import { execFile } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir, cpus } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { introCopy } from "./intro-copy.mjs";

const run = promisify(execFile);

const WIDTH = 1920;
const HEIGHT = 1080;

// Six seconds a scene, for as many scenes as the argument takes. The count is
// read off the copy rather than typed, the same way INTRO_SCENE_SECONDS and
// INTRO_DURATION_SECONDS work on the page, so the captions, the ticks, the
// schema.org duration and the frames cannot disagree about how long the film
// is or how many parts it has.
const SCENE_SECONDS = 6;
const SCENES = introCopy.en.scenes.length;
const DURATION_SECONDS = SCENE_SECONDS * SCENES;

// One frame drawn is one frame delivered, at the rate the footage was
// recorded at. Sampling live footage at one rate and playing it back at
// another is the judder you cannot stop seeing once you have seen it.
const FOOTAGE_FPS = 25;
const RENDER_FPS = FOOTAGE_FPS;
const OUTPUT_FPS = FOOTAGE_FPS;

// The video autoplays on the landing page, so how heavy it is allowed to be is
// a product decision rather than an encoder default. Footage under a constant
// push leaves the encoder very little to reuse between frames, so these are
// set at the point where the app's own type is still sharp and the file is
// still something a phone will fetch without complaint.
const H264_CRF = 29;
const VP9_CRF = 38;

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

/**
 * Blends two palette colours. Everything in this film that is neither paper
 * nor ink is a measured step between the two rather than a new colour picked
 * by eye, so the tints stay inside the brand when the brand moves.
 */
const mix = (from, to, amount) => {
  const channel = (offset) => {
    const a = parseInt(from.slice(offset, offset + 2), 16);
    const b = parseInt(to.slice(offset, offset + 2), 16);
    return Math.round(a + (b - a) * amount)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(1)}${channel(3)}${channel(5)}`;
};

// ImageMagick's own SVG renderer resolves these family names through
// fontconfig. Arial rather than Helvetica for the sans: Helvetica on this
// platform has no glyph for the arrow in the rail, and silently drops it.
const SERIF = { svg: "Georgia, serif", magick: "Georgia" };
const SANS = { svg: "Arial, Helvetica, sans-serif", magick: "Arial" };

// The type column on the left, and the field the product lives in on the
// right. The gutter between them is wide enough that nothing has to be trusted
// not to grow into it: no drawn element and no measured line ever crosses
// MARGIN + COLUMN, and nothing in the field ever begins before FIELD_X.
const MARGIN = 96;
const COLUMN = 840;
const FIELD_X = 1016;
const FIELD_TINT = 0.05;
const field = mix(paper, ink, FIELD_TINT);

// The headline is set to the column rather than to a fixed size. A short line
// and a long translation given the same size leave the column half used and
// the scene looking underfilled, which is most of what made the earlier cut
// read as a slide; measuring for the fit lets the shortest headline be as
// large as the column can carry while the longest still gets its two lines.
const HEADLINE_MAX = 100;
const HEADLINE_MIN = 74;
const HEADLINE_STEP = 2;
const HEADLINE_LINES = 2;
const HEADLINE_LEADING_RATIO = 1.22;
// Georgia's capitals reach about this far above the baseline. Balancing a
// block of type needs its visual top, not its first baseline.
const HEADLINE_CAP_RATIO = 0.73;
const LEDE_SIZE = 34;
const LEDE_LEADING = 48;
// Measured from the headline's last baseline, so it has to grow with the
// headline: a fixed gap that breathes under seventy-four point type has the
// lede sitting in the descenders at a hundred.
const LEDE_GAP_RATIO = 1.02;
const FEATURE_GAP = 96;
const FEATURE_HEIGHT = 56;

// The type hangs from the top of its band, just under the wave, rather than
// from a fixed baseline low in the frame. A fixed baseline was what left the
// headline looking like text that had fallen to the bottom of an empty page,
// with the void the removed wordmark left sitting directly in front of it.
// What air a short scene has left over now collects at the bottom, where the
// rail and the ticks close the column off.
const TYPE_BAND_TOP = 336;
const TYPE_BAND_BOTTOM = 880;
const TYPE_BALANCE = 0.12;

// Which scenes hang a badge under their lede: the beta mark under motion, the
// three mode pills under the keyboard. Named by scene rather than numbered by
// position, so inserting a scene ahead of them cannot quietly move a badge
// onto the wrong one. The scenes that carry no badge end at the lede, and the
// balance below knows it, so none is left holding a gap where one would have
// gone.
const FEATURE_SCENES = new Set(["motion", "keyboard"]);

const RAIL_Y = 962;
const RAIL_SIZE = 18;
// ImageMagick's SVG renderer spends letter-spacing far more generously than a
// browser does -- three units here is nearly fourteen pixels a glyph -- so the
// rail is tracked at two to stay inside the column it now belongs to.
const RAIL_SPACING = "2";
const TICK_Y = 908;
const TICK_WIDTH = 52;
const TICK_GAP = 16;
const SITE_SIZE = 28;
const SITE_Y = 924;

// The wave that used to belong to scene two alone. It now runs along the top
// of the type column in every scene, off the left edge of the frame, and
// it is the answer to the dead band the removed wordmark left behind: a mark
// would have been a static label, and this is the product's own voice, moving.
// Its shape is a function of elapsed time rather than scene time, so the two
// clips overlapping inside a cross-fade draw it identically and it appears to
// carry straight through the cut.
const WAVE_Y = 214;
const WAVE_BARS = 26;
const WAVE_PITCH = 34;
const WAVE_BAR = 15;
const WAVE_LEFT = -22;
const WAVE_FLOOR = 12;
const WAVE_SWING = 168;
const WAVE_SPEED = 2.4;
// The right end dissolves into the paper over this distance instead of being
// cut off, so the sound reads as arriving from off frame rather than as a
// graphic that happens to stop.
const WAVE_FADE = 340;
// Loud where the argument is about voice, quiet where it is about the keyboard
// that voice replaces. The gain is interpolated across the whole film, not
// switched at a boundary, so a cross-fade never shows two waves at once.
const WAVE_GAINS = [0.45, 0.6, 1, 0.66, 0.3, 0.5];
const WAVE_RIGHT = WAVE_LEFT + (WAVE_BARS - 1) * WAVE_PITCH + WAVE_BAR;

// The stage the product occupies. It overhangs the right edge of the frame and
// the bottom of it, which is the whole difference between a screen and a card.
const STAGE = { x: 1076, y: 96, width: 1000, height: 1060, r: 26 };
const STAGE_CHROME = 62;
const STAGE_PAD = 14;

// One slow push across the entire film rather than a move per scene. Driven by
// elapsed time, it neither restarts at a boundary nor cross-fades against
// itself, and at roughly three percent over any six seconds it is under the
// threshold at which motion starts competing with reading.
const PUSH = 0.13;
const MAX_PUSH = 1 + PUSH;

// The picture inside the stage. It is nearly square while the recording is
// three to two, so the app is drawn large and cropped at its right -- the side
// that runs off the frame -- rather than shrunk until the whole window fits
// and none of it is legible. The crop keeps the app's own left edge, where its
// real mark sits. Corners are square: the picture sits inside a white device
// body that is rounded itself, and rounding it twice only softens the one
// corner of it the frame ever shows.
const PICTURE = {
  x: STAGE.x + STAGE_PAD,
  y: STAGE.y + STAGE_CHROME,
  width: STAGE.width - STAGE_PAD * 2,
  height: STAGE.height - STAGE_CHROME - STAGE_PAD,
  gravity: "northwest",
};

// The phone stands on the near side of that screen and runs off the bottom of
// the frame, the way a phone propped against a monitor does. Its dark body is
// a separate image with a hole in it, laid over the screen: the screens are
// composited on top of the finished SVG, so a bezel drawn into the SVG would
// end up underneath the very thing it is meant to be holding.
const PHONE = { x: 1068, y: 402, width: 484, height: 996, r: 52 };
const PHONE_BEZEL = 22;
const PHONE_WINDOW_R = 30;
const PHONE_SCREEN = {
  x: PHONE.x + PHONE_BEZEL,
  y: PHONE.y + PHONE_BEZEL,
  width: PHONE.width - PHONE_BEZEL * 2,
  height: PHONE.height - PHONE_BEZEL * 2,
  gravity: "north",
};

// The headset. Two tabs beside a dark rectangle read as a lozenge with nubs,
// which is what the first cut of this scene was; a band that passes behind the
// body and carries on out both sides reads as something worn on a head, and
// the bridge cut out of the bottom edge is the one silhouette detail that says
// which way up the object goes.
const VISOR = { cx: 1480, cy: 366, width: 640, height: 288, r: 116 };
const VISOR_GLASS = { width: 544, height: 188, r: 84 };
const VISOR_STRAP = { height: 92, r: 42, reach: 118 };
const VISOR_NOSE = { width: 166, height: 42, r: 16 };
const VISOR_SWEEP = 1.15;
const VISOR_TRAIL = { bars: 3, width: 30, pitch: 46 };
const VISOR_TRAIL_CLEAR =
  (VISOR_TRAIL.bars - 1) * VISOR_TRAIL.pitch + VISOR_TRAIL.width;
// The glass has to be lighter than the body it is set into, and the strap
// lighter again, or the whole thing collapses into one dark shape.
const lens = mix(ink, paper, 0.2);
const strap = mix(ink, paper, 0.44);
const HAND = { x: 1480, y: 830, radius: 28 };
const RIPPLE_PERIOD = 1.8;
// Wide enough that the outermost ring leaves the bottom of the frame, and that
// the innermost one reaches back up to where the visor ends: the gesture and
// the headset are one piece of the argument, not two drawings.
const RIPPLE_REACH = 288;

// The volume the gesture happens in. The other three scenes are full of
// product; this one cannot be, so the field carries a grid of tracking points
// instead of flat tint, and each point answers as a ring passes through it.
// It claims nothing the beta cannot support, and it gives the scene the same
// density as the screens on either side of it.
const TRACK = {
  left: 1044,
  top: 52,
  pitch: 62,
  columns: 15,
  rows: 17,
  // Crosses rather than dots: a grid of dots is wallpaper, and a grid of
  // registration marks is a volume something is being measured in.
  arm: 14,
  weight: 3,
  band: 54,
  fade: 860,
  base: 0.3,
  lift: 0.8,
};

// The loop, drawn as a loop. Ten stages is what the landing page walks a
// reader through, and this scene's whole argument is that the number is not
// decoration: every one of them is walked before anything ships. The ring is
// built from rounded rectangles rather than an arc, because ImageMagick's SVG
// renderer ignores stroke widths, and from rectangles rather than circles,
// because it also refuses to apply a group's opacity to a <circle> -- which
// would leave the ring at full strength inside its own entrance.
const LOOP = { cx: 1498, cy: 546, radius: 268 };
// Ten stages, starting at the top and running clockwise, the order the loop is
// walked in.
const LOOP_FIRST_ANGLE = -90;
const LOOP_NODE = 26;
// The track the stages sit on, as a dotted circle that the sweep lights up
// behind itself. A dotted arc is an arc this renderer can actually draw.
const LOOP_TRACK_DOTS = 96;
const LOOP_TRACK_DOT = 8;
const LOOP_LABEL_GAP = 34;
const LOOP_LABEL_SIZE = 21;
const LOOP_CENTRE_SIZE = 42;
const LOOP_CENTRE_LEADING = 54;
// One revolution, started late enough that the ring is established before
// anything travels around it and ended early enough that the closed loop, with
// all ten stages named, is held still for the best part of a second.
const LOOP_START = 0.7;
const LOOP_TRAVEL = 4.4;
// How far behind the head a stage keeps its highlight, as a fraction of the
// whole revolution: long enough to read as a comet, short enough that the ring
// is not simply all lit at once.
const LOOP_TAIL = 0.16;

// The keyboard is an object standing in front of the product, not a diagram
// beside it: it sits over the screen and runs off two edges of the frame.
const KEYBOARD = { x: 1104, y: 600, width: 1010, height: 560, r: 36 };
const KEY_COLUMNS = 11;
const KEY_ROWS = 4;
const KEY_WIDTH = 70;
const KEY_HEIGHT = 76;
const KEY_GAP = 14;
const KEY_TOP = 46;
const slab = mix(paper, ink, 0.18);

// How an element arrives: a third of a second of travel, from a little below.
const ENTER_SECONDS = 0.7;
const ENTER_STAGGER = 0.14;
const RISE = 26;

const STILLS = "scripts/brand/stills";
const FOOTAGE = "scripts/brand/footage";

// Where in the recorded take each scene picks the film up. The recording is
// one continuous journey through the product, and the film is six arguments,
// so each scene is cut from the stretch of the journey that argues what it is
// arguing rather than every scene restarting the recording from zero: the
// workspace at rest for the claim, the PDF going in and the extraction
// arriving for the source, the question being typed and the answer coming back
// for the voice, and the answer at rest behind the keyboard. A null is a scene
// that does not show that surface at all -- motion and the loop are drawn
// rather than recorded, because neither is something the product does on a
// screen today.
//
// The numbers are offsets in seconds into scripts/brand/footage, and they are
// the one thing in this script that has to be checked against the recording by
// eye whenever scripts/brand/record-app.mjs runs again.
const SURFACES = {
  desktop: {
    clip: "app-desktop",
    spec: PICTURE,
    // Rest, the source going in, the voice session answering, and the answer
    // still standing behind the keyboard.
    cues: [0.3, 6.3, 16.2, null, 22.0, null],
  },
  phone: {
    clip: "app-phone",
    spec: PHONE_SCREEN,
    // The phone is the only surface that shows the whole exchange at once, so
    // it is cut to the six seconds that contain the payoff: the last of the
    // question being typed, the send, the answer arriving, and the answer held
    // long enough to be recognised as one.
    cues: [null, null, 21.0, null, null, null],
  },
};
const WEB = "apps/web/public/brand";
const MOBILE = "apps/mobile/assets";

const number = (value) => Math.round(value * 100) / 100;
// Math.round hands back a negative zero, which prints without its sign.
const round = (value) => Math.round(value) || 0;
const clamp = (value) => Math.min(1, Math.max(0, value));
// Decelerating: things arrive quickly and settle, rather than sliding at a
// constant speed, which always reads as a slideshow.
const ease = (progress) => 1 - (1 - progress) ** 3;
// Eased at both ends, for values that are travelling between two rests rather
// than arriving at one.
const smooth = (progress) => progress * progress * (3 - 2 * progress);

/** How far into its entrance an element is, `after` seconds into the scene. */
const entered = (t, after) => ease(clamp((t - after) / ENTER_SECONDS));

/** The push, as a scale, at `elapsed` seconds into the finished film. */
const pushed = (elapsed) => 1 + PUSH * clamp(elapsed / DURATION_SECONDS);

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

/**
 * Wraps `body` in the push. Everything in the field grows from the stage's top
 * left corner, so the corner nearest the type never moves and the growth is
 * spent entirely on the two edges the frame is already cutting.
 */
const staged = (scale, body) =>
  `<g transform="translate(${number(STAGE.x)},${number(STAGE.y)}) scale(${number(scale)}) translate(${number(-STAGE.x)},${number(-STAGE.y)})">${body}</g>`;

/** The same transform, arithmetically, for a still the SVG cannot carry. */
const inStage = (rect, scale, lift = 0) => ({
  x: STAGE.x + (rect.x - STAGE.x) * scale,
  y: STAGE.y + (rect.y - STAGE.y) * scale + lift,
  width: rect.width * scale,
  height: rect.height * scale,
});

// ImageMagick's SVG renderer ignores stroke widths on <line>, so every rule
// and outline in these scenes is a filled rectangle. A ring is drawn the same
// way a ring is cut: a disc, with a smaller disc of whatever lies behind it
// punched out of the middle, which only works over flat ground -- so nothing
// rippling passes behind anything else, and the colour of that ground has to
// be handed in, because the rings now ripple over the field and not the paper.
const ring = (cx, cy, radius, thickness, fill, opacity, ground) =>
  `<circle cx="${number(cx)}" cy="${number(cy)}" r="${number(radius)}" fill="${fill}" opacity="${number(opacity)}"/>` +
  // Opaque, whatever the ring's own opacity: a translucent punch would leave
  // the disc it is cutting out of faintly filled in.
  `<circle cx="${number(cx)}" cy="${number(cy)}" r="${number(Math.max(0, radius - thickness))}" fill="${ground}"/>`;

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
  for (const scene of introCopy[language].scenes) {
    const { size, headline } = await fitted(scene.headline);
    const leading = Math.round(size * HEADLINE_LEADING_RATIO);
    const cap = Math.round(size * HEADLINE_CAP_RATIO);
    const lede = await wrap(scene.lede, SANS, LEDE_SIZE, COLUMN);
    const feature = FEATURE_SCENES.has(scene.id);
    // The block's own height, from the top of the capitals to the bottom of
    // whatever it ends on, so a translation that wraps one line longer is
    // placed knowing it rather than pushed down into the rail.
    const ledeGap = Math.round(size * LEDE_GAP_RATIO);
    const height =
      cap +
      (headline.length - 1) * leading +
      ledeGap +
      (lede.length - 1) * LEDE_LEADING +
      (feature ? FEATURE_GAP + FEATURE_HEIGHT : 0);
    const headlineTop =
      TYPE_BAND_TOP +
      (TYPE_BAND_BOTTOM - TYPE_BAND_TOP - height) * TYPE_BALANCE +
      cap;
    const ledeTop = headlineTop + (headline.length - 1) * leading + ledeGap;
    scenes.push({
      id: scene.id,
      headline,
      size,
      leading,
      lede,
      headlineTop,
      ledeTop,
      featureTop: ledeTop + (lede.length - 1) * LEDE_LEADING + FEATURE_GAP,
    });
  }
  return scenes;
}

/**
 * The largest size at which a headline still falls inside the column, in no
 * more than two lines, without ending on its longest one. The last condition
 * costs a few points of size on the longest translation and buys back the
 * widening rag that betrays type which was fitted rather than set.
 */
async function fitted(value) {
  for (let size = HEADLINE_MAX; size > HEADLINE_MIN; size -= HEADLINE_STEP) {
    const headline = await wrap(value, SERIF, size, COLUMN);
    if (headline.length > HEADLINE_LINES) continue;
    if (headline.length === 1) return { size, headline };
    const lines = await Promise.all(
      headline.map((line) => width(line, SERIF, size)),
    );
    if (lines.at(-1) < Math.max(...lines)) return { size, headline };
  }
  return {
    size: HEADLINE_MIN,
    headline: await wrap(value, SERIF, HEADLINE_MIN, COLUMN),
  };
}

/** The wave's loudness at `elapsed` seconds, eased between the scene gains. */
function gain(elapsed) {
  const position = elapsed / SCENE_SECONDS - 0.5;
  const lower = Math.min(SCENES - 1, Math.max(0, Math.floor(position)));
  const upper = Math.min(SCENES - 1, lower + 1);
  return (
    WAVE_GAINS[lower] +
    (WAVE_GAINS[upper] - WAVE_GAINS[lower]) * smooth(clamp(position - lower))
  );
}

/** The voice, along the top of the type column, for the whole film. */
function wave(elapsed) {
  const loudness = gain(elapsed);
  return Array.from({ length: WAVE_BARS }, (_, i) => {
    const x = WAVE_LEFT + i * WAVE_PITCH;
    const reach = clamp((WAVE_RIGHT - x) / WAVE_FADE);
    const swing = Math.abs(Math.sin(elapsed * WAVE_SPEED + i * 0.7));
    const height = (WAVE_FLOOR + swing * WAVE_SWING) * loudness * reach;
    if (height < 1) return "";
    return box({
      x,
      y: WAVE_Y - height / 2,
      width: WAVE_BAR,
      height,
      r: WAVE_BAR / 2,
      fill: accent,
      opacity: (0.34 + swing * 0.46) * (0.5 + 0.5 * loudness),
    });
  }).join("");
}

/** The wave, the rail and one tick per scene: on screen for the whole film. */
function furniture(words_, index, t, elapsed) {
  const ticks = Array.from({ length: SCENES }, (_, i) => {
    const x = MARGIN + i * (TICK_WIDTH + TICK_GAP);
    const done = i < index;
    const base = box({
      x,
      y: TICK_Y,
      width: TICK_WIDTH,
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
      y: TICK_Y,
      width: TICK_WIDTH * clamp(t / SCENE_SECONDS),
      height: 6,
      r: 3,
      fill: accent,
    });
    return base + fill;
  }).join("");

  // No wordmark is drawn. A letter-spaced sans is not the Ursly mark, and the
  // real one is already on screen: inside the app stills, and at the close.
  return (
    wave(elapsed) +
    ticks +
    text({
      x: MARGIN,
      y: RAIL_Y,
      value: words_.rail,
      size: RAIL_SIZE,
      fill: muted,
      weight: "700",
      spacing: RAIL_SPACING,
    })
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
          y: scene.headlineTop + i * scene.leading,
          value: line,
          size: scene.size,
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

/**
 * The screen the product is shown on, which four of the six scenes share. It
 * is drawn from elapsed time alone and carries no entrance of its own after
 * the first scene, so the cut from the claim to the voice leaves it exactly
 * where it was: the same screen, still being pushed into, with a phone now
 * standing in front of it.
 */
function device(scale) {
  const lights = [0, 1, 2]
    .map((i) =>
      // Rounded rectangles rather than circles: ImageMagick's SVG renderer
      // does not apply a group's opacity to a <circle>, so a circle inside an
      // entrance would sit there at full strength while the rest faded in.
      box({
        x: STAGE.x + 30 + i * 30,
        y: STAGE.y + 24,
        width: 14,
        height: 14,
        r: 7,
        fill: muted,
        opacity: 0.3,
      }),
    )
    .join("");
  return staged(
    scale,
    box({
      x: STAGE.x - 5,
      y: STAGE.y - 5,
      width: STAGE.width + 10,
      height: STAGE.height + 10,
      r: STAGE.r + 5,
      fill: hairline,
    }) +
      box({ ...STAGE, fill: screen }) +
      lights +
      box({
        x: STAGE.x + 152,
        y: STAGE.y + 19,
        width: 380,
        height: 24,
        r: 12,
        fill: hairline,
        opacity: 0.8,
      }),
  );
}

/**
 * Scene one: the claim. The real product, at close to the size it is really
 * used at, running off two edges of the frame -- because "the next generation
 * of internet" is a large thing to say and the answer to it should be
 * something you could sit down in front of today.
 */
function claim(scene, t, words_, elapsed) {
  const scale = pushed(elapsed);
  const arrival = entered(t, 0.35);
  return {
    back: arriving(arrival, device(scale)) + words(scene, t),
    screens: [
      {
        surface: "desktop",
        rect: inStage(PICTURE, scale, (1 - arrival) * RISE),
        opacity: arrival,
      },
    ],
  };
}

/**
 * Scene two: the source going in. Deliberately the same frame as scene one --
 * the same screen, in the same place, under the same push, with no entrance of
 * its own -- because the argument here is not a new idea but the product
 * continuing to work. The recording is cut to the stretch where the PDF is
 * chosen and the real extraction comes back, so what proves the sentence is
 * the application doing it, not a drawing of the application doing it.
 */
function ingest(scene, t, words_, elapsed) {
  const scale = pushed(elapsed);
  return {
    back: device(scale) + words(scene, t),
    screens: [
      { surface: "desktop", rect: inStage(PICTURE, scale), opacity: 1 },
    ],
  };
}

/**
 * Scene three: voice, and the phone that hears it. The screen from the two
 * scenes before is still there and still moving; the wave along the top of the
 * column, which has been idling since the first frame, swells to full here.
 * The voice is a thing that is happening, and it is the through-line of the
 * whole film.
 */
function voice(scene, t, words_, elapsed) {
  const scale = pushed(elapsed);
  const arrival = entered(t, 0.4);
  const lift = (1 - arrival) * RISE * 2;
  return {
    back: device(scale) + words(scene, t),
    // The body of the phone goes on after the screen it holds, not before it.
    screens: [
      { surface: "desktop", rect: inStage(PICTURE, scale), opacity: 1 },
      {
        surface: "phone",
        rect: inStage(PHONE_SCREEN, scale, lift),
        opacity: arrival,
      },
      { surface: "bezel", rect: inStage(PHONE, scale, lift), opacity: arrival },
    ],
  };
}

/**
 * Scene four: what comes after voice. A headset and a gesture, drawn rather
 * than photographed, because this one is honestly still in beta and a
 * screenshot would claim more than we can. The field it sits in carries a
 * volume of tracking points rather than flat tint: the three scenes around it
 * are full of running product, and this one has to hold the same weight
 * without pretending to a product that is not built yet.
 */
function motion(scene, t, words_, elapsed) {
  const scale = pushed(elapsed);
  const arrival = entered(t, 0.4);
  const body = {
    x: VISOR.cx - VISOR.width / 2,
    y: VISOR.cy - VISOR.height / 2,
    width: VISOR.width,
    height: VISOR.height,
    r: VISOR.r,
  };
  const glass = {
    x: VISOR.cx - VISOR_GLASS.width / 2,
    y: VISOR.cy - VISOR_GLASS.height / 2,
    width: VISOR_GLASS.width,
    height: VISOR_GLASS.height,
    r: VISOR_GLASS.r,
  };
  // A light travelling across the visor, trailing behind itself: the headset
  // is looking around, which is the whole difference between this scene and a
  // picture of a headset. The travel stops short of the ends of the glass by
  // the length of the trail, so the light turns around inside the glass rather
  // than dragging accent bars out onto the dark body.
  const sweep = (Math.sin(t * VISOR_SWEEP) + 1) / 2;
  const scanning =
    glass.x + VISOR_TRAIL_CLEAR + sweep * (glass.width - VISOR_TRAIL_CLEAR * 2);
  const trail = [
    [0.85, 1],
    [0.4, 0.72],
    [0.18, 0.48],
  ]
    .map(([opacity, share], i) => {
      const height = (glass.height - 36) * share;
      return box({
        x:
          scanning -
          i * VISOR_TRAIL.pitch * Math.sign(Math.cos(t * VISOR_SWEEP) || 1) -
          VISOR_TRAIL.width / 2,
        y: VISOR.cy - height / 2,
        width: VISOR_TRAIL.width,
        height,
        r: VISOR_TRAIL.width / 2,
        fill: accent,
        opacity,
      });
    })
    .reverse()
    .join("");
  const visor =
    box({
      x: body.x - VISOR_STRAP.reach,
      y: VISOR.cy - VISOR_STRAP.height / 2,
      width: body.width + VISOR_STRAP.reach * 2,
      height: VISOR_STRAP.height,
      r: VISOR_STRAP.r,
      fill: strap,
    }) +
    box({ ...body, fill: ink }) +
    // Cut out of the bottom edge rather than drawn on it: the notch is the
    // ground showing through, which is why it is filled with the field. It
    // stops exactly on that edge rather than hanging past it -- ImageMagick's
    // renderer ignores a clip-path inside a transformed group, so anything
    // below the chin would wipe a field-coloured tab through the tracking
    // marks instead of being trimmed away.
    box({
      x: VISOR.cx - VISOR_NOSE.width / 2,
      y: body.y + body.height - VISOR_NOSE.height,
      width: VISOR_NOSE.width,
      height: VISOR_NOSE.height,
      r: VISOR_NOSE.r,
      fill: field,
    }) +
    box({ ...glass, fill: lens }) +
    trail;
  // Rings leaving the hand a beat apart, each fading as it widens.
  const rings = [0, 1, 2]
    .map((i) => {
      const phase =
        ((t - 0.9 - i * (RIPPLE_PERIOD / 3)) % RIPPLE_PERIOD) / RIPPLE_PERIOD;
      return { phase, radius: 40 + phase * RIPPLE_REACH };
    })
    .filter(({ phase }) => t > 0.9 && phase >= 0);
  // Drawn outward-in because a ring is a disc with the ground punched out of
  // it, and the punch would otherwise erase the ring inside it -- and drawn
  // before the tracking points, which the same punch would otherwise erase too.
  const ripples = rings
    .slice()
    .sort((a, b) => b.radius - a.radius)
    .map(({ phase, radius }) =>
      ring(
        HAND.x,
        HAND.y,
        radius,
        8,
        accent,
        (1 - phase) * 0.7 * arrival,
        field,
      ),
    )
    .join("");
  const track = Array.from(
    { length: TRACK.rows * TRACK.columns },
    (_, index) => {
      const x = TRACK.left + (index % TRACK.columns) * TRACK.pitch;
      const y = TRACK.top + Math.floor(index / TRACK.columns) * TRACK.pitch;
      const reach = Math.hypot(x - HAND.x, y - HAND.y);
      // How close the nearest ring is to passing through this point.
      const lit =
        rings.reduce(
          (most, { radius }) =>
            Math.max(
              most,
              1 - Math.min(1, Math.abs(reach - radius) / TRACK.band),
            ),
          0,
        ) * arrival;
      const cross = (arm, fill, opacity) =>
        box({
          x: x - arm / 2,
          y: y - TRACK.weight / 2,
          width: arm,
          height: TRACK.weight,
          r: TRACK.weight / 2,
          fill,
          opacity,
        }) +
        box({
          x: x - TRACK.weight / 2,
          y: y - arm / 2,
          width: TRACK.weight,
          height: arm,
          r: TRACK.weight / 2,
          fill,
          opacity,
        });
      // The grid is brightest around the hand and thins out towards the edges
      // of the field, so it reads as a volume with a centre rather than as a
      // pattern laid over one.
      const near = clamp(1 - reach / TRACK.fade);
      return (
        cross(TRACK.arm, muted, TRACK.base * (0.4 + 0.6 * near)) +
        (lit > 0.01
          ? cross(TRACK.arm * (1 + 0.5 * lit), accent, lit * TRACK.lift)
          : "")
      );
    },
  ).join("");
  const chipWidth = 126;
  const chip =
    box({
      x: MARGIN,
      y: scene.featureTop,
      width: chipWidth,
      height: FEATURE_HEIGHT,
      r: FEATURE_HEIGHT / 2,
      fill: accent,
    }) +
    text({
      x: MARGIN + chipWidth / 2,
      y: scene.featureTop + 37,
      value: words_.beta,
      size: 22,
      fill: paper,
      weight: "700",
      spacing: "2",
      anchor: "middle",
    });
  return {
    back:
      words(scene, t) +
      arriving(entered(t, 1.1), chip) +
      staged(
        scale,
        ripples +
          arriving(arrival, track) +
          arriving(arrival, visor) +
          `<circle cx="${HAND.x}" cy="${HAND.y}" r="${HAND.radius}" fill="${ink}" opacity="${number(arrival)}"/>`,
      ),
    screens: [],
  };
}

/**
 * Scene five: the keyboard, named for what it now is. The screen from the
 * first two scenes comes back behind it -- the product did not go anywhere --
 * and the keyboard stands in front of it in the muted grey everything
 * secondary is drawn in, struck through as the scene settles, while voice and
 * motion keep the accent. The hierarchy is visible to someone who has the
 * sound off and does not read the caption.
 */
function legacy(scene, t, words_, elapsed) {
  const scale = pushed(elapsed);
  const arrival = entered(t, 0.4);
  const padding =
    (KEYBOARD.width - (KEY_COLUMNS * KEY_WIDTH + (KEY_COLUMNS - 1) * KEY_GAP)) /
    2;
  const keys = Array.from({ length: KEY_ROWS }, (_, row) =>
    row === KEY_ROWS - 1
      ? box({
          x: KEYBOARD.x + padding + 2 * (KEY_WIDTH + KEY_GAP),
          y: KEYBOARD.y + KEY_TOP + row * (KEY_HEIGHT + KEY_GAP),
          width: 7 * KEY_WIDTH + 6 * KEY_GAP,
          height: KEY_HEIGHT,
          r: 14,
          fill: paper,
          opacity: 0.82,
        })
      : Array.from({ length: KEY_COLUMNS }, (_, key) =>
          box({
            x:
              KEYBOARD.x +
              padding +
              key * (KEY_WIDTH + KEY_GAP) +
              (row % 2 ? KEY_GAP : 0),
            y: KEYBOARD.y + KEY_TOP + row * (KEY_HEIGHT + KEY_GAP),
            width: KEY_WIDTH,
            height: KEY_HEIGHT,
            r: 14,
            fill: paper,
            opacity: 0.82,
          }),
        ).join(""),
  ).join("");
  // The strike is drawn, not typeset, so it can be seen to happen.
  const strike = box({
    x: KEYBOARD.x + 40,
    y: KEYBOARD.y + KEY_TOP + 1.5 * (KEY_HEIGHT + KEY_GAP) + KEY_HEIGHT / 2 - 5,
    width: (KEYBOARD.width - 80) * entered(t, 1.8),
    height: 10,
    r: 5,
    fill: ink,
    opacity: 0.6,
  });

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
        height: FEATURE_HEIGHT,
        r: FEATURE_HEIGHT / 2,
        fill: chip.live ? accent : muted,
        opacity: chip.live ? 1 : 0.16,
      }) +
      text({
        x: x + chipWidth / 2,
        y: scene.featureTop + 36,
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
            y: scene.featureTop + FEATURE_HEIGHT / 2 - 2,
            width: (chipWidth - 36) * entered(t, 2.2),
            height: 4,
            r: 2,
            fill: muted,
          }));
    chipRow.push(arriving(entered(t, 1.1 + i * ENTER_STAGGER), body));
    x += chipWidth + 18;
  }

  return {
    back: device(scale) + words(scene, t) + chipRow.join(""),
    screens: [
      { surface: "desktop", rect: inStage(PICTURE, scale), opacity: 1 },
    ],
    // The keyboard is the one thing in the film that has to sit on top of a
    // still, so it is handed back as its own layer rather than drawn into the
    // frame the stills are composited over.
    front: staged(
      scale,
      arriving(arrival, box({ ...KEYBOARD, fill: slab }) + keys + strike),
    ),
  };
}

/**
 * Scene six: how the next internet actually gets made. Everything before this
 * is a claim about the product; this is the answer to "and why should I
 * believe you". It is not a new claim either -- it is the same ten-stage loop
 * the landing page walks a reader through, drawn as the loop it is, with the
 * mission sitting at the centre of it.
 *
 * The sweep goes round exactly once and names each stage as it passes, so the
 * ring ends closed and fully labelled instead of asking anyone to read ten
 * words in six seconds. The product is not on screen here: this scene is about
 * the process, and putting a screenshot behind it would only say that the two
 * are the same argument, which is the one thing it is trying to disprove.
 */
function buildLoop(scene, t, words_, elapsed) {
  const arrival = entered(t, 0.3);
  const swept = smooth(clamp((t - LOOP_START) / LOOP_TRAVEL));
  const stages = words_.loop.stages;
  const at = (angle, radius) => ({
    x: LOOP.cx + Math.cos((angle * Math.PI) / 180) * radius,
    y: LOOP.cy + Math.sin((angle * Math.PI) / 180) * radius,
  });
  const dot = (point, size, fill, opacity) =>
    box({
      x: point.x - size / 2,
      y: point.y - size / 2,
      width: size,
      height: size,
      r: size / 2,
      fill,
      opacity,
    });

  // The track the stages stand on, lit behind the head so the arc closes.
  const track = Array.from({ length: LOOP_TRACK_DOTS }, (_, i) => {
    const progress = i / LOOP_TRACK_DOTS;
    const passed = progress <= swept;
    return dot(
      at(LOOP_FIRST_ANGLE + progress * 360, LOOP.radius),
      LOOP_TRACK_DOT,
      passed ? accent : muted,
      passed ? 0.55 : 0.18,
    );
  }).join("");

  const nodes = stages
    .map((label, i) => {
      const progress = i / stages.length;
      const angle = LOOP_FIRST_ANGLE + progress * 360;
      const point = at(angle, LOOP.radius);
      const passed = swept >= progress;
      // How long ago the head went past, which is all the highlight is.
      const heat = passed ? 1 - clamp((swept - progress) / LOOP_TAIL) : 0;
      const halo =
        heat > 0.01
          ? dot(point, LOOP_NODE + 34 * heat, accent, 0.22 * heat)
          : "";
      const body = dot(
        point,
        LOOP_NODE + 6 * heat,
        passed ? accent : muted,
        passed ? 1 : 0.26,
      );
      // A stage names itself as the loop reaches it, and keeps its name.
      const radians = (angle * Math.PI) / 180;
      const run = Math.cos(radians);
      const rise = Math.sin(radians);
      const anchorPoint = at(angle, LOOP.radius + LOOP_LABEL_GAP);
      // Eight of the ten stages sit beside the ring rather than above or below
      // it, and a label centred on its own radial point reaches back over the
      // node it belongs to. Those grow outwards from the point instead, which
      // is the only placement that keeps the longest translation clear of both
      // its node and the edge of the frame.
      const sideways = Math.abs(run) >= 0.5;
      const name = text({
        x: anchorPoint.x,
        // Optical rather than geometric: a baseline placed on the radius alone
        // sits too high under the ring and too low over it.
        y: anchorPoint.y + (sideways ? 7 : rise > 0 ? 20 : -4),
        value: label,
        size: LOOP_LABEL_SIZE,
        fill: passed ? ink : muted,
        weight: passed ? "700" : undefined,
        anchor: sideways ? (run > 0 ? "start" : "end") : "middle",
        opacity: passed ? 1 : 0.3,
      });
      return halo + body + name;
    })
    .join("");

  // The mission, verbatim from the page, inside the loop that delivers it.
  const centre = words_.loop.centre
    .map((line, i) =>
      text({
        x: LOOP.cx,
        y: LOOP.cy - 12 + i * LOOP_CENTRE_LEADING,
        value: line,
        size: LOOP_CENTRE_SIZE,
        font: SERIF,
        anchor: "middle",
      }),
    )
    .join("");

  return {
    back: arriving(arrival, track + nodes + centre) + words(scene, t),
    screens: [],
    // The last frame of the film is the only place the address is spoken, and
    // it arrives once the loop has closed behind it.
    site: arriving(
      entered(t, 4.9),
      text({
        x: MARGIN + COLUMN,
        y: SITE_Y,
        value: words_.site,
        size: SITE_SIZE,
        fill: accent,
        weight: "700",
        anchor: "end",
      }),
    ),
  };
}

const painters = [claim, ingest, voice, motion, legacy, buildLoop];

function frame(index, scene, t, words_) {
  // Elapsed time in the finished film, not in this clip. Everything that has
  // to survive a cross-fade untouched is a function of this number, and the
  // two clips that overlap there agree on it exactly.
  const elapsed = index * SCENE_SECONDS + t;
  const painted = painters[index](scene, t, words_, elapsed);
  const open = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">`;
  return {
    back:
      open +
      box({ x: 0, y: 0, width: WIDTH, height: HEIGHT, fill: paper }) +
      box({
        x: FIELD_X,
        y: 0,
        width: WIDTH - FIELD_X,
        height: HEIGHT,
        fill: field,
      }) +
      painted.back +
      `</svg>`,
    // Drawn over the screens: whatever a scene has to put in front of the
    // product, then the furniture, which must never be covered by anything.
    front:
      open +
      (painted.front ?? "") +
      furniture(words_, index, t, elapsed) +
      (painted.site ?? "") +
      `</svg>`,
    screens: painted.screens,
  };
}

/** The size a surface is rasterised at: the largest the push ever draws it. */
const drawn = (spec) => ({
  width: Math.round(spec.width * MAX_PUSH),
  height: Math.round(spec.height * MAX_PUSH),
});

/**
 * The committed screenshot, cropped and sized the way the stage wants it. This
 * is the fallback: one image, handed back for every frame of every scene, so a
 * checkout without the recordings still renders a correct film -- a still one.
 */
async function prepareStill(source, spec, destination) {
  const size = drawn(spec);
  await run("magick", [
    source,
    "-resize",
    `${size.width}x${size.height}^`,
    "-gravity",
    spec.gravity,
    "-extent",
    `${size.width}x${size.height}`,
    destination,
  ]);
}

/**
 * The phone's body, as an image with a hole in it. Drawing it into the SVG is
 * not an option -- the screens are composited over the finished frame, so the
 * body would end up behind the screen it is holding -- and baking it around
 * each frame of footage would be the same work done three hundred times.
 */
async function prepareBezel(destination) {
  const outer = drawn(PHONE);
  const bezel = Math.round(PHONE_BEZEL * MAX_PUSH);
  const pill = { width: 104, height: 8 };
  const mask = `${destination}.mask.png`;
  await run("magick", [
    "-size",
    `${outer.width}x${outer.height}`,
    "xc:black",
    "-fill",
    "white",
    "-draw",
    `roundrectangle 0,0,${outer.width - 1},${outer.height - 1},${round(PHONE.r * MAX_PUSH)},${round(PHONE.r * MAX_PUSH)}`,
    "-fill",
    "black",
    "-draw",
    `roundrectangle ${bezel},${bezel},${outer.width - 1 - bezel},${outer.height - 1 - bezel},${round(PHONE_WINDOW_R * MAX_PUSH)},${round(PHONE_WINDOW_R * MAX_PUSH)}`,
    mask,
  ]);
  await run("magick", [
    "-size",
    `${outer.width}x${outer.height}`,
    `xc:${ink}`,
    // The speaker, which is what tells a black rounded rectangle that it is a
    // phone and not a tablet.
    "-fill",
    `${paper}44`,
    "-draw",
    `roundrectangle ${round(outer.width / 2 - pill.width / 2)},${round(bezel / 2 - pill.height / 2)},${round(outer.width / 2 + pill.width / 2)},${round(bezel / 2 + pill.height / 2)},4,4`,
    mask,
    "-alpha",
    "off",
    "-compose",
    "CopyOpacity",
    "-composite",
    destination,
  ]);
}

/** The pixel size of a video, asked of the file rather than assumed. */
async function measure(source) {
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-of",
    "csv=p=0",
    source,
  ]);
  const [width, height] = stdout.trim().split(",").map(Number);
  return { width, height };
}

/**
 * Cuts the stretches of the recording the scenes ask for, in one pass over it,
 * and writes them as a single numbered sequence at the size the stage draws
 * them at. Splitting the decoded stream and concatenating the windows keeps
 * this to one decode and one filter graph: six scenes are not six reasons to
 * read the same file four times. `tpad` clones the last frame behind each
 * window so a cue near the end of the take still yields a full scene, and the
 * frame-exact trim after it means the windows line up end to end.
 */
async function cutFootage(source, spec, cues, clips, directory) {
  const size = drawn(spec);
  const source_ = await measure(source);
  // Cover rather than fit: the stage is filled and the overflow is cropped
  // against the same edge the still is cropped against.
  const cover = Math.max(
    size.width / source_.width,
    size.height / source_.height,
  );
  const filled = {
    width: Math.ceil(source_.width * cover),
    height: Math.ceil(source_.height * cover),
  };
  const left =
    spec.gravity === "north" ? round((filled.width - size.width) / 2) : 0;
  const windows = clips.filter((clip) => cues[clip.index] != null);
  const graph = [
    `[0:v]split=${windows.length}${windows.map((_, i) => `[w${i}]`).join("")}`,
    ...windows.map(
      (clip, i) =>
        `[w${i}]trim=start=${number(cues[clip.index])},setpts=PTS-STARTPTS,fps=${RENDER_FPS},` +
        `tpad=stop_mode=clone:stop_duration=${SCENE_SECONDS},trim=end_frame=${clip.frames},setpts=PTS-STARTPTS,` +
        `scale=${filled.width}:${filled.height}:flags=lanczos,crop=${size.width}:${size.height}:${left}:0[c${i}]`,
    ),
    `${windows.map((_, i) => `[c${i}]`).join("")}concat=n=${windows.length}:v=1:a=0[frames]`,
  ];
  await run("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-i",
    source,
    "-filter_complex",
    graph.join(";"),
    "-map",
    "[frames]",
    "-fps_mode",
    "passthrough",
    "-start_number",
    "0",
    join(directory, "%05d.png"),
  ]);
  let offset = 0;
  const starts = new Map();
  for (const clip of windows) {
    starts.set(clip.index, offset);
    offset += clip.frames;
  }
  return (scene, i) =>
    join(directory, `${String(starts.get(scene) + i).padStart(5, "0")}.png`);
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

/** ImageMagick's -geometry wants its sign spelled out, including on zero. */
const place = (x, y) => {
  const px = round(x);
  const py = round(y);
  return `${px < 0 ? "" : "+"}${px}${py < 0 ? "" : "+"}${py}`;
};

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
  // it shares with a neighbour, which is what makes the clips add up to exactly
  // DURATION_SECONDS once ffmpeg has overlapped them.
  const clips = Array.from({ length: SCENES }, (_, i) => {
    const lead = i === 0 ? 0 : CROSSFADE_SECONDS / 2;
    const tail = i === SCENES - 1 ? 0 : CROSSFADE_SECONDS / 2;
    const frames = Math.round((SCENE_SECONDS + lead + tail) * RENDER_FPS);
    return { index: i, lead, frames, seconds: frames / RENDER_FPS };
  });

  const bezel = join(work, "phone-bezel.png");
  await prepareBezel(bezel);

  for (const [language, words_] of Object.entries(introCopy)) {
    const scenes = await layout(language);
    // What each scene gets handed for a given frame: a frame of the recording
    // where there is one, and the committed screenshot -- the same image every
    // time -- where there is not.
    const scratch = [];
    const screens = { bezel: () => bezel };
    for (const [name, surface] of Object.entries(SURFACES)) {
      const directory = join(work, `${language}-${name}`);
      mkdirSync(directory, { recursive: true });
      scratch.push(directory);
      const recording = join(FOOTAGE, `${surface.clip}.${language}.webm`);
      if (existsSync(recording)) {
        screens[name] = await cutFootage(
          recording,
          surface.spec,
          surface.cues,
          clips,
          directory,
        );
        continue;
      }
      const still = join(directory, "still.png");
      console.log(
        `no ${recording}: falling back to the committed still for ${name} (${language})`,
      );
      await prepareStill(
        join(STILLS, `${surface.clip}.${language}.png`),
        surface.spec,
        still,
      );
      screens[name] = () => still;
    }

    const jobs = [];
    for (const clip of clips) {
      const directory = join(work, `${language}-scene${clip.index}`);
      mkdirSync(directory, { recursive: true });
      scratch.push(directory);
      for (let i = 0; i < clip.frames; i += 1) {
        // Time is measured from the moment the caption for this scene starts,
        // which is a little after the clip does for every scene but the first.
        jobs.push({ clip, directory, i, t: i / RENDER_FPS - clip.lead });
      }
    }

    await inParallel(jobs, async ({ clip, directory, i, t }) => {
      const drawn = frame(clip.index, scenes[clip.index], t, words_);
      const stem = join(directory, `frame-${String(i).padStart(5, "0")}`);
      writeFileSync(`${stem}.svg`, drawn.back);
      writeFileSync(`${stem}.front.svg`, drawn.front);
      const composite = drawn.screens.flatMap(({ surface, rect, opacity }) => [
        "(",
        screens[surface](clip.index, i),
        "-resize",
        `${round(rect.width)}x${round(rect.height)}!`,
        "-alpha",
        "set",
        "-channel",
        "A",
        "-evaluate",
        "multiply",
        String(number(opacity)),
        "+channel",
        ")",
        "-geometry",
        place(rect.x, rect.y),
        "-composite",
      ]);
      await run("magick", [
        `${stem}.svg`,
        ...composite,
        "(",
        "-background",
        "none",
        `${stem}.front.svg`,
        ")",
        "-geometry",
        "+0+0",
        "-composite",
        `${stem}.png`,
      ]);
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
      "slow",
      "-crf",
      String(H264_CRF),
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
      String(VP9_CRF),
      "-row-mt",
      "1",
      "-deadline",
      "good",
      "-cpu-used",
      "2",
      "-pix_fmt",
      "yuv420p",
      webm,
    ]);

    copyFileSync(mp4, join(WEB, `ursly-intro.${language}.mp4`));
    copyFileSync(webm, join(WEB, `ursly-intro.${language}.webm`));
    copyFileSync(mp4, join(MOBILE, `ursly-intro.${language}.mp4`));
    writeFileSync(join(WEB, `ursly-intro.${language}.vtt`), captions(words_));
    // A language's frames are worth several gigabytes between them, and the
    // second language is about to want the same room.
    for (const directory of scratch)
      rmSync(directory, { recursive: true, force: true });
    console.log(
      `rendered ${language}: ${DURATION_SECONDS}s, ${WIDTH}x${HEIGHT}, ${OUTPUT_FPS}fps`,
    );
  }

  rmSync(work, { recursive: true, force: true });
}

await main();
