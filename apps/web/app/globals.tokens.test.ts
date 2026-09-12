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
});
