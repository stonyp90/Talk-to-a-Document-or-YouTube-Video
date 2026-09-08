# Talk to a Document or YouTube Video - Delivery Plan

Implementation update: the runtime is one Next.js UI/API container plus a
Python captions container and temporary S3-compatible storage. Compose uses
MinIO, with an initialization job, and an optional hot-reload `dev` profile.
Realtime mock events are in-process, not a separate media service. AWS uses
container Lambdas behind API Gateway; no separate Amplify hosting is needed.
These choices supersede the preliminary topology below. PDFs use direct
presigned uploads to avoid gateway body limits. Conversation context is limited
to 60,000 characters, with explicit rejection rather than silent truncation.

This plan is derived from `Talk to a Document.pdf` and the additional delivery
requirements provided by the project owner. The PDF defines the product
requirements; the project owner's AWS, Docker, GitHub Actions, OIDC, Gherkin,
unit-test, and simulator requirements are authoritative where they add detail
or differ from the PDF.

## 1. Definition of done

The project is complete when all of the following are true:

- A publicly reachable mobile-first web application accepts either a PDF of at
  most 25 MB or a YouTube URL.
- PDF text extraction works in the deployed AWS environment.
- YouTube transcript extraction works where the provider permits it, with a
  documented local demonstration fallback when cloud IP blocking prevents it.
- Extracted text is visible in a collapsible preview and is used as context for
  an OpenAI Realtime session.
- Users can start a WebRTC voice session, speak, hear model audio, see the
  conversation transcript update in real time, mute/unmute, interrupt, and
  stop the session.
- Users can switch to text chat when microphone access is unavailable or
  denied.
- No OpenAI or AWS long-lived secret is sent to the client or stored in GitHub
  Actions.
- Every application behavior is represented by Gherkin acceptance coverage,
  with unit tests written before or alongside each feature.
- Pull requests run the complete required CI checks. Merges to `main` deploy
  through GitHub Actions using AWS OIDC short-lived credentials.
- The app can be iterated locally through Docker Compose, with deterministic
  local substitutes for external services and an opt-in live OpenAI mode.
- The repository contains setup instructions, architecture/trade-offs, test
  instructions, AI-use disclosure, and the walkthrough/demo instructions.

## 2. Architecture and platform decision

### Required web product

The PDF explicitly asks for a working web application. The primary client will
therefore be a Next.js App Router application using React and TypeScript,
optimized first for approximately 390 px wide screens. This is the required
submission target and supports browser WebRTC directly.

### Native simulator target

The backend and UI/domain contracts will be kept client-independent so an Expo
/ React Native client can be developed and smoke-tested on iOS and Android
simulators. The native client is a companion target for local mobile iteration;
it does not replace the required web deliverable. Shared packages will contain
source selection, ingestion state, conversation state, API types, and error
mapping. The web client remains the acceptance reference for the PDF.

If native voice support is enabled, it will use a maintained React Native WebRTC
implementation. Text fallback remains mandatory on both clients.

### Backend and AWS runtime

- TypeScript Node.js API service, separated from UI components.
- Docker image used both locally and as the AWS Lambda container image.
- API Gateway routes invoke Lambda for ingestion and Realtime token issuance.
- The same Next.js Lambda serves the web UI and API through API Gateway.
- A second container Lambda provides the Python captions adapter.
- ECR stores the backend container image.
- S3 is used for short-lived uploaded PDF objects when a request cannot be
  safely processed entirely in memory.
- CloudWatch receives application logs and deployment smoke-test diagnostics.
- No persistent user authentication is included because the PDF explicitly
  says it is not required.

Lambda container images are the default demo choice because the workload is
  intermittent and this avoids paying for an always-running ECS service. ECS
  Fargate remains an explicitly documented alternative if later requirements
  need long-running workers or persistent connections.

## 3. Local Docker Compose topology

`docker compose up --build` must provide a complete deterministic development
environment for every application-side service:

| Service | Responsibility | Local implementation |
|---|---|---|
| `web` | Next.js web UI and API, PDF extraction, token route | Production container, also used for Lambda |
| `dev` | Hot-reload UI and API | Optional development profile; replaces `web` on port 3000 |
| `object-store` | S3-compatible temporary object storage | MinIO with a persistent named volume |
| `object-store-init` | Initialize temporary upload bucket | One-shot initialization job |
| `transcript` | Caption retrieval | Python service, with separate live/mock configuration |
| `test` | Unit and browser acceptance runner | Optional test profile, no Docker daemon access |

