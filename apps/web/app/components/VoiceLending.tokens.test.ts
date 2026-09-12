import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const globals = readFileSync(
  fileURLToPath(new URL("../globals.css", import.meta.url)),
  "utf8",
);

/**
 * The toast is the one surface here that has to be read under pressure, and a
 * literal colour in it is a colour that stops answering to the palette. The
 * same trap as Process: an undeclared custom property resolves to nothing and
 * drops the whole declaration without a word from the browser.
 */
/** Every flat rule in the stylesheet that this feature owns. */
const styles = Array.from(
  globals.matchAll(/[^{}]*\{[^{}]*\}/g),
  (match) => match[0],
)
  .filter((rule) => /voice-lending|voice-consent/.test(rule))
  .join("\n");

describe("Voice lending design tokens", () => {

  it("styles the panel and the toast at all", () => {
    expect(styles).toMatch(/\.voice-consent-toast\s*\{/);
    expect(styles).toMatch(/\.voice-lending\s*\{/);
  });

  it("writes no literal colour", () => {
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i);
  });

  it("only uses custom properties the stylesheet declares", () => {
    const declared = new Set(
      Array.from(globals.matchAll(/(--[a-z0-9-]+)\s*:/g), (match) => match[1]),
    );
    const used = new Set(
      Array.from(styles.matchAll(/var\((--[a-z0-9-]+)/g), (match) => match[1]),
    );
    expect([...used].filter((token) => !declared.has(token))).toEqual([]);
  });
});
