import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const secrets = vi.hoisted(() => ({ getAuthPepper: vi.fn() }));
const adapters = vi.hoisted(() => ({ installAuthPepper: vi.fn() }));

vi.mock("@/packages/adapters/src/secrets", () => secrets);
vi.mock("@/packages/adapters/src/accounts", () => adapters);

import {
  ensureSignInConfigured,
  gateMode,
  isDeployed,
  resetSignInConfiguration,
  reviewSignInConfiguration,
} from "./startup";

/** A deployment: AWS names the function, and provider calls are real. */
const deployed = {
  AWS_LAMBDA_FUNCTION_NAME: "talk-to-a-document-api",
  PROVIDER_MODE: "live",
};

const configured = {
  ...deployed,
  AUTH_PEPPER_SECRET_ARN:
    "arn:aws:secretsmanager:us-east-1:123456789012:secret:pepper-abcdef",
  EMAIL_MODE: "ses",
  SES_FROM_ADDRESS: "no-reply@example.test",
};

describe("reading the gate mode", () => {
  it("treats anything but an explicit disabled as required", () => {
    for (const AUTH_MODE of [undefined, "", "requred", "REQUIRED", "Disabled"])
      expect(gateMode({ AUTH_MODE })).toBe("required");
    expect(gateMode({ AUTH_MODE: "disabled" })).toBe("disabled");
  });

  it("recognises a deployment by AWS's own signals, not by a guess", () => {
    expect(isDeployed({})).toBe(false);
    expect(isDeployed({ PROVIDER_MODE: "mock" })).toBe(false);
    expect(isDeployed({ PROVIDER_MODE: "live" })).toBe(true);
    expect(isDeployed({ AWS_LAMBDA_FUNCTION_NAME: "api" })).toBe(true);
  });
});

describe("reviewing the sign-in configuration", () => {
  it("says nothing when the gate is deliberately open", () => {
    const review = reviewSignInConfiguration({
      ...deployed,
      AUTH_MODE: "disabled",
    });
    expect(review).toEqual({ missing: [], fatal: false, message: "" });
  });

  it("says nothing when a deployment is fully configured", () => {
    expect(reviewSignInConfiguration(configured).message).toBe("");
  });

  it("names the missing pepper and refuses, rather than improvising one", () => {
    const review = reviewSignInConfiguration({
      ...configured,
      AUTH_PEPPER_SECRET_ARN: undefined,
    });
    expect(review.fatal).toBe(true);
    expect(review.missing).toEqual([
      "AUTH_HASH_PEPPER (or AUTH_PEPPER_SECRET_ARN)",
    ]);
    expect(review.message).toMatch(/AUTH_PEPPER_SECRET_ARN/);
    expect(review.message).toMatch(/refused/);
  });

  it("accepts either route to the pepper", () => {
    expect(
      reviewSignInConfiguration({
        ...configured,
        AUTH_PEPPER_SECRET_ARN: undefined,
        AUTH_HASH_PEPPER: "a-value",
      }).message,
    ).toBe("");
  });

  it("names a deployment with no sender, but does not refuse over it", () => {
    const review = reviewSignInConfiguration({
      ...configured,
      EMAIL_MODE: "log",
      SES_FROM_ADDRESS: undefined,
    });
    expect(review.fatal).toBe(false);
    expect(review.missing).toEqual(["EMAIL_MODE=ses with SES_FROM_ADDRESS"]);
    expect(review.message).toMatch(/server log/);
  });

  it("lets a laptop run on the log notifier and a generated pepper", () => {
    const review = reviewSignInConfiguration({ EMAIL_MODE: "log" });
    expect(review.fatal).toBe(false);
    expect(review.missing).toEqual([
      "AUTH_HASH_PEPPER (or AUTH_PEPPER_SECRET_ARN)",
    ]);
  });

  it("never repeats a configured value, only the names of what is missing", () => {
    const review = reviewSignInConfiguration({
      ...configured,
      AUTH_PEPPER_SECRET_ARN: undefined,
      SES_FROM_ADDRESS: "somebody@example.test",
      EMAIL_MODE: "log",
    });
    expect(review.message).not.toMatch(/somebody@example.test/);
    expect(review.message).not.toMatch(/talk-to-a-document-api/);
  });
});

describe("applying the configuration at startup", () => {
  const original = process.env;

  beforeEach(() => {
    process.env = { ...original };
    resetSignInConfiguration();
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = original;
    vi.restoreAllMocks();
  });

  it("installs the pepper it reads from the secret store, once", async () => {
    Object.assign(process.env, configured);
    secrets.getAuthPepper.mockResolvedValue("from-secrets-manager");

    await ensureSignInConfigured();
    await ensureSignInConfigured();

    expect(adapters.installAuthPepper).toHaveBeenCalledTimes(1);
    expect(adapters.installAuthPepper).toHaveBeenCalledWith(
      "from-secrets-manager",
    );
    expect(secrets.getAuthPepper).toHaveBeenCalledTimes(1);
  });

  it("refuses a deployment with no pepper, and never reads the store", async () => {
    Object.assign(process.env, configured, {
      AUTH_PEPPER_SECRET_ARN: undefined,
    });

    await expect(ensureSignInConfigured()).rejects.toThrow(
      /AUTH_PEPPER_SECRET_ARN/,
    );
    expect(secrets.getAuthPepper).not.toHaveBeenCalled();
    expect(adapters.installAuthPepper).not.toHaveBeenCalled();
  });

  it("logs the one actionable line, and does not repeat it", async () => {
    Object.assign(process.env, configured, { EMAIL_MODE: "log" });
    secrets.getAuthPepper.mockResolvedValue("from-secrets-manager");

    await ensureSignInConfigured();
    await ensureSignInConfigured();

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(vi.mocked(console.error).mock.calls[0]?.[0]).toMatch(
      /SES_FROM_ADDRESS/,
    );
  });

  it("retries after a blip at the secret store rather than bricking the instance", async () => {
    Object.assign(process.env, configured);
    secrets.getAuthPepper
      .mockRejectedValueOnce(new Error("throttled"))
      .mockResolvedValue("from-secrets-manager");

    await expect(ensureSignInConfigured()).rejects.toThrow("throttled");
    await expect(ensureSignInConfigured()).resolves.toBeUndefined();
    expect(adapters.installAuthPepper).toHaveBeenCalledWith(
      "from-secrets-manager",
    );
  });

  it("leaves the generated pepper alone when nothing is configured locally", async () => {
    process.env.AUTH_MODE = "disabled";
    secrets.getAuthPepper.mockResolvedValue(undefined);

    await ensureSignInConfigured();

    expect(adapters.installAuthPepper).not.toHaveBeenCalled();
  });
});
