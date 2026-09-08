# Ursly — Talk to a Source

Ursly lets you ask questions about a **PDF document or a captioned YouTube video**, by typing or speaking. It extracts the source text, displays it, and uses it as context for AI responses.

This repository contains a **web application**, an **Android/iOS application**, and their **shared backend**. The Expo project slug is `talk-to-a-source`.

**English is the default language for the application and repository documentation.** The native app also offers French in its language settings. French translations are optional; setup instructions, contributor documentation, and release documentation use English.

The website is deployed at **[ursly.io](https://ursly.io)**. See [deployment verification](DEPLOYMENT.md), [service setup](SERVICE-SETUP.md), and the [requirements audit](REQUIREMENTS-AUDIT.md) for tested behavior and outstanding limitations. Deployment alone does not certify every live feature.

## Android preview

[Release v0.1.0-demo.1](https://github.com/stonyp90/Talk-to-a-Document-or-YouTube-Video/releases/tag/v0.1.0-demo.1) includes the tested ARM64 APK, SHA-256 checksums, and installation instructions. This is a **local demo preview** requiring the Docker backend and ADB port forwarding. Read the release notes before installation.

## Features and current limits

- Upload a PDF up to **25 MB** and inspect its extracted text.
- Enter a YouTube URL to retrieve available captions.
- Ask written questions grounded in the selected source.
- Start a voice session with transcription, microphone controls, and a stop action.
- Continue by typing when voice is unavailable.
- Use the native app in English by default, with optional French.

`mock` mode works without an OpenAI key and produces deterministic responses, not real audio. `live` mode uses real providers. PDF ingestion, real text responses, and ephemeral voice credentials have been tested. Real YouTube ingestion succeeded locally after a network change. The latest iOS recording encountered a CoreAudio failure; complete voice and physical-device validation remain outstanding. See [recording status](docs/demo/RECORDING-STATUS.md).

## Technologies

| Component | Technologies | Purpose |
| --- | --- | --- |
| Web and API | Next.js 16, React 19, TypeScript | Web interface and Server routes |
| Mobile | Expo SDK 54, React Native 0.81 | Android and iOS clients |
| Voice | OpenAI Realtime, WebRTC, `react-native-webrtc` | Live audio and transcription events |
| Text chat | OpenAI API | Source-grounded responses |
| Documents | `pdf-parse`, PDF.js, `@napi-rs/canvas` | Server-side PDF extraction |
| YouTube | Python, `youtube-transcript-api` | Separate caption retrieval service |
| Storage | Local MinIO, AWS S3 | Direct uploads using signed forms |
| Development | Docker Compose, Node.js 22 | Reproducible services and tooling |
| Infrastructure | Terraform, Lambda, API Gateway, ECR, S3, Secrets Manager | AWS deployment |
| Verification | Vitest, Playwright, Cucumber, Maestro, Gitleaks, GitHub Actions, EAS | Tests, secret scanning, builds |

```text
apps/web/                 Next.js interface and API routes
apps/mobile/              Expo client with its own package-lock.json
packages/core/            Domain models, rules, and use cases
packages/adapters/        External services and storage adapters
services/transcript/      Python YouTube caption service
infrastructure/terraform/ AWS infrastructure
scripts/                  Development, simulator, and security tools
features/                 Gherkin acceptance scenarios
tests/                    Architecture, BDD, and browser tests
```

Domain logic is separate from interfaces and providers. Clients call the Next.js backend; permanent credentials stay on the server. For voice, the backend issues an ephemeral credential for the client's direct OpenAI connection. See [architecture](ARCHITECTURE.md).

## Web development setup

### Prerequisites

Install Git, **Node.js 22** with npm, and **Docker Desktop** with Compose. Start Docker Desktop. Mock development requires no AWS account, Expo account, or OpenAI key. Python and MinIO run in containers.

### Configure and start

From the repository root:

```bash
# First setup only: preserve any existing local configuration.
cp .env.example .env.local
npm ci
```

Start with these values in `.env.local`:

```dotenv
PROVIDER_MODE=mock
TRANSCRIPT_MODE=mock
OPENAI_API_KEY=
```

Start services with automatic web reload:

```bash
docker compose --env-file .env.local --profile dev up --build dev
```

Open **[localhost:3000](http://localhost:3000)**. The terminal displays logs; `Ctrl+C` stops the foreground development service.

| Service | Local address |
| --- | --- |
| Web and API | [localhost:3000](http://localhost:3000) |
| API health | [localhost:3000/api/health](http://localhost:3000/api/health) |
| Caption service health | [localhost:3010/health](http://localhost:3010/health) |
| MinIO storage API | `http://localhost:9002` |
| MinIO console | [localhost:9003](http://localhost:9003) |

The local-only MinIO demo credentials are `local-minio` / `local-minio-password`. Compose binds ports to `127.0.0.1`.

Try uploading a text-based PDF or entering a YouTube URL in mock mode. Inspect the extracted text, ask a written question, and start/stop a simulated voice session. Mock responses are deterministic.

### Run a local production build

The `dev` and `web` services share a port. Stop one before starting the other:

```bash
docker compose --env-file .env.local stop dev
docker compose --env-file .env.local up --build -d --wait web
```

This serves a compiled build; changes require rebuilding. To return to development:

```bash
docker compose --env-file .env.local stop web
docker compose --env-file .env.local --profile dev up --build dev
```

Stop all services without deleting MinIO data:

```bash
docker compose --env-file .env.local --profile dev down
```

## Enable real services

Edit the local `.env.local` file:

```dotenv
PROVIDER_MODE=live
OPENAI_API_KEY=<your-local-key>
TRANSCRIPT_MODE=live
```

Rerun the appropriate Compose command to apply the environment. `PROVIDER_MODE` controls OpenAI; `TRANSCRIPT_MODE` independently controls YouTube. OpenAI calls require model access and may incur charges. Follow [service setup](SERVICE-SETUP.md).

Never put secrets in `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*` variables: these values are shipped to clients. Never commit `.env.local`.

Scanned PDFs without a text layer require OCR, which is not implemented. Conversation context currently has a **60,000-character limit**. YouTube depends on available captions and may block some networks or cloud addresses. Text chat sends the current question and source, without multi-turn history, to the backend.

## Android and iOS development

Keep the shared Compose backend running. The mobile npm installation is **separate** from the repository root installation.

Install Xcode and an iOS simulator on macOS, or Android Studio with an Android SDK and emulator.

```bash
cd apps/mobile
npm ci
npm run typecheck
npm test

# Choose a platform:
npm run ios
# or:
npm run android
```

These commands build and install a native development client. **Expo Go is not supported** because it does not include this app's WebRTC module. After installing the development client, start subsequent sessions with:

```bash
npm start
```

The default API is `http://localhost:3000`, accessible directly from the iOS simulator. For Android, forward the API and storage ports in another terminal:

```bash
adb devices
adb -s <emulator-id> reverse tcp:3000 tcp:3000
adb -s <emulator-id> reverse tcp:9002 tcp:9002
```

Port 9002 is required for PDF uploads because the client must reach the MinIO URL in the signed form.

Set another API address **before** starting Metro or building the app:

```bash
EXPO_PUBLIC_API_URL=https://your-api.example npm start
```

On a physical phone, `localhost` means the phone itself. Both the HTTPS backend and upload storage address must be reachable. Changing only the API URL is insufficient for uploads. Default Docker networking is local to the Mac.

If spaces in the repository path cause Xcode problems, the repository provides an isolated simulator release builder:

```bash
bash scripts/mobile/build-ios-isolated.sh
```

It prints the `.app` location and does not require Metro. See the [mobile guide](apps/mobile/README.md) for installation and audio checks, and the [EAS guide](apps/mobile/EAS.md) for cloud builds and signing. An iOS simulator build cannot be installed on an iPhone.

## Validate changes

From the repository root:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

For browser tests, start the `web` service with mock providers:

```bash
npx playwright install chromium
npm run test:e2e
```

Cucumber also requires local services. See the [BDD guide](tests/bdd/README.md) for infrastructure/security prerequisites. `@external` scenarios require real providers or external environments; mocks do not validate them. Undefined or pending steps fail the suite; pending steps are not passing.

```bash
npm run test:gherkin -- --tags 'not @external'
npm run typecheck --prefix apps/mobile
npm test --prefix apps/mobile
```

Before publication, install Gitleaks 8.30.1 and run:

```bash
npm run security:secrets
```

This scans Git history and publication candidates. GitHub Actions also runs secret scanning. See [security review](SECURITY-REVIEW.md) for audit limits and dependency findings.

## Troubleshooting

| Problem | Check |
| --- | --- |
| Port 3000 already in use | Stop the previous `web` or `dev` service; do not run both together. |
| No local audio | Mock mode has no real sound. For live voice, configure the key and microphone permission. |
| Mobile cannot reach the API | Check `/api/health`, `EXPO_PUBLIC_API_URL`, and Android port forwarding. |
| Android PDF upload fails | Also forward port 9002. Do not rewrite an already signed URL. |
| Environment changes not applied | Restart Compose; restart Metro or rebuild for mobile public variables. |
| YouTube captions unavailable | Try a captioned video, check `TRANSCRIPT_MODE`, and inspect service logs. |
| iOS simulator exits when voice starts | See the outstanding CoreAudio issue in the recording status report. |

```bash
docker compose --env-file .env.local ps
docker compose --env-file .env.local logs --tail=100 dev transcript
# For the local production build, replace dev with web.
```

For a second instance, configure `COMPOSE_PROJECT_NAME`, `WEB_PORT`, `TRANSCRIPT_PORT`, `OBJECT_STORE_PORT`, and `OBJECT_STORE_CONSOLE_PORT`. Also update `APP_ORIGIN`, `OBJECT_STORE_PUBLIC_ENDPOINT`, and client URLs. See the BDD guide for test variables.

## Live demo checks

Follow [demo readiness](DEMO-READINESS.md). With a live backend, run:

```bash
# Use your configured port; the demo environment uses 3100.
npm run demo:check -- http://localhost:3100
```

This rejects mock mode and checks PDF extraction, a real text response, and a real voice credential. Audio, YouTube, and physical devices need separate testing.

## Deployment and further documentation

Terraform deploys the Next.js image to **ECR**, runs it on **Lambda** behind **API Gateway**, and provisions a caption Lambda, **S3**, and **Secrets Manager**. GitHub Actions uses **OIDC**, without permanent AWS keys in the repository.

The default runtime is Lambda. It suits intermittent demo traffic without an always-running ECS task. Costs also depend on traffic, storage, and AI providers. Public paid endpoints need appropriate access controls and usage limits; review the security findings before commercial use.

- [Architecture](ARCHITECTURE.md) and [Terraform setup](infrastructure/terraform/README.md)
- [Native development](apps/mobile/README.md) and [Expo EAS builds](apps/mobile/EAS.md)
- [Mobile production verification](apps/mobile/PRODUCTION-VERIFICATION.md)
- [Requirements coverage](REQUIREMENTS-AUDIT.md) and [security review](SECURITY-REVIEW.md)
- [Demo walkthrough](WALKTHROUGH.md), [recording plan](docs/demo/WALKTHROUGH.md), and [recording status](docs/demo/RECORDING-STATUS.md)
- [Brand guidelines](BRAND.md)

AI-assisted development was used for requirements decomposition, design, implementation, debugging, testing, and review. Verification reports distinguish observed results from features that remain unverified.
