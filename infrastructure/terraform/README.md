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
- `modules/email/`: reusable SES module for transactional mail (domain identity with
  2048-bit Easy DKIM, custom MAIL FROM, TLS-required configuration set, CloudWatch
  bounce/complaint events and alarms on the account-level bounce and complaint rates
  at the AWS review thresholds). It creates no DNS and no IAM: it outputs the records.
- `environments/domain/`: operator-owned root owning the `ursly.io` custom domain
  and apex alias. CI cannot read this state or change DNS.
- `environments/email/`: operator-owned root that applies `modules/email`, publishes
  its DKIM and MAIL FROM records in the existing hosted zone and adopts the zone's
  existing DMARC record. The account already holds SES production access; [its
  README](environments/email/README.md) records what was verified against AWS.

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
for target in bootstrap modules/demo modules/email environments/demo environments/domain environments/email; do
  terraform -chdir="infrastructure/terraform/$target" init -backend=false -lockfile=readonly
  terraform -chdir="infrastructure/terraform/$target" validate
done
terraform -chdir=infrastructure/terraform/bootstrap test
terraform -chdir=infrastructure/terraform/modules/demo test
terraform -chdir=infrastructure/terraform/modules/email test
terraform -chdir=infrastructure/terraform/environments/email test
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

| Variable                     | Value                                                             |
| ---------------------------- | ----------------------------------------------------------------- |
| `AWS_REGION`                 | Bootstrap region                                                  |
| `AWS_ACCOUNT_ID`             | Intended 12-digit AWS account                                     |
| `AWS_ROLE_ARN`               | Bootstrap `github_role_arn` output                                |
| `TF_STATE_BUCKET`            | Bootstrap `state_bucket` output                                   |
| `OPENAI_SECRET_ARN`          | Exact pre-existing provider secret ARN                            |
| `APP_ORIGIN`                 | Optional additional browser origin; defaults to local development |
| `SES_IDENTITY_ARN`           | Optional; `environments/email` `identity_arn` output              |
| `SES_CONFIGURATION_SET_NAME` | Optional; that root's `configuration_set_name` output             |
| `SES_FROM_ADDRESS`           | Optional; the single mailbox the api function may send as         |

Leave the three `SES_` variables unset until the email root is applied and bootstrap
has been re-applied with all three of the identity, the configuration set and the
From address: the runtime permissions boundary pins that one sender and caps SES away
otherwise, so an unset deployment carries no email permission and behaves as it does
today. The three variables must match what bootstrap was applied with, or the send
asks for a permission the boundary denies.

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
`iam:UpdateAssumeRolePolicy` is deliberately absent from the deployment policy:
IAM has no condition key for the contents of a trust policy, so that action on a
runtime role is a way to take the role itself. Terraform needs it only to correct
drift, which an operator repairs by hand.

What none of that caps is sending volume. The deploy role ships the code the api
function runs, so once `environments/email` and bootstrap have been applied with an
identity, a holder of that role can cause mail as the one pinned From address, up to
the account's shared SES quota, and the bounces or complaints it earns land on the
account-and-region reputation every identity in that region shares. The boundary
pins who the mail is from, not how much of it there is; the account-level bounce and
complaint alarms in `modules/email` are what bounds the rest.

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
