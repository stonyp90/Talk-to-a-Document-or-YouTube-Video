# AWS infrastructure (Terraform only)

This replaces CDK; do not deploy the old CloudFormation templates as well.
The migration changes local source only. No AWS resources have been imported,
created, replaced, or deleted by this change.

## Structure and authority

- `bootstrap/`: operator-owned ECR repositories, GitHub OIDC identity and deploy
  role, runtime permissions boundary, and versioned encrypted private state bucket.
- `modules/demo/`: reusable AWS application module (two Docker Lambdas, HTTP API,
  private temporary-upload bucket, per-function IAM roles and seven-day logs).
- `environments/demo/`: deployable root; only this state is writable by GitHub CI.

No VPC, NAT Gateway, ALB, ECS service, Step Functions, or persistent database is
required for the intermittent demo. Lambda scales to zero; existing memory,
timeouts, concurrency caps and HTTP throttles are preserved. This is a cost
rationale, not a guarantee of zero cost. Provider/model requests still cost money.
The demo API remains public; throttling is not authentication. Use an isolated
demo account and budget monitoring. Add authentication before production use.

Use Terraform **1.14.7** (pinned in CI) and the committed AWS provider lockfiles.
Local CI uses `terraform test` with mocked providers; it never needs AWS credentials.
These tests verify planned configuration, not real AWS authorization or deployment.

```sh
terraform fmt -check -recursive infrastructure/terraform
for target in bootstrap modules/demo environments/demo; do
  terraform -chdir="infrastructure/terraform/$target" init -backend=false -lockfile=readonly
  terraform -chdir="infrastructure/terraform/$target" validate
done
terraform -chdir=infrastructure/terraform/bootstrap test
terraform -chdir=infrastructure/terraform/modules/demo test
node --test infrastructure/tests/*.test.cjs
```

## First deployment: operator bootstrap

First check whether matching resources or a CDK deployment already exist. If they
do, follow the migration section below **before any apply**. Bootstrap needs an
operator's authorized AWS SSO session, never permanent access keys in GitHub.
Create the provider secret outside Terraform; supply its exact ARN, never its
value. A customer-managed KMS key would need an explicitly scoped decrypt grant;
the current contract assumes the standard Secrets Manager encryption key.

