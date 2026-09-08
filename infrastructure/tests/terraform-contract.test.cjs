const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const root = resolve(__dirname, "../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

// Fast repository wiring checks complement, not replace, terraform validate/test.
test("deploy only the successful, same-repository main revision through OIDC", () => {
  const workflow = read(".github/workflows/deploy.yml");
  for (const pattern of [
    /head_repository.full_name == github.repository/,
    /head_branch == 'main'/,
    /conclusion == 'success'/,
    /environment: production/,
    /id-token: write/,
    /role-duration-seconds: 3600/,
    /terraform.* plan .*out=deployment.tfplan/,
    /terraform.* apply .*deployment.tfplan/,
  ])
    assert.match(workflow, pattern);
  assert.doesNotMatch(
    workflow,
    /cloudformation|cdk|terraform.*bootstrap|aws-access-key-id|aws-secret-access-key/,
  );
  assert.match(
    read(".github/workflows/ci.yml"),
    /needs: \[application, containers, mobile, infrastructure, secrets\]/,
  );
});
test("bootstrap separates deployment authority and protects state", () => {
  const bootstrap = read("infrastructure/terraform/bootstrap/main.tf");
  const policy = read(
    "infrastructure/terraform/bootstrap/deployment-policy.tf",
  );
  assert.match(
    bootstrap,
    /repo:\$\{var.github_repository\}:environment:production/,
  );
  assert.match(
    bootstrap,
    /token.actions.githubusercontent.com:aud.*sts.amazonaws.com/,
  );
  assert.match(bootstrap, /status\s*=\s*"Enabled"/);
  assert.match(policy, /iam:PermissionsBoundary/);
  assert.match(policy, /iam:PassedToService.*lambda.amazonaws.com/);
  assert.doesNotMatch(
    policy,
    /iam:DeleteRolePermissionsBoundary|iam:AttachRolePolicy|iam:CreatePolicyVersion|secretsmanager:GetSecretValue/,
  );
  assert.match(policy, /demo\/terraform.tfstate.tflock/);
  const backend = read("infrastructure/terraform/environments/demo/main.tf");
  assert.match(backend, /use_lockfile\s*=\s*true/);
  assert.doesNotMatch(backend, /terraform_remote_state/);
});
