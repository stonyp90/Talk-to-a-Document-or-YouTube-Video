import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONTEXT_CHARACTER_BUDGET,
  buildContextWindow,
  resolveContextBudget,
} from "./context";

describe("context window", () => {
  it("passes a short source through untouched", () => {
    const window = buildContextWindow("The answer is 42.", 1000);
    expect(window.text).toBe("The answer is 42.");
    expect(window.truncated).toBe(false);
    expect(window.usedCharacters).toBe(17);
    expect(window.totalCharacters).toBe(17);
  });

  it("keeps the opening and the ending of a long source", () => {
    const body = `OPENING${"x".repeat(5000)}ENDING`;
    const window = buildContextWindow(body, 1000);
    expect(window.truncated).toBe(true);
    expect(window.text.startsWith("OPENING")).toBe(true);
    expect(window.text.endsWith("ENDING")).toBe(true);
    expect(window.totalCharacters).toBe(body.length);
  });

  it("marks the elision so the model never invents the missing middle", () => {
    const window = buildContextWindow("a".repeat(9000), 800);
    expect(window.text).toContain("omitted from this excerpt");
  });

  it("never emits more than the budget", () => {
    for (const budget of [200, 1000, 8000]) {
      const window = buildContextWindow("z".repeat(500000), budget);
      expect(window.usedCharacters).toBeLessThanOrEqual(budget);
      expect(window.text.length).toBeLessThanOrEqual(budget);
    }
  });

  it("falls back to the default budget for absent or unusable configuration", () => {
    expect(resolveContextBudget(undefined)).toBe(DEFAULT_CONTEXT_CHARACTER_BUDGET);
    expect(resolveContextBudget("")).toBe(DEFAULT_CONTEXT_CHARACTER_BUDGET);
    expect(resolveContextBudget("not-a-number")).toBe(
      DEFAULT_CONTEXT_CHARACTER_BUDGET,
    );
    expect(resolveContextBudget("-5")).toBe(DEFAULT_CONTEXT_CHARACTER_BUDGET);
  });

  it("honours a configured budget within safe bounds", () => {
    expect(resolveContextBudget("50000")).toBe(50000);
  });
});
