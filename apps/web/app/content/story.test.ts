import { describe, expect, it } from "vitest";
import { MENU_SECTIONS, STORY_SECTIONS, appHref } from "./story";

describe("the story order", () => {
  it("opens on how we build, before any claim about the product", () => {
    expect(STORY_SECTIONS[0].id).toBe("how-we-build");
    expect(STORY_SECTIONS.map((section) => section.id)).toEqual([
      "how-we-build",
      "platform",
      "pricing",
      "how-it-works",
      "applications",
    ]);
  });

  it("names every section once", () => {
    const ids = STORY_SECTIONS.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("carries the build loop into the menu, in the order of the page", () => {
    expect(MENU_SECTIONS.map((section) => section.id)).toEqual([
      "how-we-build",
      "platform",
      "pricing",
    ]);
    for (const section of MENU_SECTIONS)
      expect(section.short.length).toBeLessThanOrEqual(section.label.length);
  });

  it("points at the application in the reader's language", () => {
    expect(appHref("fr")).toBe("/fr/app");
  });
});
