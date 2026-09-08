# AWS and local infrastructure

The web UI and API share one Next.js Lambda container and HTTP API. A second,
256 MB Lambda container retrieves YouTube transcripts over the same API. PDFs
upload directly to S3; no 25 MiB upload passes through API Gateway or Lambda's
synchronous invocation payload. Both containers use the exact commit tested by
CI. There is no always-on ECS task, NAT gateway, or load balancer. Costs still
include requests, logs, storage, Secrets Manager, and external AI usage.

API Gateway default-stage throttling targets 10 requests/second, burst 20.
POST session/connect/text-chat/upload-signing routes target 1 request/second,
burst 2. These are coarse AWS best-effort throttles, not strict per-user rate
limits or spending caps. Lambda reserved concurrency is 5 for app and 2 for
transcripts; the CloudFormation role has scoped Get/Put/DeleteFunctionConcurrency
permissions on those functions. The account must have enough regional concurrency
to reserve 7 while leaving AWS's required 100 unreserved. Active direct WebRTC
sessions continue incurring provider costs independently of Lambda concurrency.

See [the server contract](../SERVER-CONTRACT.md) before changing upload routes.
This infrastructure provisions the storage boundary; passing synth tests is not
evidence that the server upload flow, voice providers, or IAM deployment work live.

## Local iteration

From the repository root:

```sh
docker compose up --build -d --wait web
node infrastructure/scripts/smoke.mjs http://localhost:3000
docker compose --profile test run --build --rm test
```

The test container shares the web container's network namespace so browser tests
using localhost reach the running service. A transparent port-9002 forwarder
sends signed browser uploads to real MinIO while preserving Host/signatures.
It runs lint, types, unit tests, container-compatible BDD, and browser tests.
Browser installation and a production canary build are included in the image.
Scenarios tagged @host need the host Docker CLI and run in full host CI; only the
container runner excludes them. No Docker socket is mounted. @external gates
remain excluded and explicitly unverified in both local test modes.

For hot reload, stop production web before starting dev (both bind port 3000):

```sh
docker compose stop web
docker compose --profile dev up --build dev
```

Source is bind-mounted; node_modules and .next use separate volumes. After
dependency changes, refresh the dependency volume with
`docker compose --profile dev run --rm --no-deps dev npm ci`.
To test production again, stop dev and run the production commands above.
The web service serves both UI and API on 3000, transcript service uses 3010,
and MinIO uses public 9002 / console 9003. Old api/realtime-mock/transcript-mock
containers from the initial scaffold are obsolete; remove those specific
containers before starting the updated topology if they occupy ports.

By default the real transcript HTTP adapter connects to the Python service in
explicit mock mode. Enable upstream captions with
`TRANSCRIPT_MODE=live docker compose up -d --build web`.
Enable live OpenAI with `PROVIDER_MODE=live` and a locally supplied
`OPENAI_API_KEY`. WebRTC mock runs in-process and does not prove live audio.
MinIO credentials are development fixtures, never production credentials.

## One-time AWS setup

1. Select the account/region and create the OpenAI secret outside source control.
   Its JSON value must contain `OPENAI_API_KEY`; use Secrets Manager's default
   KMS key unless you also add scoped customer-key decrypt permissions.
2. Create GitHub environment **production**, restricting deployment branches to
   **main**. Require the **CI / required** check for merging to main. OIDC
   environment subjects do not encode a branch; the environment restriction
   and workflow push/main checks enforce that part of the boundary.
3. With an operator's short-lived AWS session, synthesize/deploy the bootstrap.
   Replace OWNER/REPO and the secret ARN with exact values:

```sh
npm ci --prefix infrastructure/cdk
npm run build --prefix infrastructure/cdk
npm test --prefix infrastructure/cdk
npm run synth --prefix infrastructure/cdk -- \
  -c bootstrap=true -c githubRepository=OWNER/REPO \
  -c openAiSecretArn=arn:aws:secretsmanager:REGION:ACCOUNT:secret:NAME-SUFFIX
aws cloudformation deploy \
  --stack-name TalkToADocumentBootstrap \
  --template-file infrastructure/cdk/cdk.out/TalkToADocumentBootstrap.template.json \
  --capabilities CAPABILITY_NAMED_IAM
```

If the account already has GitHub's OIDC provider, supply
`-c oidcProviderArn=arn:aws:iam::ACCOUNT:oidc-provider/token.actions.githubusercontent.com`.
This uses native CloudFormation resources and BootstraplessSynthesizer; no
default administrator CDK bootstrap role or custom-resource Lambda is needed.

