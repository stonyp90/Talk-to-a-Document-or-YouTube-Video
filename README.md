# Talk to a Document or YouTube Video

Mobile-first web application for asking questions about a PDF or a captioned
YouTube video using voice or text.

## Local quickstart

Requirements: Docker Desktop and Node.js 22+.

```bash
cp .env.example .env.local
npm ci
npm test
npm run typecheck
npm run build
docker compose --env-file .env.local up --build -d
```

Open <http://localhost:3000>. Compose starts:

- `web` (Next.js UI and backend routes) on port 3000
- `transcript` (Python captions service, deterministic mock mode by default) on port 3010
- MinIO object storage on ports 9002/9003

Local mock mode requires no OpenAI key. It supports deterministic PDF, YouTube,
text fallback, and simulated session events for fast BDD and browser testing.
Mock mode does not transmit microphone audio or produce real spoken answers.
For real voice, set `PROVIDER_MODE=live` and `OPENAI_API_KEY` in `.env.local`,
then rerun Compose with `--env-file .env.local`. Set `TRANSCRIPT_MODE=live`
independently to retrieve actual YouTube captions. Never use a `NEXT_PUBLIC_`
variable for a secret. The Next.js server holds the key, not the browser bundle.

For hot reload, stop `web`, then run
`docker compose --env-file .env.local --profile dev up --build dev`.
Do not run `web` and `dev` simultaneously: both bind port 3000.

## Tests

```bash
npm test                 # domain and provider unit tests
npm run test:gherkin     # complete feature inventory
npm run test:e2e         # Playwright mobile viewport journey
npm run typecheck
npm run build
```

The Gherkin files under `features/` are the regression contract. Executable
steps must assert application behavior; release and live-provider checks need
their external environments and cannot be counted as passed by local mocks.
Undefined or pending steps are not passing coverage. External release gates
are labeled separately; local unfinished scenarios must still fail CI.
Consult actual test reports before claiming full requirement coverage.

## Technical overview

- Next.js App Router, React, and TypeScript provide the mobile-first web client.
- Server routes validate and extract PDF text and retrieve YouTube transcripts.
- PDF extraction uses `pdf-parse` with a bundled PDF.js worker and a server-side
  canvas implementation so it also works in the Docker/Lambda runtime.
- OpenAI Realtime access is server-authenticated. The `/api/realtime/session`
  route returns a short-lived client secret in live mode; the `/api/realtime/connect`
  route can proxy the WebRTC SDP exchange without exposing the server key.
- The browser handles microphone capture, remote audio, data-channel events,
  transcript rendering, interruption, mute, and stop states.
- Text chat uses the same source context and remains available when microphone
  access is unavailable.
- Mock providers make local tests deterministic. Live providers are selected by
  environment configuration.

## YouTube trade-off

The deployed transcript adapter is intentionally isolated behind a provider
interface. Arbitrary YouTube captions are not reliably available from cloud
provider IP ranges, and the YouTube Data API does not provide captions for
videos the authenticated account does not own. The local mock path validates
UI flows but does not verify real caption retrieval. A deployment can provide a compatible transcript
service through `TRANSCRIPT_SERVICE_URL`; failures are surfaced as a useful
limitation instead of a false success.

## AWS deployment

The complete Next.js application is packaged as a Docker image for AWS Lambda.
ECR stores the image and API Gateway serves both UI and backend routes. A second
container Lambda serves captions. Direct presigned S3 uploads avoid gateway
payload limits for PDFs up to 25 MB. The default runtime is Lambda because the
demo is intermittent and does not need an always-on ECS service.

Cost rationale (checked 2026-09-07): standard Lambda is billed for requests and
execution duration, whereas a running Fargate task accrues resource-duration
charges. For this intermittent demo, the inference is that on-demand Lambda
avoids the idle-service compute bill. This is not a guarantee of the cheapest
total bill for every workload; model usage, API Gateway, ECR, S3, logs and secrets
also cost money. See [AWS Lambda pricing](https://aws.amazon.com/lambda/pricing/)
and [AWS Fargate pricing](https://aws.amazon.com/fargate/pricing/).

GitHub Actions uses short-lived AWS credentials through GitHub OIDC. Configure
the production GitHub environment variables described in
`infrastructure/cdk/README.md`, especially `AWS_ROLE_ARN` and `AWS_REGION`.
No long-lived AWS access key belongs in GitHub Secrets.

## Native simulator target

The companion Expo/React Native client lives in `apps/mobile`; consult its
README for native development-build requirements and verified limitations.
iOS Simulator can target the local Compose API
through the host loopback address. Android Emulator uses `10.0.2.2` or `adb
reverse` after Android SDK/AVD setup. The browser application is the required
PDF deliverable; native simulator smoke tests are an additional local target.

## Assessment walkthrough

Follow [the 12-minute recording script](WALKTHROUGH.md), including its live
verification and release checklist. The script is not a completed recording.

## AI-use disclosure

AI-assisted development was used for requirements decomposition, test and
architecture scaffolding, implementation review, and debugging. All generated
changes require local type checks, unit tests, build checks, HTTP smoke tests,
and Docker Compose validation. This disclosure is not a claim that live voice,
both native simulators, or deployment has already passed verification.
