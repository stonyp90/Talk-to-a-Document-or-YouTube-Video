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
    // A deployment with no pepper and no sender comes up refusing every paid
    // endpoint with no way in. It must fail here, not in production.
    /test -n "\$AUTH_PEPPER_SECRET_ARN"/,
    /test -n "\$SES_FROM_ADDRESS"/,
  ])
    assert.match(workflow, pattern);
  // Only ARNs and names travel through the workflow; never a secret value.
  assert.doesNotMatch(workflow, /AUTH_HASH_PEPPER/);
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
    /coalesce\(var.github_subject_prefix, "repo:\$\{var.github_repository\}"\)\}:environment:production/,
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
  // Delete-then-create reaches the same end state as rewriting a trust policy,
  // which the omission of iam:UpdateAssumeRolePolicy exists to prevent, and the
  // account-level public access block is the backstop CI must not be able to
  // lift. The quoted form matches the exact action, not iam:DeleteRolePolicy.
  assert.doesNotMatch(policy, /"iam:DeleteRole"|AccountPublicAccessBlock/);
  assert.match(bootstrap, /resource "aws_s3_account_public_access_block"/);
  assert.match(policy, /demo\/terraform.tfstate.tflock/);
  const backend = read("infrastructure/terraform/environments/demo/main.tf");
  assert.match(backend, /use_lockfile\s*=\s*true/);
  assert.doesNotMatch(backend, /terraform_remote_state/);
});
test("transactional email is operator-owned and adds no CI authority", () => {
  const policy = read(
    "infrastructure/terraform/bootstrap/deployment-policy.tf",
  );
  assert.doesNotMatch(policy, /\bses:|sesv2|route53/i);
  assert.doesNotMatch(policy, /(email|domain)\/terraform\.tfstate/);
  const boundary = read("infrastructure/terraform/bootstrap/main.tf");
  assert.match(boundary, /"ses:SendEmail"/);
  assert.match(boundary, /ses:FromAddress/);
  const emailModule = read("infrastructure/terraform/modules/email/main.tf");
  assert.doesNotMatch(emailModule, /aws_route53_record|aws_iam_/);
  assert.match(emailModule, /RSA_2048_BIT/);
  assert.match(emailModule, /REJECT_MESSAGE/);
  assert.match(emailModule, /tls_policy\s*=\s*"REQUIRE"/);
  const emailRoot = read("infrastructure/terraform/environments/email/main.tf");
  assert.match(emailRoot, /key\s*=\s*"email\/terraform\.tfstate"/);
  assert.match(
    emailRoot,
    /v=DMARC1; p=\$\{var\.dmarc_policy\}; adkim=r; aspf=r; rua=mailto:\$\{var\.dmarc_rua\}/,
  );
  assert.match(
    emailRoot,
    /variable "dmarc_policy" \{[^}]*default\s*=\s*"quarantine"/,
  );
  // The import block and prevent_destroy are the whole of the protection for the
  // zone's pre-existing registrar DMARC record, and the root's own tftest proves
  // neither: it overrides that resource and exercises no import. Without the
  // block the first plan creates a name Route 53 already holds; without the
  // lifecycle rule a destroy drops the domain from quarantine to no policy at all.
  const dmarcImport = emailRoot.match(/import \{[\s\S]+?\n\}/)[0];
  assert.match(dmarcImport, /to\s*=\s*aws_route53_record\.dmarc\b/);
  assert.match(
    dmarcImport,
    /id\s*=\s*"\$\{local\.zone_id\}_\$\{local\.dmarc_name\}_TXT"/,
  );
  const dmarcRecord = emailRoot.match(
    /resource "aws_route53_record" "dmarc" \{[\s\S]+?\n\}/,
  )[0];
  assert.match(dmarcRecord, /prevent_destroy\s*=\s*true/);
  assert.match(
    emailRoot,
    /variable "dmarc_rua" \{\s*type\s*=\s*string\s*validation \{/,
  );
  // The root's own tftest proves how these two inputs behave; these checks only
  // catch a validation being deleted. Both inputs can weaken a live policy:
  // DMARC here uses relaxed alignment, so a permissive apex SPF record would
  // hand every sender on the internet a DMARC pass as ursly.io, and a reports
  // mailbox on a domain that receives no mail loses every aggregate report.
  const apexSpf = emailRoot.match(
    /variable "apex_spf_record" \{[\s\S]+?\n\}/,
  )[0];
  assert.match(apexSpf, /\(-\|~\)all\$/);
  assert.match(apexSpf, /\?all\|redirect=/);
  assert.match(apexSpf, /relaxed alignment/);
  const dmarcRua = emailRoot.match(/variable "dmarc_rua" \{[\s\S]+?\n\}/)[0];
  assert.match(dmarcRua, /_report\._dmarc/);
  const deploy = read(".github/workflows/deploy.yml");
  for (const name of [
    "SES_IDENTITY_ARN",
    "SES_CONFIGURATION_SET_NAME",
    "SES_FROM_ADDRESS",
  ])
    assert.match(
      deploy,
      new RegExp(
        `TF_VAR_${name.toLowerCase()}: \\$\\{\\{ vars\\.${name} \\}\\}`,
      ),
    );
  const ci = read(".github/workflows/ci.yml");
  assert.match(ci, /modules\/email test/);
  assert.match(ci, /environments\/email test/);
});
test("the browser may reach exactly the object store the deployment presigns to", () => {
  // A wildcard connect-src is an exfiltration channel for anything injected into
  // a page that still allows inline script, so the policy names one host. That
  // host is derived from two build args, and nothing else checks they arrive:
  // the deployment smoke test posts to S3 server-side and would not notice.
  const config = read("apps/web/next.config.ts");
  assert.doesNotMatch(config, /\*\.amazonaws\.com/);
  assert.match(
    config,
    /https:\/\/\$\{bucket\}\.s3\.\$\{region\}\.amazonaws\.com/,
  );
  const dockerfile = read("Dockerfile");
  for (const pattern of [
    /ARG UPLOAD_BUCKET/,
    /ENV UPLOAD_BUCKET=\$\{UPLOAD_BUCKET\}/,
    /ARG AWS_REGION/,
    /ENV AWS_REGION=\$\{AWS_REGION\}/,
  ])
    assert.match(dockerfile, pattern);
  const deploy = read(".github/workflows/deploy.yml");
  assert.match(
    deploy,
    /--build-arg UPLOAD_BUCKET="talk-to-a-document-uploads-\$TF_VAR_account_id-\$AWS_REGION"/,
  );
  assert.match(deploy, /--build-arg AWS_REGION="\$AWS_REGION"/);
  // The name the workflow passes has to be the bucket Terraform actually makes.
  const demo = read("infrastructure/terraform/modules/demo/main.tf");
  assert.match(demo, /name\s*=\s*"talk-to-a-document"/);
  assert.match(
    demo,
    /bucket\s*=\s*"\$\{local\.name\}-uploads-\$\{var\.account_id\}-\$\{var\.region\}"/,
  );
});
test("every expensive public route carries an explicit gateway throttle", () => {
  const demo = read("infrastructure/terraform/modules/demo/main.tf");
  const paid = demo.match(/paid_routes\s*=\s*toset\(\[[^\]]+\]\)/)[0];
  for (const route of [
    "POST /api/realtime/session",
    "POST /api/realtime/connect",
    "POST /api/text-chat",
    "POST /api/uploads",
    "POST /api/uploads/extract",
    "POST /api/ingest",
  ])
    assert.ok(paid.includes(route), `${route} must be throttled`);
  assert.match(
    demo,
    /throttled_routes\s*=\s*setunion\(local\.paid_routes, \["GET \/transcript\/\{videoId\}"\]\)/,
  );
  assert.match(demo, /for_each = local\.throttled_routes/);
  // The transcript route is throttled without being retargeted to the api
  // function: local.routes still maps it to the transcript integration.
  assert.match(demo, /"GET \/transcript\/\{videoId\}" = "transcript"/);
});