Bootstrap creates two immutable ECR repositories, an exact-repository/environment
OIDC role, a dedicated CloudFormation execution role, and a runtime permissions
boundary. GitHub can push only to these repositories, deploy only the named
application stack, and pass only the CloudFormation role. CloudFormation can
manage the named functions, named roles, upload bucket, and log groups. Role
creation requires the boundary; it cannot remove that boundary or modify it.
Runtime S3 permissions are limited to uploads/*. PassRole is service-restricted.

Two AWS actions require Resource "*": ECR GetAuthorizationToken and Logs
DescribeLogGroups. API Gateway creates IDs at deployment, so its API management
scope is /apis and /apis/* in the selected region (and /tags/* for tagging),
not one preexisting API ID. Use a dedicated demo account/region if other HTTP
APIs must be isolated from the deployment role. No AdministratorAccess policy
or wildcard action is granted. Account SCPs and actual provider API permissions
still require a real deployment test.

Set GitHub production environment variables:
- AWS_REGION
- AWS_ROLE_ARN = bootstrap GitHubRoleArn output
- CFN_ROLE_ARN = bootstrap CloudFormationRoleArn output
- OPENAI_SECRET_ARN = same exact secret ARN used by bootstrap
- APP_ORIGIN only if adding a separate frontend origin; the API's generated
  origin is automatically included in S3 CORS.

## CI and deployment

CI runs mandatory lint/types/unit checks, local executable Gherkin, browser
tests, production build, dependency audit, CDK tests/synth, both Lambda image
builds, Compose startup and HTTP smoke checks. Failed, cancelled, skipped, or
pending required checks cannot produce a successful aggregate job.
The production build receives two clearly fake OpenAI/AWS secret canaries;
CI scans every file under .next/static and fails on either value, missing output,
or empty output. This verifies emitted client assets rather than source grep.
Mobile also has mandatory independent typecheck, unit tests, and iOS/Android
Expo bundle exports. Bundles do not prove native simulator installation/audio.
The mobile audit writes a downloadable JSON report and job summary, warning on
moderate/high findings and failing on critical findings. The known SDK-compatible
baseline has 20 findings (11 moderate, 9 high); this is explicitly not clean.
Scenarios explicitly tagged @external remain unverified release requirements;
excluding them from local CI does not mark them passed. Full release acceptance
(including live OpenAI/Hume, device audio, and deployed AWS) must be separately
executed with evidence. Local CI is not a release-completeness certificate.

Deploy only responds to successful CI push runs on this repository's main.
It checks out workflow_run.head_sha, verifies HEAD, uses that SHA for both
immutable image tags and the CDK imageTag, and deploys the synthesized template
through the scoped CloudFormation role. It never checks out moving main or
tags with the deployment workflow's GITHUB_SHA. Mandatory post-deploy checks
verify /api/health, HTML, direct S3 POST with a generated PDF containing a fresh
nonce, exact extracted content, and rejection when extracting the consumed key
again. Replay rejection is not a privileged S3 lifecycle/deletion audit. These
checks do not certify live WebRTC or all BDD gates.

GitHub credentials are OIDC sessions lasting at most an hour. No long-lived AWS
keys are stored in GitHub. Set branch protection/environment restrictions in
GitHub before treating the pipeline as enforced.

## Verification and limits

```sh
npm run build --prefix infrastructure/cdk
npm test --prefix infrastructure/cdk
npm run synth --prefix infrastructure/cdk -- -c imageTag=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
docker compose config --quiet
```

The repeated-a SHA is only a synth fixture, never an image to deploy. Tests
assert image tag validation, bounded timeouts, upload CORS, retained storage,
exact OIDC claims, immutable ECR tags, permissions boundary, and no custom
resource Lambda. Synthetic checks do not exercise AWS IAM authorization.

Uploads expire after one day; extraction should delete them immediately.
Buckets/ECR/logs are retained on stack deletion to avoid accidental data loss;
remove these resources explicitly when retiring the demo. YouTube can reject
AWS egress even though the service works locally; the UI must provide its
documented fallback/error. Synchronous extraction must complete within the
28-second Lambda timeout or return a useful timeout; no asynchronous extraction
job is included.

References: [Lambda invocation limits](https://docs.aws.amazon.com/cli/latest/reference/lambda/invoke.html)
and [AWS OIDC trust guidance](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-idp_oidc.html).
