# Ursly — Talk to a Document or a YouTube Video

Add a **PDF** or a **captioned YouTube video**, then hold a **live voice conversation** about it: speak a question, hear the answer, interrupt and follow up. Typing works the whole time, and takes over automatically when no microphone is available.

- **Live application:** [ursly.io](https://ursly.io)
- **Repository:** [stonyp90/Talk-to-a-Document-or-YouTube-Video](https://github.com/stonyp90/Talk-to-a-Document-or-YouTube-Video)
- **API contract:** [ursly.io/api/openapi](https://ursly.io/api/openapi) — generated from the same schemas the routes validate with

Voice runs on the **OpenAI Realtime API over WebRTC**. The browser negotiates directly with OpenAI using a **short-lived credential minted by the backend**; the permanent API key never leaves the server.

---

## Run it in two commands

Install **Node.js 22** and **Docker Desktop**, then from the repository root:

```bash
cp .env.example .env.local && npm ci
```

```bash
docker compose --env-file .env.local --profile dev up --build dev
```

Open **[localhost:3000](http://localhost:3000)**. The defaults run in `mock` mode, which needs no OpenAI key, no AWS account and no network: PDF extraction is real, and provider replies are deterministic stand-ins.

| Service                | Address                                                           |
| ---------------------- | ----------------------------------------------------------------- |
| Web and API            | [localhost:3000](http://localhost:3000)                           |
| API health             | [localhost:3000/api/health](http://localhost:3000/api/health)     |
| OpenAPI document       | [localhost:3000/api/openapi](http://localhost:3000/api/openapi)   |
| Caption service health | [localhost:3010/health](http://localhost:3010/health)             |
| Object storage (MinIO) | `http://localhost:9002`, console on [9003](http://localhost:9003) |

### Turn on real voice and real captions

Edit `.env.local`, then rerun the Compose command:

```dotenv
PROVIDER_MODE=live
TRANSCRIPT_MODE=live
OPENAI_API_KEY=<your-project-key>
```

`PROVIDER_MODE` controls OpenAI; `TRANSCRIPT_MODE` independently controls YouTube. Live calls cost money. Never put a secret in a `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*` variable — those are shipped to clients — and never commit `.env.local`.

Full environment reference: [`.env.example`](.env.example) and [service setup](SERVICE-SETUP.md).

---

## How each requirement is met

| Requirement                                              | Where it lives                                                                                                                                                                                                                                                    |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PDF up to 25 MB, extracted server-side                   | [`packages/adapters/src/ingestion.ts`](packages/adapters/src/ingestion.ts) using `pdf-parse`; size and signature checks in [`packages/core/src/domain/ingestion.ts`](packages/core/src/domain/ingestion.ts)                                                       |
| YouTube captions, fetched server-side                    | [`services/transcript/app.py`](services/transcript/app.py), reached through [`packages/adapters/src/providers.ts`](packages/adapters/src/providers.ts)                                                                                                            |
| Extracted text shown in a preview                        | “View source text” disclosure in [`apps/web/app/page.tsx`](apps/web/app/page.tsx)                                                                                                                                                                                 |
| Text primes the Realtime session                         | [`buildContextInstructions`](packages/core/src/domain/ingestion.ts) with windowing in [`packages/core/src/domain/context.ts`](packages/core/src/domain/context.ts)                                                                                                |
| “Start Voice Chat” over WebRTC                           | [`apps/web/src/lib/realtimeClient.ts`](apps/web/src/lib/realtimeClient.ts)                                                                                                                                                                                        |
| Ephemeral tokens from the backend                        | [`apps/web/app/api/realtime/session/route.ts`](apps/web/app/api/realtime/session/route.ts) → [`packages/adapters/src/openai.ts`](packages/adapters/src/openai.ts)                                                                                                 |
| Live transcript of the conversation                      | Realtime transcription events reduced in [`packages/core/src/domain/conversation.ts`](packages/core/src/domain/conversation.ts)                                                                                                                                   |
| Text fallback without a microphone                       | [`apps/web/app/api/text-chat/route.ts`](apps/web/app/api/text-chat/route.ts); the composer is never disabled                                                                                                                                                      |
| Mobile-first at ~390 px, start/stop/mute, visible status | [`apps/web/app/globals.css`](apps/web/app/globals.css); controls sit in the open above the transcript                                                                                                                                                             |
| API key never in the client                              | Key read only in [`packages/adapters/src/secrets.ts`](packages/adapters/src/secrets.ts); CI builds with canary secrets and greps the emitted client bundle ([`infrastructure/scripts/check-client-secrets.mjs`](infrastructure/scripts/check-client-secrets.mjs)) |

---

## Technical overview

```text
apps/web/                 Next.js interface, Server routes, composition root
apps/mobile/              Expo client (extra scope, not part of the web deliverable)
packages/core/domain/     Source rules, context windowing, conversation state
packages/core/application/Ports and technology-free use cases
packages/adapters/        pdf-parse, caption HTTP client, S3/MinIO, OpenAI, Secrets Manager
services/transcript/      Python caption service
infrastructure/terraform/ AWS Lambda, API Gateway, S3, Secrets Manager
features/, tests/         Gherkin acceptance, unit, browser and architecture tests
```

**Hexagonal, and enforced.** Dependencies point inward: inbound adapters → application → domain. The core imports no framework, no SDK, no environment variable and no network client. [`apps/web/src/composition.ts`](apps/web/src/composition.ts) is the only place concrete adapters are assembled, and [`tests/architecture.test.ts`](tests/architecture.test.ts) fails the build if a route reaches past it. Replacing S3, the caption source or the model vendor means writing one adapter and editing one file. Details in [ARCHITECTURE.md](ARCHITECTURE.md).

**Voice path.** The browser asks the backend for a Realtime session. The backend primes it with the source text and returns only a short-lived client secret, then steps aside: the browser negotiates SDP straight with OpenAI and media never transits our servers. Server-side voice activity detection is what lets a caller cut in mid-answer; the client closes its own caption on the same event so the transcript matches what was actually heard.

**Sources live on the server.** Ingestion returns an opaque `sourceId`, and later requests carry that id instead of the whole extraction. If the server has forgotten the session — a cold start, or another instance — the client resends the source once and the conversation continues. Storage is in-memory with a TTL and a cap, which the assessment names as sufficient; a shared store is a one-adapter swap.

**Large sources are windowed, not refused.** A 25 MB PDF can hold more text than any context window. The reader always sees the complete extraction; the model receives the largest faithful excerpt that fits, taken from the opening and the ending, with the elision marked so it never invents the middle. The budget is `CONTEXT_CHARACTER_BUDGET`.

**Uploads bypass the API.** Large PDFs go straight to object storage through a short-lived presigned form post, with progress shown. The server then reads the object, extracts, and deletes it in a `finally` block. This keeps multi-megabyte bodies away from a 6 MB Lambda payload limit.

**Hosting.** Terraform builds the Next.js image into ECR and runs it on Lambda behind API Gateway, alongside a caption Lambda, S3 and Secrets Manager. GitHub Actions deploys through OIDC with no long-lived AWS keys. Lambda suits intermittent demo traffic: no always-on ECS task, and it scales to zero between reviews. ECS Fargate would win on steady traffic and long-lived connections; it costs more to leave running for a demo.

---

## Trade-offs

- **Lambda over ECS.** Scale-to-zero and per-request billing fit a demo. The costs are cold starts, a 29-second API Gateway ceiling, and no shared process memory — which is exactly why sessions carry a rehydration fallback.
- **In-memory sessions over SQLite.** The assessment allows either. Memory has no schema, no migration and no file to ship; it forgets on restart, which the client already handles.
- **Window the context rather than chunk it.** The brief asks for no chunking, summarization or citations. Head-and-tail windowing keeps that promise and is honest with the reader about what the model can see. A long middle section is genuinely out of reach; retrieval would be the next step.
- **Two turns of context, not a full memory.** Recent exchanges are kept per session so follow-ups read naturally, capped so a long conversation cannot grow the prompt without limit.
- **A separate Python caption service.** `youtube-transcript-api` is the mature client for an endpoint with no official API. It costs a second runtime and a second Dockerfile, and buys a clean port boundary and a component that can be proxied or replaced on its own.
- **Fixed-window rate limiting, per process.** Enough to stop a public, unauthenticated, billable endpoint being trivially abused. Not a substitute for authentication or a shared limiter.
- **Content Security Policy keeps `unsafe-inline`.** Next.js inlines its own bootstrap. The directives that matter against injection and clickjacking are still enforced; nonce-based scripts would be the stricter next step.
- **No OCR.** A scanned PDF with no text layer is rejected with an explanation rather than silently producing nothing.
- **An Expo client is in the repository.** It is extra scope beyond the brief. The web application is the deliverable; the native client shares the same core and backend.

---

## YouTube on the deployed application

YouTube has no official way to read captions from a video you do not own, so every practical approach uses an unofficial endpoint — and YouTube blocks that endpoint from cloud provider address ranges. From a laptop it works; from AWS it returns a block.

The application handles this honestly: the caption service reports `CLOUD_BLOCKED`, and the interface explains the situation and offers a PDF instead of failing silently.

**To make it work on the deployed application**, route the caption service's outbound traffic through an address YouTube will answer. The service reads a proxy from the environment and applies it to every caption request:

```dotenv
TRANSCRIPT_PROXY_URL=http://user:password@proxy.example:8080
# or per scheme
TRANSCRIPT_PROXY_HTTP_URL=...
TRANSCRIPT_PROXY_HTTPS_URL=...
```

On AWS, set the Terraform variable `transcript_proxy_url` at apply time; it is marked `sensitive`, never committed, and Lambda encrypts function environment variables at rest. A residential or ISP-grade proxy pool is what YouTube actually answers; a datacentre proxy is usually blocked in the same way the Lambda is. `GET /health` on the caption service reports `"proxied": true` so you can confirm the wiring without exposing the address. With no proxy configured the behaviour is unchanged.

Locally, `TRANSCRIPT_MODE=live` fetches real captions directly and `TRANSCRIPT_MODE=mock` returns a deterministic transcript for tests.

---

## Testing

```bash
npm run lint
npm run typecheck
npm test           # Vitest: domain, use cases, adapters, routes, client
npm run build
```

Browser and acceptance suites need the local services running:

```bash
npx playwright install chromium
npm run test:e2e                              # Playwright, including a 390 px viewport
npm run test:gherkin -- --tags 'not @external'  # Cucumber acceptance scenarios
```

Scenarios tagged `@external` need real providers or a deployed environment; mocks do not satisfy them. Undefined or pending steps fail the suite: pending steps are not passing until they have executable evidence. Before publishing, `npm run security:secrets` scans history and publication candidates with Gitleaks; CI runs it too, alongside a build with canary secrets that greps the emitted client bundle.

Mobile: `npm run typecheck --prefix apps/mobile && npm test --prefix apps/mobile`.

---

## Troubleshooting

| Problem                      | Check                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Port 3000 already in use     | Stop the previous `web` or `dev` service; they share the port.                                               |
| No sound in mock mode        | Mock mode has no real audio. Set `PROVIDER_MODE=live` and a key.                                             |
| Microphone unavailable       | Voice needs HTTPS or `localhost`, plus browser permission. The interface says so and keeps typing available. |
| YouTube captions unavailable | Try a captioned video, check `TRANSCRIPT_MODE`, and read the section above.                                  |
| Scanned PDF rejected         | It has no text layer. OCR is not implemented.                                                                |
| Environment change ignored   | Restart Compose; rebuild for mobile public variables.                                                        |

```bash
docker compose --env-file .env.local ps
docker compose --env-file .env.local logs --tail=100 dev transcript
```

---

## Further reading

- [Architecture](ARCHITECTURE.md) · [Terraform setup](infrastructure/terraform/README.md) · [Service setup](SERVICE-SETUP.md)
- [Walkthrough script](WALKTHROUGH.md) · [Native client](apps/mobile/README.md) · [Expo EAS builds](apps/mobile/EAS.md)

## AI-assisted development

AI tooling (Claude Code and ChatGPT) was used throughout: requirements decomposition into executable Gherkin, designing the hexagonal boundaries, writing implementation and tests, debugging the Realtime event stream, and reviewing for security and requirement drift. Claims about behaviour are backed by executable tests or clearly labelled operational notes.
