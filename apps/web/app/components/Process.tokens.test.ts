import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

/** The declarations of the first rule whose selector is exactly `selector`. */
const ruleBody = (css: string, selector: string) => {
  const escaped = selector.replace(/[.[\]*+?^${}()|\\]/g, "\\$&");
  const match = css.match(new RegExp(`^${escaped}\\s*\\{([^}]*)\\}`, "m"));
  if (!match) throw new Error(`no rule for ${selector}`);
  return match[1];
};

/** Every stop of an @keyframes block, as its own declaration text. */
const keyframeStops = (css: string, name: string) => {
  const opens = css.indexOf(`@keyframes ${name}`);
  if (opens < 0) throw new Error(`no @keyframes ${name}`);
  let depth = 0;
  let end = css.length;
  for (let at = css.indexOf("{", opens); at < css.length; at += 1) {
    if (css[at] === "{") depth += 1;
    if (css[at] === "}" && --depth === 0) {
      end = at;
      break;
    }
  }
  return Array.from(
    css.slice(opens, end).matchAll(/(?:[\d.]+%|from|to)\s*\{([^}]*)\}/g),
    (stop) => stop[1],
  );
};

/**
 * A custom property that is not declared anywhere resolves to nothing, and a
 * shorthand that references it is dropped whole: the comet turns black, the
 * pull-quote loses its bar. Neither the type checker nor the browser complains,
 * so assert it here.
 */
describe("Process design tokens", () => {
  it("only uses custom properties the stylesheet declares", () => {
    const stylesheet = read("./Process.module.css");
    const globals = read("../globals.css");
    const declared = new Set(
      Array.from(globals.matchAll(/(--[a-z0-9-]+)\s*:/g), (m) => m[1]),
    );
    // The loop timings are supplied inline by the component, per instance.
    const supplied = new Set(["--loop-travel", "--loop-inner"]);
    const used = new Set(
      Array.from(stylesheet.matchAll(/var\((--[a-z0-9-]+)/g), (m) => m[1]),
    );
    const undeclared = [...used].filter(
      (token) => !declared.has(token) && !supplied.has(token),
    );
    expect(undeclared).toEqual([]);
    for (const token of supplied)
      expect(read("./Process.tsx")).toContain(token);
  });

  it("writes no literal colour into the module", () => {
    expect(read("./Process.module.css")).not.toMatch(
      /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i,
    );
  });

  /**
   * The orbit and its three provider markers are the only thing that says a
   * model is taking its turn on the training loop. In the decorative border
   * tint they sit at roughly 1.8:1 against the surface, and announcing the
   * turn by swapping that tint for the accent states it in hue alone: a
   * monochrome or colour-blind reading cannot see it, and the hand-off
   * keyframe then undoes it by returning the marker to the tint. So the
   * accent is held throughout and the turn is said by weight instead.
   */
  it("signals the provider hand-off by weight, not by hue", () => {
    const stylesheet = read("./Process.module.css");
    expect(ruleBody(stylesheet, ".satelliteRing")).toMatch(
      /stroke:\s*var\(--accent\)\s*;/,
    );
    expect(ruleBody(stylesheet, ".providerDot")).toMatch(
      /stroke:\s*var\(--accent\)\s*;/,
    );
    const turning = ruleBody(
      stylesheet,
      '.diagram[data-inner-loop="active"] .satelliteRing',
    );
    expect(turning).toMatch(/stroke-width:/);
    expect(turning).not.toMatch(/stroke:/);
    // The hand-off pulses the fill; the outline never blinks out.
    const stops = keyframeStops(stylesheet, "provider-pass");
    expect(stops.length).toBeGreaterThan(1);
    for (const stop of stops)
      expect(stop).toMatch(/stroke:\s*var\(--accent\)\s*;/);
  });

  /**
   * Which stage is chosen is load-bearing: the caption, the diagram and the
   * pause control all follow it. Said by a wash plus a 1.80:1 border it is
   * said in colour alone, and barely in that. A full-strength edge carries
   * it at 5.49:1 and a heavier title repeats it in a second channel.
   */
  it("marks the chosen stage with an edge and with weight", () => {
    const stylesheet = read("./Process.module.css");
    const chosen = '.step button[aria-current="step"]';
    expect(ruleBody(stylesheet, chosen)).toMatch(
      /border-color:\s*var\(--accent\)\s*;/,
    );
    const weight = (body: string) => {
      const found = body.match(/font-weight:\s*(\d+)/);
      if (!found) throw new Error("no font-weight declared");
      return Number(found[1]);
    };
    expect(
      weight(ruleBody(stylesheet, `${chosen} .stepTitle`)),
    ).toBeGreaterThan(weight(ruleBody(stylesheet, ".stepTitle")));
    // The selector can only ever match if the component sets the state.
    expect(read("./Process.tsx")).toMatch(/aria-current=\{[^}]*"step"/);
  });
});