Realtime mock events are simulated in the client; no unused media service is
run. Mock mode is visibly labeled and does not transmit real microphone audio.

SQLite is embedded in the API container only if a state store is needed; it is
not a separate service because the PDF permits SQLite and a separate database
would add cost and unnecessary local latency. The default MVP can keep session
state in memory and use MinIO only for uploaded-object parity.

The API supports two explicit modes:

- `PROVIDER_MODE=mock`: local Realtime/text substitutes require no credentials.
- `PROVIDER_MODE=live`: the server uses the real OpenAI API. The key is supplied
  only to the Next.js server, never to its emitted browser assets.
- `TRANSCRIPT_MODE=mock|live` independently controls the captions service.
  Compose always exercises its HTTP adapter from the Next.js API.

The local README will document:

```text
docker compose up --build -d
npm test
npm run test:gherkin -- --tags 'not @external'
npm run test:e2e
docker compose --profile test run --rm test
```

The browser calls the same-origin API. Native apps use localhost:3000; Android
requires `adb reverse` for ports 3000 and 9002 so signed upload hostnames remain
unchanged. See the mobile README for alternative API-host configuration.

## 4. Full requirements traceability

Each item below will have an implementation reference, a test reference, and a
Gherkin scenario before the corresponding feature is considered complete.

