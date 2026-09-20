import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

// Canary rollback: sets canary_weight to 0 in the Terraform state so all
// traffic returns to the stable Lambda versions. Call this manually or let
// the deploy workflow's ERR trap invoke it on canary failure.
//
// Usage:
//   node infrastructure/scripts/canary-rollback.mjs [tf-directory]
//
// The directory defaults to infrastructure/terraform/environments/demo.
// Terraform must already be initialised in that directory, and AWS
// credentials must be configured (e.g. via OIDC in the deploy workflow).

const tfDir = resolve(process.argv[2] || "infrastructure/terraform/environments/demo");

console.log(`[canary-rollback] Setting canary_weight=0 in ${tfDir}`);

try {
  // execFileSync bypasses the shell, so the directory path cannot inject
  // metacharacters even if it came from an untrusted source.
  execFileSync("terraform", [
    `-chdir=${tfDir}`, "apply",
    "-input=false", "-lock-timeout=5m", "-auto-approve",
    '-var=canary_weight=0',
  ], {
    stdio: "inherit",
    env: { ...process.env, TF_VAR_canary_weight: "0" },
  });
  console.log("[canary-rollback] Rollback complete — all traffic on stable version");
} catch (error) {
  console.error("[canary-rollback] Rollback failed:", error.message);
  console.error("[canary-rollback] Manual intervention may be required:");
  console.error(`  TF_VAR_canary_weight=0 terraform -chdir=${tfDir} apply -auto-approve`);
  process.exit(1);
}
