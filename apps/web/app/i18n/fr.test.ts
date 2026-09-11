import { describe, expect, it } from "vitest";
import { IDENTICAL_IN_BOTH, french } from "./fr";

const entries = Object.entries(french);

/**
 * The dictionary is the whole French interface, so the rules that keep it
 * honest belong to it rather than to any one section. A French reader sees a
 * page, not a component: a string that slips through anywhere reads English to
 * them, and the failure looks the same wherever it came from.
 */
describe("the French dictionary", () => {
  it("translates every entry, or says why it does not", () => {
    const echoed = entries
      .filter(([key, value]) => value === key)
      .map(([key]) => key)
      .filter((key) => !IDENTICAL_IN_BOTH.includes(key));
    expect(echoed).toEqual([]);
  });

  it("has no blank translation", () => {
    const blank = entries
      .filter(([, value]) => value.trim() === "")
      .map(([key]) => key);
    expect(blank).toEqual([]);
  });

  /**
   * The list is an exemption, so it has to stay exactly as long as its reasons.
   * A term that has since been translated, renamed or deleted would otherwise
   * sit there holding the door open for whatever string later takes its words.
   */
  it("exempts only terms it still has a reason to exempt", () => {
    const stale = IDENTICAL_IN_BOTH.filter((term) => french[term] !== term);
    expect(stale).toEqual([]);
  });

  /**
   * Every placeholder the English names has to survive into French: a dropped
   * `{count}` silently prints a sentence with a hole where the number goes, and
   * an invented one prints the brace as-is, since the translator only replaces
   * the names it is given.
   */
  it("keeps the placeholders the English string declares", () => {
    const names = (text: string) =>
      [...text.matchAll(/\{(\w+)\}/g)].map(([, name]) => name).sort();
    const mismatched = entries
      .filter(
        ([key, value]) =>
          names(key).join() !== names(value).join() &&
          !IDENTICAL_IN_BOTH.includes(key),
      )
      .map(([key]) => key);
    expect(mismatched).toEqual([]);
  });
});
