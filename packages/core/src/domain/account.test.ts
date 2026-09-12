import { describe, expect, it } from "vitest";
import {
  DEFAULT_CODE_TTL_MS,
  DEFAULT_MAX_CODE_ATTEMPTS,
  DEFAULT_USAGE_LIMIT_UNITS,
  DEFAULT_USAGE_WINDOW_MS,
  InvalidEmailError,
  InvalidUsageChargeError,
  chargeUsage,
  codeAttemptsExhausted,
  isCodeExpired,
  normalizeEmail,
  type UsageWindow,
} from "./account";

describe("normalizeEmail", () => {
  it("trims and lowercases an address so one person is one account", () => {
    expect(normalizeEmail("  Reader@Example.COM ")).toBe("reader@example.com");
  });

  it.each([
    ["", "an empty string"],
    ["reader", "no at sign"],
    ["reader@@example.com", "two at signs"],
    ["reader@example", "a domain without a dot"],
    ["@example.com", "no local part"],
    ["reader@.com", "a domain starting with a dot"],
    ["reader@example.", "a domain ending with a dot"],
    ["read er@example.com", "an inner space"],
  ])("refuses %j because it has %s", (raw) => {
    expect(() => normalizeEmail(raw)).toThrow(InvalidEmailError);
  });

  it("carries a machine-readable code the interface can act on", () => {
    expect(() => normalizeEmail("nope")).toThrow(
      expect.objectContaining({ code: "INVALID_EMAIL" }),
    );
  });
});

describe("one-time code rules", () => {
  it("treats a code as live until its lifetime has fully elapsed", () => {
    expect(
      isCodeExpired(
        1_000,
        1_000 + DEFAULT_CODE_TTL_MS - 1,
        DEFAULT_CODE_TTL_MS,
      ),
    ).toBe(false);
    expect(
      isCodeExpired(1_000, 1_000 + DEFAULT_CODE_TTL_MS, DEFAULT_CODE_TTL_MS),
    ).toBe(true);
  });

  it("stops guessing at the configured attempt ceiling", () => {
    expect(
      codeAttemptsExhausted(
        DEFAULT_MAX_CODE_ATTEMPTS - 1,
        DEFAULT_MAX_CODE_ATTEMPTS,
      ),
    ).toBe(false);
    expect(
      codeAttemptsExhausted(
        DEFAULT_MAX_CODE_ATTEMPTS,
        DEFAULT_MAX_CODE_ATTEMPTS,
      ),
    ).toBe(true);
  });
});

describe("chargeUsage", () => {
  const limit = { limitUnits: 100, windowMs: 60_000 };
  const fresh = (now: number): UsageWindow => ({
    spentUnits: 0,
    windowStartedAt: now,
  });

  it("spends against an open window and reports what is left", () => {
    const result = chargeUsage(fresh(1_000), 30, 2_000, limit);
    expect(result).toEqual({
      allowed: true,
      window: { spentUnits: 30, windowStartedAt: 1_000 },
      remainingUnits: 70,
    });
  });

  it("allows a charge that lands exactly on the limit", () => {
    const result = chargeUsage(
      { spentUnits: 90, windowStartedAt: 1_000 },
      10,
      2_000,
      limit,
    );
    expect(result.allowed).toBe(true);
    expect(result.remainingUnits).toBe(0);
  });

  it("refuses the unit that would cross the limit and leaves the ledger untouched", () => {
    const window = { spentUnits: 90, windowStartedAt: 1_000 };
    const result = chargeUsage(window, 11, 2_000, limit);
    expect(result.allowed).toBe(false);
    expect(result.window).toEqual(window);
    expect(result.remainingUnits).toBe(10);
  });

  it("keeps the window closed for its whole length", () => {
    const spent = { spentUnits: 100, windowStartedAt: 1_000 };
    expect(
      chargeUsage(spent, 1, 1_000 + limit.windowMs - 1, limit).allowed,
    ).toBe(false);
  });

  it("rolls the window over the moment it has fully elapsed", () => {
    const spent = { spentUnits: 100, windowStartedAt: 1_000 };
    const rolled = chargeUsage(spent, 40, 1_000 + limit.windowMs, limit);
    expect(rolled).toEqual({
      allowed: true,
      window: { spentUnits: 40, windowStartedAt: 1_000 + limit.windowMs },
      remainingUnits: 60,
    });
  });

  it("refuses a single charge larger than the whole allowance, even in a new window", () => {
    const result = chargeUsage(fresh(1_000), 101, 1_000, limit);
    expect(result.allowed).toBe(false);
    expect(result.window).toEqual(fresh(1_000));
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "refuses %p units, because only a real cost may be charged",
    (units) => {
      expect(() => chargeUsage(fresh(1_000), units, 1_000, limit)).toThrow(
        InvalidUsageChargeError,
      );
    },
  );

  it("ships named defaults so no caller has to invent a budget", () => {
    expect(DEFAULT_USAGE_LIMIT_UNITS).toBeGreaterThan(0);
    expect(DEFAULT_USAGE_WINDOW_MS).toBeGreaterThan(0);
  });
});
