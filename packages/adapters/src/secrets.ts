import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

/**
 * One way in for every server-side secret: an ARN in the environment, the value
 * fetched at runtime. The value itself never reaches a variable file, a saved
 * plan, Terraform state, a task definition, or a workflow log.
 *
 * A secret may hold a JSON document keyed by the variable name, or the bare
 * value; both are common in the console, and both work here.
 */
async function readSecret(
  arn: string,
  key: string,
): Promise<string | undefined> {
  const result = await new SecretsManagerClient({}).send(
    new GetSecretValueCommand({ SecretId: arn }),
  );
  const raw = result.SecretString;
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Record<string, string | undefined>;
    return parsed[key];
  } catch {
    return raw;
  }
}

export async function getOpenAiKey(): Promise<string> {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  if (process.env.OPENAI_SECRET_ARN) {
    const key = await readSecret(
      process.env.OPENAI_SECRET_ARN,
      "OPENAI_API_KEY",
    );
    if (key) return key;
  }
  throw new Error("OpenAI is not configured on the server.");
}

/**
 * The signing pepper, by the same route as the provider key. `undefined` means
 * nothing is configured — the composition root decides what that costs, because
 * the answer differs between a laptop and a deployment.
 */
export async function getAuthPepper(): Promise<string | undefined> {
  if (process.env.AUTH_HASH_PEPPER) return process.env.AUTH_HASH_PEPPER;
  if (!process.env.AUTH_PEPPER_SECRET_ARN) return undefined;
  return readSecret(process.env.AUTH_PEPPER_SECRET_ARN, "AUTH_HASH_PEPPER");
}
