import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(
  fileURLToPath(new URL("./globals.css", import.meta.url)),
  "utf8",
);

/** Every `{ … }` block in the stylesheet, innermost text only. */
function blocks(css: string): string[] {
  return Array.from(css.matchAll(/\{([^{}]*)\}/g), (match) => match[1]);
}

describe("the global stylesheet", () => {
  /**
   * The CSS pipeline collapses a prefixed declaration and its standard twin
   * onto whichever it reads last. Writing the standard property first left the
   * build emitting `-webkit-backdrop-filter` alone, so browsers that have
   * dropped the alias got no blur: the fixed menu became a translucent panel
   * with the page scrolling legibly through it. The order is the fix, and it
   * is invisible in the source, so it is asserted here.
   */
  it("writes every vendor prefix before the standard property it stands in for", () => {
    const wrong: string[] = [];
    for (const block of blocks(stylesheet)) {
      const declarations = Array.from(
        block.matchAll(/(^|;|\n)\s*(-webkit-)?([a-z-]+)\s*:/g),
        (match) => ({ prefixed: Boolean(match[2]), property: match[3] }),
      );
      declarations.forEach((declaration, index) => {
        if (declaration.prefixed) return;
        const laterPrefix = declarations
          .slice(index + 1)
          .some(
            (other) =>
              other.prefixed && other.property === declaration.property,
          );
        if (laterPrefix) wrong.push(declaration.property);
      });
    }
    expect(wrong).toEqual([]);
  });

  /**
   * Glass is only glass over something blurred. Where the browser cannot blur,
   * the menu has to stop being translucent rather than let the story read
   * through the brand and the modes.
   */
  it("gives the fixed menu an opaque background where nothing can be blurred", () => {
    const guard = stylesheet.match(
      /@supports\s+not\s*\([\s\S]*?\)\s*\{([\s\S]*?)\n\}/,
    );
    expect(guard?.[0]).toContain("backdrop-filter");
    expect(guard?.[0]).toContain("-webkit-backdrop-filter");
    expect(guard?.[1]).toContain(".nav");
    expect(guard?.[1]).toContain("background: var(--nav-solid)");
    expect(stylesheet).toContain("--nav-solid:");
  });
});
