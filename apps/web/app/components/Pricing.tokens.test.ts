import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

/** Same guard as the loop: an undeclared custom property fails silently. */
describe("Pricing design tokens", () => {
  it("only uses custom properties the stylesheet declares", () => {
    const stylesheet = read("./Pricing.module.css");
    const globals = read("../globals.css");
    const declared = new Set(
      Array.from(globals.matchAll(/(--[a-z0-9-]+)\s*:/g), (m) => m[1]),
    );
    const used = new Set(
      Array.from(stylesheet.matchAll(/var\((--[a-z0-9-]+)/g), (m) => m[1]),
    );
    expect([...used].filter((token) => !declared.has(token))).toEqual([]);
  });

  it("writes no literal colour into the module", () => {
    expect(read("./Pricing.module.css")).not.toMatch(
      /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i,
    );
  });
});
