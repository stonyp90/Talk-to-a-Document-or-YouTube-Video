import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { french } from "./fr";

/**
 * The dictionary is only honest if it is checked against the page. A section
 * can be reworded, shortened or split into fragments without anyone touching
 * French, and the entry it used then keeps its translation while nothing asks
 * for it any more: the test on the dictionary alone still passes, and the
 * French reader is the only one who notices.
 *
 * So this reads the modules a reader can actually reach, from the two pages
 * down through their imports, and asks of every string they translate whether
 * French has an answer. Dead files are not on the walk, which is the point —
 * an unreachable section cannot embarrass the dictionary.
 *
 * The rule sees keys written literally at the call site. A key passed through
 * a variable is invisible to it, which is how an English tagline once reached a
 * French page unnoticed: write `t("Some label")` where the label is chosen,
 * not `t(chosenKey)` where it is rendered.
 */
const appRoot = resolve(__dirname, "..");

/** Where a reader arrives. Everything reachable from here is on the page. */
const ENTRIES = [
  join(appRoot, "[lang]/page.tsx"),
  join(appRoot, "[lang]/app/page.tsx"),
];

const resolveModule = (from: string, specifier: string) => {
  if (!specifier.startsWith(".")) return null;
  const base = resolve(dirname(from), specifier);
  for (const candidate of [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    join(base, "index.tsx"),
    join(base, "index.ts"),
  ])
    if (existsSync(candidate) && /\.(tsx?|css)$/.test(candidate))
      return candidate;
  return null;
};

/** Every module the pages import, transitively, plus the pages themselves. */
function reachable(): string[] {
  const seen = new Set<string>();
  const queue = ENTRIES.filter((entry) => existsSync(entry));
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(
      /(?:from|import)\s*\(?\s*["'](\.[^"']+)["']/g,
    )) {
      const next = resolveModule(file, match[1]);
      if (next && !next.endsWith(".css")) queue.push(next);
    }
  }
  return [...seen];
}

/** Every English string a reachable module asks the dictionary about. */
function translated(): Map<string, string> {
  const found = new Map<string, string>();
  for (const file of reachable()) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g))
      found.set(
        match[1]
          .replace(/\\"/g, '"')
          .replace(
            /\\u([0-9a-fA-F]{4})/g,
            (_, hex) => String.fromCharCode(parseInt(hex, 16)),
          ),
        file.replace(`${appRoot}/`, ""),
      );
  }
  return found;
}

describe("the French dictionary against the page", () => {
  it("walks the surfaces a reader reaches", () => {
    // Guards the walk itself: a rule over an empty list passes for nothing.
    const files = reachable();
    expect(files.length).toBeGreaterThan(10);
    expect(files.some((f) => f.endsWith("SiteFooter.tsx"))).toBe(true);
  });

  it("answers every string those surfaces ask for", () => {
    const asked = translated();
    expect(asked.size).toBeGreaterThan(100);
    const missing = [...asked]
      .filter(([key]) => !(key in french))
      .map(([key, file]) => `${file}: ${key}`);
    expect(missing).toEqual([]);
  });
});