| ID | Requirement from source | Planned implementation | Acceptance coverage |
|---|---|---|---|
| OBJ-01 | Mobile-first application for document/video conversations | Next.js responsive UI; native companion for simulator iteration | `ui.feature`, `mobile-smoke.feature` |
| OBJ-02 | Live voice conversations powered by OpenAI Realtime | Browser WebRTC client plus server-issued session token | `realtime.feature` |
| ING-01 | Accept PDF upload | Multipart upload route and PDF picker | `ingestion.feature` |
| ING-02 | Accept YouTube URL with transcript/captions | URL parser and server transcript adapter | `ingestion.feature` |
| ING-03 | PDF limit is 25 MB | Request and file-size validation before extraction | `ingestion.feature` |
| ING-04 | PDF ingestion must work when deployed | Lambda-compatible extraction test and deployed PDF smoke test | `delivery.feature`, `infrastructure/scripts/smoke.mjs` |
| ING-05 | YouTube ingestion must work | Transcript adapter with fixture and live provider modes | `ingestion.feature` |
| ING-06 | Local YouTube demo is acceptable if cloud retrieval is blocked | Cloud error classification and README local workflow | `ingestion.feature`, `documentation.feature` |
| ING-07 | Explain how deployed YouTube retrieval works if achieved | Provider and deployment notes in README | `documentation.feature` |
| ING-08 | Display extracted text in collapsible/preview form | Preview component with long-text truncation and expand/collapse | `ingestion.feature`, `ui.feature` |
| CTX-01 | Make extracted text available as Realtime context | Session instruction/context builder | `context.feature` |
| CTX-02 | No chunking, summarization, or citation handling required | Pass extracted text directly, with bounded payload validation | `context.feature` |
| VOI-01 | Provide “Start Voice Chat” control | Explicit session-start action | `realtime.feature` |
| VOI-02 | User can speak questions | Microphone capture and WebRTC track | `realtime.feature` |
| VOI-03 | User can hear spoken answers | Remote audio track playback | `realtime.feature` |
| VOI-04 | Show live text transcript | Realtime event reducer and transcript UI | `realtime.feature` |
| VOI-05 | Text fallback if microphone unavailable | Capability detection, permission handling, text composer | `fallback.feature` |
| UI-01 | Simple mobile-first design near 390 px | Responsive layout and Playwright viewport tests | `ui.feature` |
| UI-02 | Clear microphone controls | Start, stop, mute, unmute, permission, retry states | `ui.feature`, `realtime.feature` |
| UI-03 | Connection status and conversation flow | State machine: idle, preparing, connecting, connected, reconnecting, ended, error | `ui.feature`, `resilience.feature` |
| SEC-01 | Never expose API keys to client | Server-only environment validation and bundle/secrets tests | `security.feature` |
| SEC-02 | Use ephemeral/authenticated backend Realtime access | Backend token endpoint with short-lived OpenAI token | `security.feature`, `realtime.feature` |
| DOC-01 | Setup and run instructions | README for local, live, test, and deployment commands | `documentation.feature` |
| DOC-02 | Technical overview and trade-offs | README architecture, AWS cost, YouTube limitation, and provider modes | `documentation.feature` |
| TECH-01 | Recommended Next.js/React/TypeScript stack | Primary web implementation | Build/typecheck tests |
| TECH-02 | Node.js backend in TypeScript | API package and Lambda container | Unit/integration tests |
| TECH-03 | Realtime API over WebRTC | Web client negotiation and event handling | `realtime.feature` |
| TECH-04 | Handle microphone input and model output | Media tracks, audio element/session audio routing | `realtime.feature` |
| TECH-05 | Server-side PDF extraction | PDF library in API container/Lambda | `ingestion.feature` |
| TECH-06 | Server-side YouTube retrieval | Provider adapter called by API, not browser | `ingestion.feature`, security tests |
| TECH-07 | Account for YouTube Data API ownership limitation | README limitation and deterministic local path | `documentation.feature` |
| TECH-08 | In-memory or lightweight storage sufficient | Ephemeral conversation state and short-lived objects; no database | `local-environment.feature`, `security.feature` |
| TECH-09 | No persistent authentication required | Anonymous session flow with no login screen | `local-environment.feature`, `ui.feature` |
| DEL-01 | Working publicly hosted web app | AWS deployment and smoke test URL | `delivery.feature` |
| DEL-02 | Frontend for PDF/YouTube input | Source selection UI | `ingestion.feature` |
| DEL-03 | Backend for ingestion, extraction, Realtime setup | API routes and provider modules | Integration tests |
| DEL-04 | Demo-ready public hosting | Production config, health route, smoke test | `delivery.feature` |
| DEL-05 | 10-15 minute walkthrough | Script covering full workflow and decisions | `documentation.feature` |
| DEL-06 | Public GitHub repository | Repository, README, clean modular source | `delivery.feature` |
| DEL-07 | Environment configuration details | `.env.example`, secret naming, AWS configuration docs | `documentation.feature` |
| DEL-08 | Dependencies included | Lockfile, package manifests, Docker build | CI |
| DEL-09 | Unit/integration tests | Vitest, Cucumber, Playwright, deployment smoke tests | CI |
| EVAL-01 | Product polish and robust mobile states | Loading, empty, error, permission, reconnect, success states | `ui.feature`, `resilience.feature` |
| EVAL-02 | Reliable ingestion and edge handling | Size/type/empty/blocked/invalid-source cases | `ingestion.feature` |
| EVAL-03 | Typed, secure, modular code | TypeScript strict mode, modules, secret scans | CI and review |
| EVAL-04 | Clear separation and scalable design | UI/domain/provider/infrastructure boundaries | Architecture review |
| PROC-01 | Seven-business-day assessment deadline | Milestones tracked against the delivery plan | Release checklist |
| PROC-02 | AI-assisted work must be disclosed | README AI-use section describing assistance | `documentation.feature` |
| REV-01 | Review YouTube URL with captions | Fixture and live review path | `ingestion.feature` |
| REV-02 | Review PDF full extraction | Multi-page fixture and deployed smoke test | `ingestion.feature` |
| REV-03 | Mobile voice, interrupt, follow-up | Browser/mobile acceptance scenarios | `realtime.feature` |
| REV-04 | Poor-network behavior | Throttled Playwright/mobile test and reconnect state | `resilience.feature` |
| REV-05 | Code, environment, secret review | CI secret scan and repository checklist | `security.feature`, `delivery.feature` |
| OWN-01 | Push code to main branch | Configure remote, protect main, merge release branch | `delivery.feature` |
| OWN-02 | CI/CD with GitHub Actions | PR and main workflows | `ci-cd.feature` |
| OWN-03 | Short-lived AWS OIDC token | GitHub OIDC trust policy and role assumption | `ci-cd.feature`, IAM policy tests |
| OWN-04 | Least-privilege AWS deployment | Scoped deploy role for ECR, Lambda/API, hosting, logs | `ci-cd.feature` |
| OWN-05 | Dockerized application | Reproducible API image and Compose environment | `local-environment.feature` |
| OWN-06 | Cheapest suitable AWS demo runtime | Lambda container default; ECS documented as alternative | Architecture review |
| OWN-07 | Local iteration across all services | Compose services plus mock providers | `local-environment.feature` |
| OWN-08 | iOS and Android simulator iteration | Native companion, simulator commands, mobile smoke tests | `mobile-smoke.feature` |

## 5. Gherkin feature inventory

The following scenarios are the minimum regression suite. They will be checked
into `features/` and run on every pull request and every merge to `main`.

### `ingestion.feature`

