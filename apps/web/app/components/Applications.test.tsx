// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  APPLICATION_CARDS,
  APPLICATION_STRINGS,
  Applications,
  PREVIEW_VERSION,
} from "./Applications";
import { LanguageProvider } from "../i18n/LanguageProvider";
import { dictionaryFor } from "../i18n/dictionaries";
import { IDENTICAL_IN_BOTH, french } from "../i18n/fr";
import type { Language } from "../i18n/languages";
import { appDownloads, releaseTag } from "../content/downloads";

const inLanguage = (language: Language) => (
  <LanguageProvider language={language} dictionary={dictionaryFor(language)}>
    <Applications />
  </LanguageProvider>
);

/**
 * Every run of text the section puts on screen, one entry per text node so a
 * sentence broken by a link is compared piece by piece. Runs without a letter
 * (a separator, the full stop after a link) carry no language and are dropped.
 */
const spokenText = (root: HTMLElement): string[] => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const runs: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
    if (/\p{L}/u.test(text)) runs.push(text);
  }
  return runs;
};

const textOf = (language: Language): string[] => {
  const { container } = render(inLanguage(language));
  const runs = spokenText(container);
  cleanup();
  return runs;
};

afterEach(cleanup);

describe("Applications section", () => {
  /**
   * The section is bilingual or it is broken: a string that reads the same in
   * both languages is either a term French writes the same way, named in
   * `IDENTICAL_IN_BOTH`, or a string somebody forgot to translate. Intent is
   * read from that list alone — a dictionary entry proves nothing, since the
   * quickest way to ship a late translation is to copy the English into it.
   * Nothing here names the strings that exist today, so a new string added
   * without a translation fails this too, dictionary entry or not.
   */
  it("leaves no untranslated English on the French page", () => {
    const english = textOf("en");
    const translated = new Set(textOf("fr"));
    const untranslated = english.filter(
      (run) => translated.has(run) && !IDENTICAL_IN_BOTH.includes(run),
    );
    expect(untranslated).toEqual([]);
  });

  it("has a French translation for every string the section declares", () => {
    const missing = APPLICATION_STRINGS.filter(
      (key) => !Object.prototype.hasOwnProperty.call(french, key),
    );
    expect(missing).toEqual([]);
    // Present is not translated: blank and echoed-back English both fail.
    const untranslated = APPLICATION_STRINGS.filter(
      (key) =>
        french[key].trim() === "" ||
        (french[key] === key && !IDENTICAL_IN_BOTH.includes(key)),
    );
    expect(untranslated).toEqual([]);
  });

  it("reads in French: heading, every card, and the download disclosure", () => {
    render(inLanguage("fr"));
    const section = screen.getByRole("region", {
      name: french["Your next insight, wherever you go."],
    });
    expect(section).toHaveAttribute("id", "applications");
    expect(
      within(section).getByText(
        french[APPLICATION_CARDS[0].note].replace("{version}", PREVIEW_VERSION),
      ),
    ).toBeInTheDocument();
    for (const card of APPLICATION_CARDS) {
      expect(
        within(section).getByRole("heading", {
          level: 3,
          name: french[card.title],
        }),
      ).toBeInTheDocument();
      expect(within(section).getByText(french[card.badge])).toBeInTheDocument();
      expect(within(section).getByText(french[card.body])).toBeInTheDocument();
      const action = within(section).getByRole("link", {
        name: french[card.action],
      });
      expect(action).toHaveAttribute("href", card.href);
    }
    // The sentence keeps its links, in the order French puts them.
    expect(
      within(section).getByRole("link", {
        name: french["known limitations and installation instructions"],
      }),
    ).toBeInTheDocument();
    expect(
      within(section).getByRole("link", {
        name: french["Verify download checksums"],
      }),
    ).toBeInTheDocument();
  });

  it("keeps the English page in the source language", () => {
    const shown = textOf("en").join("\n");
    for (const card of APPLICATION_CARDS) {
      expect(shown).toContain(card.title);
      expect(shown).toContain(card.body);
      expect(shown).toContain(card.action);
      expect(shown).toContain(card.note.replace("{version}", PREVIEW_VERSION));
    }
  });

  /**
   * The menu in the bar and the cards here hand over the same files. A version
   * written twice is a version that will one day disagree with itself, so the
   * section reads the published release rather than restating it.
   */
  it("takes its builds from the one place the release is named", () => {
    expect(PREVIEW_VERSION).toBe(releaseTag);
    for (const build of appDownloads)
      expect(APPLICATION_CARDS.map((card) => card.href)).toContain(build.url);
  });
});
