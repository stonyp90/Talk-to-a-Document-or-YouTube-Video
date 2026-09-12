import { installAuthPepper } from "@/packages/adapters/src/accounts";
import { getAuthPepper } from "@/packages/adapters/src/secrets";

/**
 * What a deployment must have before it can sign anybody in, checked when the
 * server starts rather than discovered by the first reader who tries. The gate
 * fails shut, so a half-configured deployment does not look broken — it looks
 * like a product that refuses everyone, silently. This is the line that says so.
 */

export type AuthMode = "required" | "disabled";

/** Just the variables that are read here; `process.env` satisfies it. */
type Environment = Readonly<Record<string, string | undefined>>;

/**
 * Security-first: `disabled` must be spelled out, and anything else — unset,
 * misspelled, or a value from a half-written deployment script — means the gate
 * stays closed. A misconfigured deployment fails shut, never open.
 */
export const gateMode = (env: Environment = process.env): AuthMode =>
  env.AUTH_MODE === "disabled" ? "disabled" : "required";

/**
 * A laptop and a deployment are held to different standards, and the difference
 * is read rather than guessed: AWS names the function it is running, and a real
 * deployment runs in `live` provider mode because it is spending real credit.
 */
export const isDeployed = (env: Environment = process.env): boolean =>
  Boolean(env.AWS_LAMBDA_FUNCTION_NAME) || env.PROVIDER_MODE === "live";

export type ConfigurationReview = {
  /** Configuration keys by name. Never a value: these are secrets. */
  missing: string[];
  /** Whether sign-in should be refused rather than improvised. */
  fatal: boolean;
  /** One actionable line, or empty when there is nothing to say. */
  message: string;
};

const PEPPER = "AUTH_HASH_PEPPER (or AUTH_PEPPER_SECRET_ARN)";
const SENDER = "EMAIL_MODE=ses with SES_FROM_ADDRESS";

/**
 * Missing pepper: refuse, do not improvise.
 *
 * The alternative is the per-process pepper the accounts adapter falls back to,
 * and in a deployment that is worse than an honest refusal. Lambda runs many
 * short-lived instances: a reader would ask for a code on one, confirm it on
 * another, and be told the code is wrong — forever, with nothing in the logs to
 * explain it, every cold start quietly invalidating every outstanding code. A
 * refusal is at least legible, and it is legible in one place: here.
 *
 * It refuses the sign-in path, not the process. Exiting would take the reading
 * experience, the landing page and the smoke test down with it, which is the
 * outage this whole change exists to prevent. A laptop keeps the generated
 * pepper: there is nothing there to invalidate and no deployment to protect.
 *
 * A missing sender is loud but not fatal. The code still reaches a log an
 * operator can read, so refusing would cost more than it buys — but a one-time
 * code in CloudWatch is a code anyone with log access can use, so it is an
 * error, not a note.
 */
export function reviewSignInConfiguration(
  env: Environment = process.env,
): ConfigurationReview {
  const quiet = { missing: [], fatal: false, message: "" };
  if (gateMode(env) === "disabled") return quiet;

  const deployed = isDeployed(env);
  const missing: string[] = [];
  if (!env.AUTH_HASH_PEPPER && !env.AUTH_PEPPER_SECRET_ARN)
    missing.push(PEPPER);
  if (deployed && !(env.EMAIL_MODE === "ses" && env.SES_FROM_ADDRESS))
    missing.push(SENDER);
  if (!missing.length) return quiet;

  const fatal = deployed && missing.includes(PEPPER);
  return {
    missing,
    fatal,
    message: [
      `[auth] AUTH_MODE=required but ${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} not configured.`,
      fatal
        ? "Sign-in is refused until the pepper is set: a per-process pepper would invalidate every outstanding code on each restart."
        : "Readers may be unable to sign in, and a one-time code written to the server log is usable by anyone who can read the log.",
      "Set it through the deployment, never in the repository.",
    ].join(" "),
  };
}

export class SignInUnconfiguredError extends Error {
  readonly name = "SignInUnconfiguredError";
}

let pending: Promise<void> | undefined;
let announced = false;

async function applyConfiguration(): Promise<void> {
  const review = reviewSignInConfiguration();
  if (review.message && !announced) {
    announced = true;
    console.error(review.message);
  }
  if (review.fatal) throw new SignInUnconfiguredError(review.message);
  const pepper = await getAuthPepper();
  if (pepper) installAuthPepper(pepper);
}

/**
 * Runs once and is awaited by everything that hashes, so no code is ever hashed
 * against a pepper that is about to be replaced by the one from the secret
 * store. A failed secret read is not cached: a blip at the secret store must not
 * brick this instance for the rest of its life.
 */
export function ensureSignInConfigured(): Promise<void> {
  pending ??= applyConfiguration().catch((error: unknown) => {
    pending = undefined;
    throw error;
  });
  return pending;
}

/** Test seam: forgets the resolved configuration between cases. */
export function resetSignInConfiguration(): void {
  pending = undefined;
  announced = false;
}