```gherkin
Feature: Ingest a source

  Scenario: Ingest a valid PDF up to 25 MB
  Scenario: Reject a PDF larger than 25 MB
  Scenario: Reject a non-PDF file
  Scenario: Extract all selectable text from a multi-page PDF in order
  Scenario: Report a PDF with no extractable text
  Scenario: Ingest a YouTube URL with accessible captions
  Scenario: Reject a malformed or unsupported YouTube URL
  Scenario: Report that captions are unavailable
  Scenario: Report cloud transcript blocking and provide local fallback guidance
  Scenario: Display extracted text in a collapsed preview
  Scenario: Expand and collapse the extracted-text preview
  Scenario: Retry a transient ingestion failure
```

### `context.feature`

```gherkin
Feature: Prepare conversation context

  Scenario: Make extracted PDF text available to a new Realtime session
  Scenario: Make extracted YouTube text available to a new Realtime session
  Scenario: Preserve source text without chunking or summarization
  Scenario: Reject a context payload that exceeds the configured safety limit
```

### `realtime.feature`

```gherkin
Feature: Have a live voice conversation

  Scenario: Start a voice chat and establish WebRTC
  Scenario: Receive a short-lived ephemeral token from the backend
  Scenario: Speak a question and see the user transcript
  Scenario: Hear a spoken assistant response
  Scenario: See assistant transcript events in real time
  Scenario: Ask a follow-up question using the same source context
  Scenario: Interrupt an assistant response by speaking
  Scenario: Mute the microphone
  Scenario: Unmute the microphone
  Scenario: Stop the session and release the microphone
  Scenario: Show connecting and connected status
  Scenario: Handle a Realtime connection failure
```

### `fallback.feature`

```gherkin
Feature: Continue through text when voice is unavailable

  Scenario: Offer text mode when microphone hardware is unavailable
  Scenario: Offer text mode when microphone permission is denied
  Scenario: Submit a text question using the ingested context
  Scenario: Render a text assistant response in the conversation transcript
```

### `ui.feature`

```gherkin
Feature: Provide a mobile-first conversation UI

  Scenario: Render the source selector at a 390 px viewport
  Scenario: Show loading and disabled states during ingestion
  Scenario: Show an empty state before a source is selected
  Scenario: Show a clear error and retry action after failure
  Scenario: Show microphone, mute, stop, and fallback controls
  Scenario: Show conversation turns in chronological order
  Scenario: Show connection status throughout the session lifecycle
  Scenario: Remain usable on a narrow mobile viewport without horizontal scrolling
```

### `resilience.feature`

```gherkin
Feature: Handle unreliable services and networks

  Scenario: Reconnect after a temporary WebRTC interruption
  Scenario: Preserve the visible transcript during reconnect
  Scenario: Display a degraded-network status
  Scenario: Allow the user to retry after a backend timeout
  Scenario: Avoid claiming success when extraction fails
```

### `security.feature`

```gherkin
Feature: Protect credentials and uploaded content

  Scenario: Keep the OpenAI API key out of client bundles
  Scenario: Keep AWS credentials out of client bundles
  Scenario: Return only an ephemeral Realtime token to the client
  Scenario: Reject invalid upload size and type before extraction
  Scenario: Keep transcript retrieval on the server
  Scenario: Expire or clean up temporary uploaded objects
```

### `local-environment.feature`

```gherkin
Feature: Run the complete application locally

  Scenario: Start every local service with Docker Compose
  Scenario: Ingest a fixture PDF without external credentials
  Scenario: Ingest a fixture YouTube transcript without external credentials
  Scenario: Run a mocked Realtime conversation without external credentials
  Scenario: Run the web application against the local API
  Scenario: Run the native client against the Compose API
```

### `mobile-smoke.feature`

```gherkin
Feature: Validate mobile clients on simulators

  Scenario: Launch the iOS client against the local API
  Scenario: Launch the Android client against the local API
  Scenario: Select a PDF from the simulator test fixture
  Scenario: Display extracted text on the simulator
  Scenario: Start and stop a mock voice conversation on the simulator
  Scenario: Use text fallback on the simulator
```

### `ci-cd.feature`

```gherkin
Feature: Validate and deploy changes safely

  Scenario: Run lint, typecheck, unit, Gherkin, build, and security checks on a pull request
  Scenario: Build the backend Docker image on a pull request
  Scenario: Prevent deployment from an untrusted branch
  Scenario: Assume the AWS deploy role through GitHub OIDC on main
  Scenario: Deploy the Lambda container and frontend after checks pass
  Scenario: Run deployed smoke tests after deployment
  Scenario: Avoid storing long-lived AWS keys in GitHub Actions
```

