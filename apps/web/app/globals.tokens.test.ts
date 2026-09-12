import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

const globals = read("./globals.css");
const modules = {
  "Process.module.css": read("./components/Process.module.css"),
  "Applications.module.css": read("./components/Applications.module.css"),
};

/** Everything above this line declares the palette; below it, only uses it. */
const rootBlock = globals.slice(0, globals.indexOf("\n}"));
const belowRoot = globals.slice(globals.indexOf("\n}"));

describe("design tokens", () => {
  it("declares every colour once, in the root block", () => {
    const literals = [
      ...belowRoot.matchAll(/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/gi),
    ].map((match) => match[0]);
    expect(literals).toEqual([]);
    for (const [name, sheet] of Object.entries(modules)) {
      const found = [
        ...sheet.matchAll(/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/gi),
      ].map((match) => match[0]);
      expect(found, name).toEqual([]);
    }
  });

  it("names the two non-body families as tokens instead of repeating them", () => {
    expect(rootBlock).toMatch(/--font-serif:/);
    expect(rootBlock).toMatch(/--font-mono:/);
    // Georgia and the mono stack belong to the token declaration only.
    expect(belowRoot).not.toMatch(/Georgia/);
    expect(belowRoot).not.toMatch(/ui-monospace/);
    for (const [name, sheet] of Object.entries(modules)) {
      expect(sheet, name).not.toMatch(/Georgia/);
      expect(sheet, name).not.toMatch(/ui-monospace/);
    }
  });

  it("sets both pages' primary headline in the same family", () => {
    // The landing hero and the app's workspace title are the same tier: a
    // reader crossing between the two pages must not meet two typefaces.
    const rule = (selector: string) => {
      const at = globals.indexOf(selector);
      expect(at, selector).toBeGreaterThan(-1);
      return globals.slice(at, globals.indexOf("}", at));
    };
    expect(rule(".hero h1 {")).toMatch(/font-family:\s*var\(--font-serif\)/);
    expect(rule(".workspace-heading h1 {")).toMatch(
      /font-family:\s*var\(--font-serif\)/,
    );
  });

  /**
   * The wordmark is the loudest thing on the page: bigger than the first
   * heading of either page, at every width. Both sides are `clamp(min, vw,
   * max)`, so comparing the three parts proves it for every viewport rather
   * than for the handful a rendered test could sample.
   */
  it("draws the wordmark larger than either page's first heading", () => {
    const px = (value: string) =>
      value.endsWith("rem") ? parseFloat(value) * 16 : parseFloat(value);
    const clampOf = (selector: string, property = "font-size") => {
      const at = globals.indexOf(selector);
      expect(at, selector).toBeGreaterThan(-1);
      const rule = globals.slice(at, globals.indexOf("}", at));
      const found = rule.match(
        new RegExp(`${property}:\\s*clamp\\(([^,]+),([^,]+),([^)]+)\\)`),
      );
      expect(found, `${selector} ${property} should be a clamp`).not.toBeNull();
      const [min, preferred, max] = found!.slice(1).map((part) => part.trim());
      return { min: px(min), vw: parseFloat(preferred), max: px(max) };
    };

    const brand = clampOf(":root {", "--brand-size");
    for (const heading of [".hero h1 {", ".workspace-heading h1 {"]) {
      const title = clampOf(heading);
      expect(brand.min, `${heading} floor`).toBeGreaterThan(title.min);
      expect(brand.vw, `${heading} slope`).toBeGreaterThan(title.vw);
      expect(brand.max, `${heading} ceiling`).toBeGreaterThan(title.max);
    }
  });

  it("gives the fixed bar room for a wordmark that size", () => {
    const ceiling = (name: string) => {
      const found = globals.match(
        new RegExp(`${name}:\\s*clamp\\([^,]+,[^,]+,([^)]+)\\)`),
      );
      expect(found, name).not.toBeNull();
      return parseFloat(found![1]);
    };
    // The mark is 1.25em tall, so the row must clear the tallest wordmark.
    expect(ceiling("--nav-h")).toBeGreaterThan(ceiling("--brand-size") * 1.25);
    expect(ceiling("--nav-row")).toBeGreaterThan(
      ceiling("--brand-size") * 1.25,
    );
  });

  it("sizes the wordmark from the token and nowhere else", () => {
    // Three separate rules used to shrink it back down at narrow widths,
    // which is exactly where a small wordmark is least wanted.
    const sizes = [
      ...globals.matchAll(/\.brand\s*\{[^}]*?font-size:\s*([^;]+);/g),
    ];
    expect(sizes.map((match) => match[1].trim())).toEqual([
      "var(--brand-size)",
    ]);
    const marks = [
      ...globals.matchAll(/\.brand-mark\s*\{[^}]*?width:\s*([^;]+);/g),
    ];
    expect(marks.map((match) => match[1].trim())).toEqual(["1.25em"]);
  });

  /**
   * Nothing on either page may out-shout the wordmark. Every scaling type
   * size is a clamp, so comparing all three parts settles it for every
   * viewport at once.
   */
  it("keeps every heading below the wordmark at every width", () => {
    const px = (value: string) =>
      value.endsWith("rem") ? parseFloat(value) * 16 : parseFloat(value);
    const clamps = (sheet: string) =>
      [...sheet.matchAll(/font-size:\s*clamp\(([^,]+),([^,]+),([^)]+)\)/g)].map(
        (match) => ({
          min: px(match[1].trim()),
          vw: parseFloat(match[2]),
          max: px(match[3].trim()),
          text: match[0],
        }),
      );
    const brandMatch = globals.match(
      /--brand-size:\s*clamp\(([^,]+),([^,]+),([^)]+)\)/,
    );
    expect(brandMatch).not.toBeNull();
    const brand = {
      min: px(brandMatch![1].trim()),
      vw: parseFloat(brandMatch![2]),
      max: px(brandMatch![3].trim()),
    };
    const sheets = { "globals.css": globals, ...modules };
    for (const [name, sheet] of Object.entries(sheets))
      for (const size of clamps(sheet)) {
        expect(size.min, `${name}: ${size.text}`).toBeLessThan(brand.min);
        expect(size.vw, `${name}: ${size.text}`).toBeLessThan(brand.vw);
        expect(size.max, `${name}: ${size.text}`).toBeLessThan(brand.max);
      }
  });

  it("leaves no flat heading size to escape that ceiling", () => {
    // A media query used to reset the app's title to a flat 1.7rem, which
    // jumped it back above the wordmark on exactly the narrow screens the
    // clamp was there to handle. Every h1 size must stay a clamp.
    const headings = [
      ...globals.matchAll(/([^{}]*\bh1)\s*\{([^}]*)\}/g),
    ].filter(([, , body]) => /font-size:/.test(body));
    expect(headings.length).toBeGreaterThan(0);
    for (const [, selector, body] of headings) {
      const size = body.match(/font-size:\s*([^;]+);/)![1].trim();
      expect(size, selector.trim()).toMatch(/^clamp\(/);
    }
  });

  it("fills the source column without leaving a dead band", () => {
    // Two failure modes, one rule. Letting the card hug its content leaves a
    // void under it beside the taller conversation; letting it stretch while
    // the panel keeps its natural height leaves a void inside it, above the
    // button. The card fills the column AND the active panel takes the slack.
    const wide = globals.slice(globals.indexOf("@media (min-width: 781px)"));
    const block = (selector: string) => {
      const at = wide.indexOf(selector);
      expect(at, selector).toBeGreaterThan(-1);
      return wide.slice(at, wide.indexOf("}", at));
    };
    expect(block(".source-card {")).not.toMatch(/align-self:\s*start/);
    for (const panel of [
      ".source-picker[open] .source-grid > .dropzone",
      ".source-picker[open] .source-grid > .field",
    ])
      expect(block(panel), panel).toMatch(/flex:\s*1/);
    // Nothing is pinned to the far bottom edge any more.
    expect(globals).not.toMatch(
      /\.source-picker\[open\] \.source-grid \.actions \{[^}]*margin-top:\s*auto/,
    );
  });
});
