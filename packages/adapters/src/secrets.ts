import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

export async function getOpenAiKey(): Promise<string> {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  if (process.env.OPENAI_SECRET_ARN) {
    const result = await new SecretsManagerClient({}).send(
      new GetSecretValueCommand({ SecretId: process.env.OPENAI_SECRET_ARN }),
    );
    const raw = result.SecretString;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { OPENAI_API_KEY?: string };
        if (parsed.OPENAI_API_KEY) return parsed.OPENAI_API_KEY;
      } catch {
        return raw;
      }
    }
  }
  throw new Error("OpenAI is not configured on the server.");
}