### `documentation.feature` and `delivery.feature`

```gherkin
Feature: Deliver a reviewable project

  Scenario: Follow the README to run the complete project locally
  Scenario: Find environment variables and secret configuration guidance
  Scenario: Find architecture and trade-off explanations
  Scenario: Find the YouTube cloud limitation and local workaround
  Scenario: Find the AI-use disclosure
  Scenario: Find the 10-15 minute walkthrough script
  Scenario: Find test and deployment commands
  Scenario: Verify the repository has modular frontend and backend code
  Scenario: Verify the release is present on main
```

## 6. Test-first delivery workflow

For every feature:

1. Add or refine the relevant Gherkin scenario.
2. Add unit tests for validators, reducers, adapters, or domain logic.
3. Implement the smallest vertical slice.
4. Add integration tests against mocked providers.
5. Add Playwright coverage for the web flow and simulator smoke coverage for
   native changes.
6. Run the full suite locally through Docker Compose.
7. Open a feature branch and merge only after CI passes.

The test stack will be:

- Vitest for unit tests.
- Cucumber.js for Gherkin step definitions.
- Playwright for the web browser journey and 390 px viewport.
- Maestro or Detox for native simulator smoke tests, selected after the Expo
  client is initialized.
- Docker Compose fixture providers for deterministic CI behavior.
- A small live deployed smoke suite for PDF ingestion, health, and token-route
  contract validation; it will never print secrets.

## 7. GitHub Actions and AWS OIDC

### Pull request workflow

- Install from the lockfile.
- Lint and format check.
- Typecheck all packages.
- Run unit tests.
- Start Compose fixtures and run Cucumber acceptance tests.
- Build the web application.
- Build the Lambda-compatible Docker image.
- Run Playwright at the target mobile viewport.
- Run dependency and secret scans.

### Main deployment workflow

- Re-run all pull-request checks.
- Build and tag the backend image using the commit SHA.
- Authenticate to ECR through AWS OIDC, never an access key.
- Push the image to ECR.
- Deploy Terraform infrastructure from `infrastructure/terraform/environments/demo`,
  using separate operator bootstrap state and a saved, reviewed application plan.
- Update Lambda/API Gateway and frontend hosting.
- Run health, PDF extraction, and Realtime token smoke checks.
- Publish the deployment URL and image digest as workflow artifacts.

The AWS trust policy will restrict the OIDC subject to the exact GitHub
repository and the `main` branch or an explicitly approved GitHub environment.
The deployment role will grant only the actions required by the chosen
infrastructure stack. Preview deployments, if enabled, will use a separate
role and environment.

## 8. Simulator access and current host status

The host currently has Docker/Compose, Node.js, and an available iOS Simulator
device (`iPhone 17 Pro`). The Android commands `adb` and `emulator` are not
currently available on the PATH. Android simulator control therefore requires
installing/configuring Android Studio or the Android command-line tools, an SDK
platform, an emulator image, and an AVD. The plan will not claim Android
coverage until those tools are present and a booted AVD is verified.

Once configured, the local loop will include:

```text
# iOS
xcrun simctl boot "iPhone 17 Pro"
open -a Simulator

# Android (after SDK/AVD setup)
emulator -avd <configured-avd>
adb wait-for-device
adb reverse tcp:3000 tcp:3000
```

The simulator acceptance checks will use mock providers by default. Live
microphone/audio behavior will be checked on simulator and, where simulator
audio limitations make the result inconclusive, on a physical device before
release.

## 9. Delivery milestones

1. Foundation, repository structure, Compose, and CI.
2. PDF ingestion and preview.
3. YouTube transcript adapter and local/cloud limitation handling.
4. Context construction and ephemeral Realtime token route.
5. WebRTC voice UI, transcript, controls, interruption, and fallback.
6. Native companion client and iOS/Android simulator smoke loop.
7. AWS infrastructure, OIDC deployment, public hosting, and smoke tests.
8. README, walkthrough script, AI-use note, final regression run, and merge to
   `main`.

The seven-business-day deadline from the assessment will be tracked against
these milestones once the GitHub remote, AWS account, and deployment domain
are available.

## 10. Required external setup before final deployment

- GitHub repository URL and permission to push to `main`.
- AWS account and region.
- GitHub repository/environment name for the OIDC trust policy.
- OpenAI API key stored only in AWS Secrets Manager or the selected runtime
  secret mechanism.
- Optional YouTube transcript provider configuration for deployed retrieval.
- Android SDK/AVD if Android simulator acceptance is required on this host.
