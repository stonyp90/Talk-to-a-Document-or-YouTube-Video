import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

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
});
