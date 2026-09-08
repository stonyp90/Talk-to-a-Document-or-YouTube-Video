# Verification and release gates

The requirement-by-requirement inventory is in `PLAN.md`. A feature file is a
specification, not evidence of completion. Pending and undefined Gherkin steps
fail the applicable test run. Never count controlled media fixtures as real
two-way voice verification.

## Terraform / hexagonal migration verification (2026-09-07)

Verified locally after restructuring: lint and strict typechecking; **78**
application/domain/adapter/architecture tests; **64** local Gherkin scenarios
and **361** steps; **22** browser regressions; **3** infrastructure wiring and
client-secret regression tests; and **5** Terraform mock-provider test runs.
All three Terraform roots validate with Terraform 1.14.7 and locked AWS 6.63.0.
The native package also passed typechecking and all 18 tests present in the tree.

The production web build and 11-asset fake-secret scan passed. A fresh Docker
Compose project, `talk-hexagonal-check`, ran the migrated application on port
3015 with its own transcript service (3025) and MinIO (9012/9013). Real PDF
upload/extraction, consumed-upload replay rejection, captions and text fallback
passed against that isolated stack. Existing demo containers were not restarted.
The temporary test stack was stopped afterward; its named volume and image cache
were retained, and the main demo stack was left running.

No AWS apply/import, GitHub push, deployment, live audio verification or simulator
permission changes were performed for this migration. Terraform tests use mocked
providers only; they do not establish real-account IAM authorization or quotas.
The existing 33 external release scenarios remain separate, unverified gates.
See `ARCHITECTURE.md` and `infrastructure/terraform/README.md` for the new structure,
OIDC/bootstrap setup and operator-reviewed CDK retain/import migration.

## Historical evidence before the migration

Pre-migration serialized host verification (2026-09-07): lint/typecheck passed, 66 web
unit/component tests passed, 62 local Gherkin scenarios / 348 steps passed,
22 browser tests passed, 14 infrastructure tests passed after the CDK upgrade,
and 12 native unit tests plus native typecheck passed. Production build and
fake-secret scan passed across 11 client assets. Real PDF upload/extraction/
cleanup smoke passed. Web and infrastructure audits report zero findings;
native audit remains 20 (11 moderate, 9 high).

Full Gherkin inventory: 95 scenarios, 62 passed and 33 external pending; the full
command correctly exits nonzero. Both updated CDK stacks synthesize locally.

The container-only runner also passed lint/typecheck, 66 unit/component tests,
52 non-host Gherkin scenarios / 292 steps, and 22 browser tests. Docker dev mode
served a temporary probe, hot-reloaded its changed response without restart,
and passed the real PDF smoke. The probe was removed and production mode restored.

| Area                                                                 | Implementation and evidence                                                             | Remaining release evidence                                              |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| PDF ≤25 MB, selectable text, page order, preview                     | Server parser tests, real PDF browser upload through MinIO, deployment smoke script     | Run the same smoke on the public AWS URL                                |
| YouTube captions                                                     | Python service, provider tests, successful local live retrieval, deterministic UI tests | Record local live demonstration; classify any AWS blocking              |
| Full source context                                                  | Bounded direct context with no summarization; unit and API assertions                   | Source-specific live answers                                            |
| Microphone, spoken answers, live transcripts, interruption/follow-up | WebRTC client and controlled transport/event tests                                      | Real OpenAI session with microphone and audible output                  |
| Text fallback and mobile controls                                    | Browser tests including denied permission, input and error states                       | Real-device audio permissions and playback                              |
| Poor network                                                         | Controlled timeouts, disconnection, recovery, cancellation and cleanup tests            | Live network degradation demonstration                                  |
| Secrets                                                              | Server-issued credentials, fake-secret production-bundle scanner, scoped IAM tests      | Actual OIDC deployment and production-secret configuration              |
| Public app and repository                                            | AWS/CDK and GitHub Actions configuration                                                | Repository destination/access, bootstrap, main push, deployment URL     |
| Local services                                                       | Healthy rebuilt Compose web/API, captions, object storage; host regression suite passed | Dev/test container profiles verified separately                         |
| Native companion                                                     | Expo source, API adapter, unit tests, platform exports, installed iOS mock UI journey   | Native PDF picker through S3, Android runtime and live audio acceptance |
| Documentation and walkthrough                                        | README, environment sample, architecture docs, timed walkthrough script, AI disclosure  | Completed 10–15 minute recording and delivery links                     |

## Reproduce local checks

Use Node 22+, Docker Desktop and the Chromium browser installed by Playwright.
No real provider key is necessary for deterministic checks.

```sh
npm ci
terraform -chdir=infrastructure/terraform/bootstrap init -backend=false
npm run lint
npm run typecheck
npm test
npx playwright install chromium
docker compose up -d --build --wait web
OPENAI_API_KEY=ci_canary_OPENAI_clearlyfakefixture_2026 AWS_SECRET_ACCESS_KEY=ci_canary_AWS_clearlyfakefixture_2026 npm run build
OPENAI_API_KEY=ci_canary_OPENAI_clearlyfakefixture_2026 AWS_SECRET_ACCESS_KEY=ci_canary_AWS_clearlyfakefixture_2026 node infrastructure/scripts/check-client-secrets.mjs
npm run test:gherkin -- --tags 'not @external'
npm run test:e2e -- --workers=1
node infrastructure/scripts/smoke.mjs http://localhost:3000
node --test infrastructure/tests/*.test.cjs
terraform -chdir=infrastructure/terraform/bootstrap test
terraform -chdir=infrastructure/terraform/modules/demo test
npm run typecheck --prefix apps/mobile
npm test --prefix apps/mobile
```

Install the native workspace dependencies separately with
`npm ci --prefix apps/mobile` before its checks. Do not run a host Next.js dev
server while building production output into the same `.next` directory.
Host-only Gherkin checks remain in CI; a container-only subset excludes `@host`
because it deliberately has no access to the Docker daemon socket.

## External inputs still needed

- Exact GitHub repository and permission to push its main branch.
- AWS account, region, bootstrap/operator access, and production environment.
- Server-side OpenAI key with available usage; never paste it into source code.
- Android SDK/AVD and native runtime verification.
- Recording/publication destination and the actual assessment start date if its
  seven-business-day deadline must be tracked.

Dependency audits must be reported separately for the web, infrastructure, and
native workspaces; a clean root audit does not imply a clean Expo dependency tree.