Read `gh api repos/OWNER/REPO/actions/oidc/customization/sub --jq .sub_claim_prefix`
and set `github_subject_prefix` to that exact value. New GitHub repositories use
immutable owner/repository IDs in this prefix. Do not guess it from the repository
name. See [GitHub OIDC subject formats](https://docs.github.com/en/actions/reference/security/oidc).

```sh
cp infrastructure/terraform/bootstrap/terraform.tfvars.example infrastructure/terraform/bootstrap/terraform.tfvars
# Edit region, intended account ID, repository, existing secret ARN and OIDC ARN.
terraform -chdir=infrastructure/terraform/bootstrap init
terraform -chdir=infrastructure/terraform/bootstrap plan -out=bootstrap.tfplan
# Review the plan using the operator identity, then explicitly authorize apply:
terraform -chdir=infrastructure/terraform/bootstrap apply bootstrap.tfplan
terraform -chdir=infrastructure/terraform/bootstrap output
```

Protect the initial local state immediately. Copy `bootstrap/backend.tf.example`
to `bootstrap/backend_override.tf` (ignored by Git), then migrate using the
`state_bucket` output:

```sh
terraform -chdir=infrastructure/terraform/bootstrap init -migrate-state \
  -backend-config="bucket=YOUR_STATE_BUCKET" -backend-config="region=YOUR_REGION"
```

Bootstrap uses `bootstrap/terraform.tfstate`; CI uses `demo/terraform.tfstate`.
Never grant CI bootstrap-state access, share their state key, or use a Terraform
workspace to switch these roots. Keep a secure state backup. State files and
saved plans can contain sensitive data and must not be committed or published
as workflow artifacts. Backend versioning allows recovery; native S3 lockfiles
serialize mutations. See [HashiCorp's S3 backend documentation](https://developer.hashicorp.com/terraform/language/backend/s3).

## GitHub setup and deployment

Before enabling deploys, configure the GitHub `production` environment to allow
**only main**, disallow administrator bypass where supported, and require review.
Protect main with PR review and the `CI / required` check. The OIDC environment
subject does not itself encode a branch; the environment restriction is mandatory.
These repository settings require owner access and are not silently changed here.

Set these production environment **variables** (none contain secret values):

| Variable                 | Value                                                             |
| ------------------------ | ----------------------------------------------------------------- |
| `AWS_REGION`             | Bootstrap region                                                  |
| `AWS_ACCOUNT_ID`         | Intended 12-digit AWS account                                     |
| `AWS_ROLE_ARN`           | Bootstrap `github_role_arn` output                                |
| `TF_STATE_BUCKET`        | Bootstrap `state_bucket` output                                   |
| `OPENAI_SECRET_ARN`      | Exact pre-existing provider secret ARN                            |
| `AUTH_PEPPER_SECRET_ARN` | Exact pre-existing sign-in pepper secret ARN                      |
| `SES_FROM_ADDRESS`       | Verified SES sender for sign-in codes                             |
| `SES_REGION`             | Optional; empty means the deployment region                       |
| `SES_CONFIGURATION_SET`  | Optional SES configuration set name                               |
| `APP_ORIGIN`             | Optional additional browser origin; defaults to local development |

`AUTH_PEPPER_SECRET_ARN` and `SES_FROM_ADDRESS` are checked by `test -n` before
any AWS call, exactly as `OPENAI_SECRET_ARN` is. A deployment missing either
fails as a red workflow and production keeps serving the previous image.

## Sign-in: what an operator must do by hand

The application gate fails shut: an unset or unrecognised `AUTH_MODE` means
`required`, and Terraform defaults it to `required` too. A deployment that comes
up without these refuses every paid endpoint **and** cannot sign anybody in, so
the four steps below are prerequisites, not follow-up work. Terraform performs
none of them: it consumes their results.

1. **Create the pepper secret.** In Secrets Manager, in the deployment account
   and region, create a secret holding a high-entropy value — either the bare
   value or a JSON document `{"AUTH_HASH_PEPPER": "…"}`. Never commit it, never
   put it in a `.tfvars` file, never paste it into a workflow. Keep the ARN.
   _If missing:_ the deploy workflow fails at the configuration check. Were it
   ever to reach the task, the application refuses sign-in rather than generate
   a per-process pepper, because a pepper that changes on every cold start
   invalidates every outstanding code and reads as "your code is wrong".
2. **Verify the sender in SES**, in the sending region, as a domain identity or
   a single address identity, and publish the DKIM records in the operator-owned
   DNS root. _If missing:_ SES answers 403 and no code is ever delivered.
3. **Leave the SES sandbox.** Request production access for the sending region.
   _If missing:_ SES accepts only pre-verified recipients, so every reader who
   is not already verified asks for a code that never arrives, with nothing in
   the application log to explain it.
4. **Re-run bootstrap with the new variables.** The runtime permissions boundary
   is operator-owned, and effective permissions are the intersection of the
   boundary and the grant. Set `auth_pepper_secret_arn` and `ses_from_address`
   (and `ses_region` / `ses_configuration_set` if used) in
   `bootstrap/terraform.tfvars`, then plan and apply with the operator identity.
   _If missing:_ this is the dangerous one. The deploy succeeds, the task comes
   up, and the first sign-in fails with an AWS `AccessDenied` on the secret read
   or the send — configuration that looks correct everywhere but in IAM.

Do all four before setting the GitHub variables, and set the GitHub variables
before the change merges.

The gate, the allowance and the mail mode are Terraform variables with safe
defaults (`auth_mode = "required"`, `usage_limit_units = 300`,
`usage_window_ms = 86400000`, `email_mode = "ses"`) and are deliberately not
wired to GitHub variables: opening the gate or silencing real mail in production
takes a reviewed change, not an edit to a repository setting.

The deploy workflow runs only after successful CI for a push to main in this
repository. It checks out the exact tested SHA, exchanges GitHub OIDC for a
one-hour AWS session, pushes immutable SHA-tagged images to both ECR repositories,
initializes only demo state, creates a saved plan, applies that exact plan, and
runs mandatory PDF/upload/replay-cleanup HTTP smoke tests against Terraform's URL.
PRs validate and mock-test infrastructure without cloud credentials. CI blocks
merging unless application, BDD, browser, container, mobile and Terraform jobs pass.

The deploy role cannot change its own identity, the boundary, ECR policies, the
state bucket configuration, or provider secrets. Runtime roles are exact-name
scoped and can only be created with the operator-owned boundary. Only Lambda
may receive those roles through PassRole. The transcript role only writes logs.
Global-resource exceptions are ECR login and log-group discovery. API Gateway
management is region-wide under `/apis` and `/tags` because AWS assigns API IDs;
do not describe it as exact-resource isolation. Use a dedicated demo account.

## Existing CDK resources: operator-reviewed migration

Do not apply Terraform over active CloudFormation ownership. The removed CDK
source remains recoverable from Git history; removing source does not delete AWS.

1. Pause the old deployment workflow. Inventory the actual stack resources,
   physical IDs, policies, outputs and tags using an operator identity; save the
   deployed template and a state inventory. Do not infer IDs from this source.
2. In the old CloudFormation stack, explicitly set and verify **Retain** for
   every resource being transferred, then remove those resources from its
   template. This includes IAM roles, API routes/stages/integrations/permissions,
   log groups and bucket subresources—not only the buckets. Verify they still
   exist and are no longer managed by that stack. This is a separately approved
   operational change, not something CI performs.
3. Import each retained object into the appropriate Terraform address. Examples
   of address patterns are `aws_ecr_repository.images["api"]` in bootstrap and
   `module.demo.aws_lambda_function.runtime["api"]` in demo. Resolve each AWS
   provider import ID from the real inventory and provider docs; do not blindly
   copy IDs or import existing resources into two states.
4. Import bucket policy/encryption/CORS/lifecycle/public-access controls separately;
   import roles and inline policies separately. If the GitHub OIDC provider is
   shared, pass `existing_oidc_provider_arn` instead of taking ownership of it.
5. Run and review plans until they contain no unintended destroy/recreate changes.
   Match API IDs so public URLs do not change; reconcile tags and policy names.
   New state storage, the Terraform deployment policy, and the extra upload
   extraction throttle are intentional changes to review.
6. Migrate bootstrap state to its own S3 key. Update GitHub variables/environment
   protection, then authorize the first Terraform deployment and smoke test it.
   Retire the old CloudFormation execution role only after rollback needs are met.

No universal import script is supplied because the existing deployment inventory
and ownership are not known. `prevent_destroy` protects state, ECR, upload buckets
and logs during ordinary plans; it does not protect resources removed from
configuration or deleted outside Terraform. Teardown is operator-reviewed.

## Recovery and limitations

Roll back by reviewing a Terraform plan using a previously tested full SHA whose
immutable images are still in ECR, not by rebuilding a mutable tag. Avoid lifecycle
rules that delete rollback images prematurely. Restore state only with the
operator identity after checking there is no active run; never casually force-unlock.

Mock-provider tests are described in [Terraform's testing documentation](https://developer.hashicorp.com/terraform/language/tests/mocking).
They do not certify AWS quotas, deploy-role authorization against a real account,
live model/audio behavior, or cloud-IP caption availability. New accounts may need
a Lambda concurrency quota increase for the bounded reserved concurrency settings.
