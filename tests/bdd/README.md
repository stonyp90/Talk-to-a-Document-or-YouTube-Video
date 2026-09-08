# Acceptance tests

Start the application at `http://localhost:3000` with mock providers and install
the Playwright Chromium browser. Override the URL with `BDD_BASE_URL` if needed.
The runner does not start or rebuild the application.

For an isolated Compose project, pass the same `COMPOSE_PROJECT_NAME` and port
variables used to start it. Also set `BDD_BASE_URL`, `BDD_S3_ENDPOINT`,
`BDD_OBJECT_STORE_URL` (the MinIO `/minio/health/live` URL), and
`BDD_TRANSCRIPT_HEALTH_URL` (the transcript `/health` URL). Use `--name` to select
individual scenarios; feature paths currently merge with the configured glob.

```sh
npx cucumber-js --format summary --format json:tests/bdd/latest-results.json
npx cucumber-js --tags 'not @external' --format summary --format json:tests/bdd/local-results.json
```

Host CI runs every local scenario, including `@host`. The container runner runs
the narrower `not @external and not @host` subset without Docker CLI or a mounted
Docker socket. Host-tagged checks inspect Docker, workflows, or the host canary
build. Before host BDD, run the production canary build and scanner as configured
in CI. Fast Terraform wiring checks use Node; actual Terraform validation and
mock-provider tests run in their separate infrastructure CI job. Do not run builds and
browser suites concurrently on a resource-constrained machine.

The default configuration is strict. Failed, pending, or undefined steps make
the command exit nonzero. No catchall matches arbitrary phrases. Exact pending
phrases are explicitly listed in `unsupported.ts`, with their missing evidence.
New unknown steps remain undefined. Do not use `--no-strict` to make CI pass.

`@external` marks live provider/media, native simulator, and external
release/deployment evidence. Locally unfinished documentation, Compose,
configuration, resilience, security, and UI checks are included in the local CI
gate. Remove pending definitions as their actual
assertions are implemented; do not retag local gaps as external.

## Evidence boundaries

- Real generated PDF bytes exercise the server parser. Browser uploads follow
  the configured multipart or presigned object-store route, including the real
  object-store upload. API requests are forwarded without fabricated responses.
- Text fallback uses the real UI and local API, asserting submitted source
  context, question, deterministic response, and chronological rendering.
- Retry/loading tests deliberately inject a 503 or hold an ingestion request;
  recovery then forwards to the actual backend. Permission-denial tests inject
  a rejected browser microphone call and select the live client path without
  contacting a live provider. These are controlled fault tests.
- Domain checks cover exact PDF/context boundaries, empty context, validation
  before parser input is read, and instruction construction. The prompt test
  proves the untrusted-source instruction is constructed, not model immunity
  to prompt injection.
- The mock-session contract is explicitly simulated. It is not evidence of
  real ephemeral-token issuance, WebRTC audio, speech recognition, or native
  simulator behavior. Those requirements remain pending.
- Storage lifecycle checks verify a real MinIO object exists before extraction
  and returns 404 afterward. Only the generated test object is cleaned up.
- Production security checks run the canary asset scanner and its deliberately
  leaking regression fixture, then inspect the served production chunks and
  configured server-secret separation. This requires a completed canary build.
- Transport resilience uses the shared controlled-media/peer harness against
  the actual client and UI. It proves fault handling, not physical audio or
  live-provider correctness. Preview tests allow either initial state and
  verify that toggling preserves the full source text.

## Verification handoff

The completed serialized host run on 2026-09-07 passed **62 local scenarios and
348 steps**, with zero failed, pending, undefined or skipped local steps.
This ran against the rebuilt Compose production service, including direct
object-store uploads. It supersedes the earlier interrupted and failing runs.
The production build/canary scan and all 22 browser tests also passed.

The subsequent full run reported **95 scenarios: 62 passed, 33 pending** and
exited nonzero as intended. Those 33 external scenarios are not verified by the
local simulation. They must not be presented as passed requirement coverage.

The local review scenario checks `LOCAL_REVIEW.md` for edge-case evidence,
existing referenced artifacts, and explicit tested or pending dispositions.
It does not require all dispositions to pass or inspect the recording/publication
checklist. Live audio, recording, public deployment, and release-completion
requirements remain separate external gates.

JSON reports are generated and ignored by Git. Rebuild changed services before
using a subsequent run as evidence that an application fix has landed. The
shared WebRTC harness and page fixes are owned by other integration agents.
