/**
 * Who is allowed to spend, and how much. Every endpoint behind the gate costs
 * real provider credit, so an account is not a convenience feature: it is the
 * unit the spend is measured against. This file is pure. Randomness, hashing,
 * clocks and storage are the adapters' business.
 */

/** A person, identified by the address they proved they can read. */
export type Account = { id: string; email: string; createdAt: number };

export class InvalidEmailError extends Error {
  readonly code: string;

  constructor(message: string, code = "INVALID_EMAIL") {
    super(message);
    this.name = "InvalidEmailError";
    this.code = code;
  }
}

export class InvalidUsageChargeError extends Error {
  readonly code: string;

  constructor(message: string, code = "INVALID_USAGE_CHARGE") {
    super(message);
    this.name = "InvalidUsageChargeError";
    this.code = code;
  }
}

/** The longest address the mail RFCs allow; anything beyond it is noise. */
export const MAX_EMAIL_CHARACTERS = 254;

/**
 * One address, one account. Mailboxes are case-insensitive in practice, so the
 * stored form is lowercase: without that, two spellings of the same address
 * would be two accounts and two separate allowances.
 */
export function normalizeEmail(raw: string): string {
  const email = String(raw ?? "")
    .trim()
    .toLowerCase();
  const invalid = (reason: string) => new InvalidEmailError(reason);

  if (!email) throw invalid("Enter your email address.");
  if (email.length > MAX_EMAIL_CHARACTERS)
    throw invalid("That email address is too long.");
  if (/\s/.test(email))
    throw invalid("An email address cannot contain spaces.");

  const parts = email.split("@");
  if (parts.length !== 2) throw invalid("Enter a valid email address.");
  const [local, domain] = parts;
  if (!local || !domain) throw invalid("Enter a valid email address.");
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith("."))
    throw invalid("Enter a valid email address.");
  if (domain.includes("..")) throw invalid("Enter a valid email address.");

  return email;
}

/** How long a mailed sign-in code stays usable. */
export const DEFAULT_CODE_TTL_MS = 10 * 60 * 1000;
/** How many wrong codes a challenge survives before it is thrown away. */
export const DEFAULT_MAX_CODE_ATTEMPTS = 5;
/** Digits in a mailed code: short enough to retype, long enough to resist guessing. */
export const DEFAULT_CODE_LENGTH = 6;
/** How long a confirmed session lasts before the reader signs in again. */
export const DEFAULT_SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * A code is live until its lifetime has fully elapsed. The boundary is exact so
 * the rule reads the same to a test and to a reader watching a countdown.
 */
export function isCodeExpired(
  issuedAt: number,
  now: number,
  ttlMs: number,
): boolean {
  return now - issuedAt >= ttlMs;
}

export function codeAttemptsExhausted(attempts: number, max: number): boolean {
  return attempts >= max;
}

/** What one account has spent, and when the current allowance started. */
export type UsageWindow = { spentUnits: number; windowStartedAt: number };

/** The allowance itself: how much may be spent, over how long. */
export type UsageLimit = { limitUnits: number; windowMs: number };

export type UsageCharge = {
  allowed: boolean;
  window: UsageWindow;
  remainingUnits: number;
};

/** A budget generous enough for a real reading session, small enough to survive abuse. */
export const DEFAULT_USAGE_LIMIT_UNITS = 300;
export const DEFAULT_USAGE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * The spend cap. Signing in is only half the answer: whoever signs up can still
 * burn the budget, so every paid call is charged against a rolling allowance.
 *
 * The window rolls over only once it has fully elapsed, and a refused charge
 * leaves the ledger exactly as it found it — a caller who is over the cap must
 * not be able to push the window forward by hammering the endpoint.
 */
export function chargeUsage(
  window: UsageWindow,
  units: number,
  now: number,
  { limitUnits, windowMs }: UsageLimit,
): UsageCharge {
  if (!Number.isSafeInteger(units) || units <= 0)
    throw new InvalidUsageChargeError(
      "A usage charge must be a positive whole number of units.",
    );

  const expired = now - window.windowStartedAt >= windowMs;
  const current: UsageWindow = expired
    ? { spentUnits: 0, windowStartedAt: now }
    : window;

  const spent = current.spentUnits + units;
  if (spent > limitUnits)
    return {
      allowed: false,
      window,
      remainingUnits: Math.max(0, limitUnits - current.spentUnits),
    };

  return {
    allowed: true,
    window: { spentUnits: spent, windowStartedAt: current.windowStartedAt },
    remainingUnits: limitUnits - spent,
  };
}

/** When the allowance opens again, so a refusal can tell the reader how long to wait. */
export function usageWindowResetsAt(
  window: UsageWindow,
  { windowMs }: Pick<UsageLimit, "windowMs">,
): number {
  return window.windowStartedAt + windowMs;
}
