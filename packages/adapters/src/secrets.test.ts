import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const aws = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: class {
    send = aws.send;
  },
  GetSecretValueCommand: class {
    constructor(readonly input: { SecretId: string }) {}
  },
}));

import { getAuthPepper, getOpenAiKey } from "./secrets";

const ARN = "arn:aws:secretsmanager:us-east-1:123456789012:secret:pepper-abc";

describe("reading server-side secrets by ARN", () => {
  const original = process.env;

  beforeEach(() => {
    process.env = { ...original };
    delete process.env.AUTH_HASH_PEPPER;
    delete process.env.AUTH_PEPPER_SECRET_ARN;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_SECRET_ARN;
    aws.send.mockReset();
  });

  afterEach(() => {
    process.env = original;
  });

  it("prefers a pepper set directly, and never calls the secret store for it", async () => {
    process.env.AUTH_HASH_PEPPER = "from-the-environment";
    process.env.AUTH_PEPPER_SECRET_ARN = ARN;

    await expect(getAuthPepper()).resolves.toBe("from-the-environment");
    expect(aws.send).not.toHaveBeenCalled();
  });

  it("reads the pepper out of a JSON secret keyed by its variable name", async () => {
    process.env.AUTH_PEPPER_SECRET_ARN = ARN;
    aws.send.mockResolvedValue({
      SecretString: JSON.stringify({ AUTH_HASH_PEPPER: "from-json" }),
    });

    await expect(getAuthPepper()).resolves.toBe("from-json");
    expect(aws.send.mock.calls[0]?.[0].input).toEqual({ SecretId: ARN });
  });

  it("accepts a secret stored as the bare value", async () => {
    process.env.AUTH_PEPPER_SECRET_ARN = ARN;
    aws.send.mockResolvedValue({ SecretString: "a-bare-pepper" });

    await expect(getAuthPepper()).resolves.toBe("a-bare-pepper");
  });

  it("reports nothing configured rather than inventing a pepper", async () => {
    await expect(getAuthPepper()).resolves.toBeUndefined();
    expect(aws.send).not.toHaveBeenCalled();
  });

  it("still resolves the provider key by the same route", async () => {
    process.env.OPENAI_SECRET_ARN = ARN;
    aws.send.mockResolvedValue({
      SecretString: JSON.stringify({ OPENAI_API_KEY: "sk-fixture" }),
    });

    await expect(getOpenAiKey()).resolves.toBe("sk-fixture");
  });

  it("refuses to pretend the provider is configured when it is not", async () => {
    await expect(getOpenAiKey()).rejects.toThrow(/not configured/);
  });
});
