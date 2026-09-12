import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const componentsDir = fileURLToPath(new URL("../components", import.meta.url));
const sources = Object.fromEntries(
  readdirSync(componentsDir)
    .filter((name) => name.endsWith(".tsx") && !name.includes(".test."))
    .map((name) => [name, readFileSync(`${componentsDir}/${name}`, "utf8")]),
);
const everything = Object.values(sources).join("\n");

/**
 * The landing page and the application are one product, so a reader who
 * crosses between them must meet one word per idea. Each entry below is a
 * concept the two pages used to name two different ways.
 */
const ONE_WORD_PER_IDEA: Array<{ idea: string; banned: RegExp; use: string }> =
  [
    {
      idea: "the surface a visitor enters",
      banned: /Skip to workspace|the workspace\b/,
      use: '"the app", the name the landing page and the menu already use',
    },
    {
      idea: "who reads the source",
      banned: /We[’']ll read it for you/,
      use: '"Ursly reads it for you", as the intro says it',
    },
    {
      idea: "the control that arms voice commands",
      banned: /Arm voice actions/,
      use: '"Speak a command", the label actually on the button',
    },
  ];

describe("shared vocabulary", () => {
  for (const { idea, banned, use } of ONE_WORD_PER_IDEA)
    it(`names ${idea} one way`, () => {
      const guilty = Object.entries(sources)
        .filter(([, source]) => banned.test(source))
        .map(([name]) => name);
      expect(guilty, `use ${use}`).toEqual([]);
    });

  it("writes the voice-chat action in one casing", () => {
    expect(everything).not.toMatch(/Start Voice Chat/);
    expect(everything).toMatch(/Start voice chat/);
  });

  it("translates every literal the components ask for", () => {
    const french = readFileSync(
      fileURLToPath(new URL("./fr.ts", import.meta.url)),
      "utf8",
    );
    const asked = new Set(
      [...everything.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]),
    );
    // Prettier leaves an identifier-shaped key unquoted, so accept both.
    const declared = new Set(
      [
        ...french.matchAll(
          /^\s*(?:"((?:[^"\\]|\\.)*)"|([A-Za-z_$][\w$]*))\s*:/gm,
        ),
      ].map((m) => m[1] ?? m[2]),
    );
    const missing = [...asked].filter((key) => !declared.has(key));
    expect(missing).toEqual([]);
  });
});
