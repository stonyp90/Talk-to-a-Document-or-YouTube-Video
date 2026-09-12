import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

/** Comments sit where a selector would, so they go before anything is read. */
const bare = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, " ");

/** Every `selector { declarations }` pair, at-rule nesting flattened away. */
const rules = (css: string) =>
  Array.from(bare(css).matchAll(/([^{}]+)\{([^{}]*)\}/g), (match) => ({
    selectors: match[1].split(",").map((selector) => selector.trim()),
    body: match[2],
  }));

/** The body of an at-rule, brace matched so the rules inside come with it. */
const atRule = (source: string, prelude: string) => {
  const css = bare(source);
  const start = css.indexOf(prelude);
  expect(start, `${prelude} is missing`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    else if (css[index] === "}" && (depth -= 1) === 0)
      return css.slice(open + 1, index);
  }
  throw new Error(`${prelude} is never closed`);
};

/**
 * Every band the stylesheet writes, widest first: the rules outside any query,
 * then each `@media (max-width: N)` block. The readout's measure narrows as the
 * band does, so the ladder of reservations has to be read in this order.
 */
const bands = (source: string) => {
  const css = bare(source);
  const base = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, " ");
  const media = Array.from(
    css.matchAll(/@media\s*\(max-width:\s*(\d+)px\)/g),
    (match) => ({
      width: Number(match[1]),
      body: atRule(source, match[0]),
    }),
  );
  return [
    { width: Number.POSITIVE_INFINITY, body: base },
    ...media.sort((a, b) => b.width - a.width),
  ];
};

/** The last value a band declares for a property on a selector, if any. */
const declaredOn = (body: string, selector: string, property: RegExp) =>
  rules(body)
    .filter((rule) => rule.selectors.includes(selector))
    .flatMap((rule) => rule.body.match(property)?.[1].trim() ?? [])
    .at(-1);

/** The `max-width` a band gives a selector, or undefined if it leaves it alone. */
const measureOf = (body: string, selector: string) =>
  declaredOn(body, selector, /max-width\s*:\s*([^;]+)/);

/** The room a band reserves for the caption, in ems, or undefined. */
const reserveOf = (body: string) => {
  const declared = declaredOn(body, ".caption", /min-height\s*:\s*([\d.]+)em/);
  return declared === undefined ? undefined : Number(declared);
};

/** Words the `animation` shorthand spends on something other than a name. */
const ANIMATION_KEYWORDS = new Set([
  "none",
  "linear",
  "ease",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "step-start",
  "step-end",
  "normal",
  "reverse",
  "alternate",
  "alternate-reverse",
  "forwards",
  "backwards",
  "both",
  "running",
  "paused",
  "infinite",
  "initial",
  "inherit",
  "unset",
]);
const animationNames = (css: string) =>
  Array.from(bare(css).matchAll(/\banimation(?:-name)?:([^;}]+)[;}]/g)).flatMap(
    (match) =>
      match[1]
        .replace(/\b(?:var|calc|cubic-bezier|steps)\([^)]*\)/g, " ")
        .split(/[\s,]+/)
        .filter(
          (word) =>
            /^[A-Za-z_-][\w-]*$/.test(word) && !ANIMATION_KEYWORDS.has(word),
        ),
  );

/**
 * A custom property that is not declared anywhere resolves to nothing, and a
 * shorthand that references it is dropped whole: the comet turns black, the
 * pull-quote loses its bar. Neither the type checker nor the browser complains,
 * so assert it here.
 */
const MODULES = ["./Process.module.css", "./LoopDiagram.module.css"];

describe("Process design tokens", () => {
  it("only uses custom properties the stylesheet declares", () => {
    const stylesheet = MODULES.map(read).join("\n");
    const globals = read("../globals.css");
    const declared = new Set(
      Array.from(globals.matchAll(/(--[a-z0-9-]+)\s*:/g), (m) => m[1]),
    );
    // The loop timings and the phone's fill factor are supplied inline by the
    // component, per instance, because they are derived from its geometry.
    const supplied = new Set(["--loop-travel", "--loop-inner", "--plot-fill"]);
    const used = new Set(
      Array.from(stylesheet.matchAll(/var\((--[a-z0-9-]+)/g), (m) => m[1]),
    );
    const undeclared = [...used].filter(
      (token) => !declared.has(token) && !supplied.has(token),
    );
    expect(undeclared).toEqual([]);
    for (const token of supplied)
      expect(read("./LoopDiagram.tsx")).toContain(token);
  });

  it("writes no literal colour into either module", () => {
    for (const sheet of MODULES)
      expect(read(sheet), sheet).not.toMatch(
        /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i,
      );
  });

  /**
   * CSS Modules scope `@keyframes` names alongside class names, so an
   * animation whose keyframes live in another stylesheet — or nowhere —
   * resolves to nothing and simply never plays. Nothing reports it.
   */
  it("declares every animation it plays", () => {
    const stylesheet = read("./Process.module.css");
    const declared = new Set(
      Array.from(
        bare(stylesheet).matchAll(/@keyframes\s+([A-Za-z_-][\w-]*)/g),
        (m) => m[1],
      ),
    );
    const missing = animationNames(stylesheet).filter(
      (name) => !declared.has(name),
    );
    expect(missing).toEqual([]);
  });

  /** The page promises that decorative motion settles. */
  it("asks for no motion that never stops", () => {
    expect(bare(read("./Process.module.css"))).not.toMatch(/\binfinite\b/);
  });

  /**
   * `.node circle` reaches every circle the group holds. On the training
   * stage those are the satellite ring, the three provider markers and the
   * hand-off dot, so lighting the stage fills the whole hand-off solid.
   */
  it("paints a lit stage by class, never by element", () => {
    const painting = rules(read("./LoopDiagram.module.css")).filter((rule) =>
      /(?:^|[\s;])(?:fill|stroke)\s*:/.test(rule.body),
    );
    const reaching = painting
      .flatMap((rule) => rule.selectors)
      .filter(
        (selector) => /^\.node\b/.test(selector) && /\bcircle$/.test(selector),
      );
    expect(reaching).toEqual([]);
  });

  /**
   * The disc's type is drawn inside the viewBox, so it renders at whatever
   * fraction of its CSS size the diagram is scaled to. On a phone that is
   * under six pixels, far below legibility, so the phone drops it and the
   * mission reaches the reader as real copy instead.
   */
  it("hands the mission from the disc to real copy on a phone", () => {
    const phone = atRule(
      read("./LoopDiagram.module.css"),
      "@media (max-width: 700px)",
    );
    const hidden = rules(phone)
      .filter((rule) => /display\s*:\s*none/.test(rule.body))
      .flatMap((rule) => rule.selectors);
    for (const type of [".discEyebrow", ".discStatement", ".discNote"])
      expect(hidden).toContain(type);

    const target = rules(phone).find((rule) =>
      rule.selectors.includes(".target"),
    );
    expect(target?.body).toMatch(/position\s*:\s*static/);
  });

  /**
   * The readout shares the left column with the intro, so it has to share the
   * intro's measure. The one band that may let it go is the phone, where the
   * column is already narrower than the cap and the ring above it runs the
   * full width: a readout held to 560px there would sit off the ring's centre.
   */
  it("holds the readout to the intro's measure until the phone", () => {
    const stylesheet = read("./Process.module.css");
    const written = bands(stylesheet);
    const base = written[0];
    expect(measureOf(base.body, ".legend")).toBe(
      measureOf(base.body, ".intro"),
    );
    const released = written
      .filter((band) => measureOf(band.body, ".legend") === "none")
      .map((band) => band.width);
    for (const width of released) expect(width).toBeLessThanOrEqual(700);
  });

  /**
   * The caption reserves the tallest stage summary so the control beneath it
   * never shifts as the walk advances. The reservation is NOT monotonic in
   * width, and must not be asserted as such: at 900px the layout drops to one
   * column, which widens the caption's measure and costs it a line, so that
   * band legitimately reserves less than the cramped two-column band above it.
   * What must hold is that the deepest reservation belongs to the narrowest
   * band, because that is where the measure is tightest and the copy wraps
   * most. The reservation actually covering the rendered text is measured in
   * the browser by tests/e2e/how-we-build.spec.ts; CSS text cannot know it.
   */
  it("reserves the most where the column is narrowest", () => {
    const reserved = bands(read("./LoopDiagram.module.css"))
      .map((band) => ({ width: band.width, em: reserveOf(band.body) }))
      .filter(
        (band): band is { width: number; em: number } => band.em !== undefined,
      );
    expect(reserved.length).toBeGreaterThan(1);
    const deepest = reserved.reduce((a, b) => (b.em > a.em ? b : a));
    const narrowest = reserved.reduce((a, b) => (b.width < a.width ? b : a));
    expect(deepest.width).toBe(narrowest.width);
    // A phone is where the copy wraps most, so that is where the floor belongs.
    expect(narrowest.width).toBeLessThanOrEqual(420);
  });

  /**
   * The phone drops the disc's type, and a disc with no type left in it is a
   * blank plate two thirds the width of the ring: it reads as a picture that
   * failed to load. Let the centre read as open orbit instead.
   */
  it("leaves no blank plate where the disc's type was", () => {
    const phone = atRule(
      read("./LoopDiagram.module.css"),
      "@media (max-width: 700px)",
    );
    const disc = rules(phone).find((rule) => rule.selectors.includes(".disc"));
    expect(disc?.body).toMatch(/fill\s*:\s*none/);
    const hidden = rules(phone)
      .filter((rule) => /display\s*:\s*none/.test(rule.body))
      .flatMap((rule) => rule.selectors);
    expect(hidden).toContain(".discHalo");
  });

  /**
   * With the labels gone the picture sits in a frame of empty gutters while
   * the centre of the loop shrinks to nothing. It should take that room back.
   */
  it("lets the diagram reclaim the labels' room on a phone", () => {
    const phone = atRule(
      read("./LoopDiagram.module.css"),
      "@media (max-width: 700px)",
    );
    const diagram = rules(phone).find((rule) =>
      rule.selectors.includes(".diagram"),
    );
    expect(diagram?.body).toMatch(/max-width\s*:\s*none/);

    const plot = rules(phone).find((rule) => rule.selectors.includes(".plot"));
    expect(plot?.body).toMatch(/transform\s*:\s*scale\(var\(--plot-fill\)\)/);
  });
});
