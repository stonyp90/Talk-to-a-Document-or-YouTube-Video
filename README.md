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

Open **[localhost:3000](http://localhost:3000)** for the landing page, or **[localhost:3000/app](http://localhost:3000/app)** to go straight to the application. The defaults run in `mock` mode, which needs no OpenAI key, no AWS account and no network: PDF extraction is real, and provider replies are deterministic stand-ins.

| Service                | Address                                                           |
| ---------------------- | ----------------------------------------------------------------- |
| Landing page           | [localhost:3000](http://localhost:3000)                           |
| Application            | [localhost:3000/app](http://localhost:3000/app)                   |
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

### Choose the voice that answers

`OPENAI_REALTIME_VOICE` selects it. The default is `marin`, one of the two voices trained for the realtime model; `OPENAI_REALTIME_VOICE_SPEED`, `OPENAI_REALTIME_TURN_DETECTION`, `OPENAI_REALTIME_TURN_EAGERNESS` and `OPENAI_REALTIME_NOISE_REDUCTION` tune the rest of the exchange.

To answer in **your own voice**, the provider has to mint a custom voice from two recordings of you, and that identifier then replaces the voice name. The helper tells you what to record:

```sh
npm run voice:enroll -- --language fr
```

It prints the consent sentence you must read word for word, and what the speech sample needs to contain. Record both, then:

```sh
npm run voice:enroll -- --name my-voice --language fr --consent consent.wav --sample sample.wav
```

It returns a `voice_…` identifier to put in `OPENAI_REALTIME_VOICE`. Custom voices are limited to eligible OpenAI accounts, and no phrase spoken inside the application can clone a voice: the enrolment is deliberate, consented and done once.

---

## What a visitor sees

1. **The introduction, once.** A first visit opens a 36-second silent video in the
   visitor's language (English or French), with captions, a transcript and a
   _Skip intro_ button from the first frame. It is remembered per browser and can
   be replayed from the top menu.
2. **A fixed top menu.** It carries the three control modes — _Voice to action_
   (default), _Keyboard to action_ and _Motion to action_, shown as a beta that is
   not available yet — plus the _Platform_ section, the intro and the language
   switch. It stays in place while scrolling.
3. **The workspace, right away.** Add a PDF or a captioned YouTube video, then ask
   by voice or by typing. A first answer is three actions away.
4. **Platform**, a static section reachable from the menu: a human stays in the
   loop, voice models that adapt to each speaker with consent, voice, movement or
   keyboard, and the surfaces to come (connected objects, 3D objects), with a
   dateless roadmap.

### Pages

Two pages, deliberately separate. `/<lang>` is the landing page: what Ursly is,
the introduction, then the story in one order — how we build, the
platform, the guide, and the mobile downloads
(`apps/web/app/components/LandingPage.tsx`). That order lives in
`apps/web/app/content/story.ts`, which the page, the fixed menu and the suites
all read, so it changes in one place. The build loop leads: how this was made is
the first thing a reader meets, before any claim about the product.

`/<lang>/app` is the application: add a source, ask a question, by voice or
keyboard (`apps/web/app/components/Workspace.tsx`). It is not on the landing
page at all, and it is never far from it — the fixed menu, the hero, the end of
every story section, a closing invitation and the footer each carry the way in.
The two components share only that menu, the footer and the language provider —
the landing page holds no conversation state and the application holds none of
the story. The bare `/app` is rewritten to the negotiated language, so an
installed app (`start_url: "/app"`) opens the tool.

### Languages

English is the source language; French is a full translation. Every page is
served under `/en` and `/fr`, prerendered with the right `<html lang>`. The root
URL follows the browser (`Accept-Language`), and an explicit choice from the menu
is remembered in a cookie. Interface copy is keyed by its English text in
`apps/web/app/i18n/fr.ts`; a missing key falls back to English. The intro video
exists once per language (`scripts/brand/intro-video.mjs` renders both) because
its text is burned into the frames.

### Rebuilding the introduction

The film is six six-second scenes: what Ursly is, a source going in, voice to
action, motion to action, the keyboard demoted, and the build loop that produces
all of it. Its words live in
[`apps/web/app/content/intro-video.ts`](apps/web/app/content/intro-video.ts) —
which the dialog, the transcript and the captions all read — and are repeated
for the renderer in `scripts/brand/intro-copy.mjs`, with
`scripts/brand/intro-copy.test.ts` failing the suite if the two ever disagree.
The duration is the scene count times the scene length, everywhere, so the film
is lengthened by adding a scene and nothing else.

Three commands, in order, and only the last is needed if the app's chrome has
not changed:

```bash
npm run dev                       # anything serving the app
node scripts/brand/record-app.mjs # footage of the product actually being used
node scripts/brand/capture-app.mjs # the committed stills, used as a fallback
node scripts/brand/intro-video.mjs # draws the frames and writes the .vtt files
```

Everything it draws comes from this repository: the scenes are SVG rasterised
with ImageMagick, the product is the recording under `scripts/brand/footage`,
and ffmpeg cross-fades the six clips into one continuous take. Re-record before
re-rendering whenever the application's chrome has changed, or the film will
show an app that no longer exists.

### Being found and quoted

A product explained by a short film is invisible to any reader that cannot
watch one, and search engines and assistants never can. The same film is
therefore published three more ways. Each language page carries a `schema.org`
graph naming the organization, the site, the application and the introduction
as a `VideoObject` with its duration, its captions and its full transcript.
`/sitemap.xml` lists both languages with `hreflang` alternates, `/robots.txt`
welcomes crawlers and keeps `/api/` out, and `/llms.txt` is a plain reading of
the product and the words of the video, for the models that answer questions
without ever rendering a page.

The graph is built by `packages/core/src/domain/discoverability.ts`, which is
pure: it reads a profile and returns linked data. Where that profile comes from
is `apps/web/app/seo/profile.ts`, the only place that touches the environment.

Publishing the introduction on YouTube adds one thing the origin cannot: a copy
on a host every answer engine already crawls. Set `INTRO_VIDEO_YOUTUBE_ID_EN`
and `INTRO_VIDEO_YOUTUBE_ID_FR` once the videos are up and the graph points at
them, with the self-hosted file kept as `contentUrl`. Leave them empty and
nothing breaks: the graph simply describes the file this origin serves. The
values are read when the pages are prerendered, so they are build arguments,
not runtime settings.

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

**Voice path.** The browser asks the backend for a Realtime session. The backend primes it with the source text and returns only a short-lived client secret, then steps aside: the browser negotiates SDP straight with OpenAI and media never transits our servers. Provider-side voice activity detection is what lets a caller cut in mid-answer; the client closes its own caption on the same event so the transcript matches what was actually heard. Detection is semantic by default, so it waits for a finished thought rather than a silent gap and does not cut off a caller who pauses to think.

**Spoken answers are written to be heard.** The session carries delivery guidance on top of the source: short sentences, no markup a listener cannot hear, two or three sentences before handing the floor back, and the caller's own language. A blocked autoplay no longer ends a working call — the next tap starts the audio.

**Signing in is the budget control.** Every endpoint that calls a provider —
ingestion, uploads, extraction, typed questions, the streamed answer, a voice
session and the turn recorder — requires a session cookie, and charges a
per-account allowance on top. Login alone would not have solved the problem it
exists for: whoever signs up can still spend the money. Sign-in is a mailed
one-time code, so there is no password to store; the code is hashed with a
server-side pepper and never logged, returned or kept in clear. `/api/health`
and `/api/openapi` stay open. See [The gate](#the-gate) below.

**A spoken source is searched, not spelled.** Nobody dictates "watch question mark v equals". Saying "YouTube, Miles Davis" posts the words to `POST /api/videos/search`, which asks the YouTube Data API only for videos that carry closed captions — an uncaptioned result would be a source that fails at the next step — and returns the best matches. The client opens the first and keeps the rest as alternatives. `VideoSearchPort` is the boundary: with `YOUTUBE_SEARCH_MODE=mock`, or with no `YOUTUBE_API_KEY` at all, the adapter returns deterministic fixtures derived from the query and says so in the log, so the spoken entry path works locally and in CI with no quota and no network.

**Speaking is the interface, not a shortcut.** Listening is continuous: the
browser engine hangs up by itself after a pause and the panel picks the
microphone back up, so a reader is not re-arming it between sentences. Only
settled speech runs a command — acting on a hypothesis fires "back" on the way
to "backpack" — while the interim text is shown so the reader can see they are
heard. Anything that is not a command becomes the question, sent after a pause
or when they say "send it". Adding words to a built-in command sends their
words instead of its: "summarize this" runs the shortcut, "summarize this in
three short points" asks for exactly that. `packages/core/src/domain/voiceCommands.ts`
owns the whole vocabulary — folding accents so French reaches its phrases,
matching a command anywhere in a sentence, tolerating one mis-heard word, and
separating the command from what was said around it. Saved phrases add to the
built-in wordings rather than replacing them, so customising one action never
breaks another.

**The answer arrives as it is written.** `POST /api/text-chat/stream` sends the
answer as server-sent events and the interface renders each delta, so a reader
watches words appear instead of a spinner. Send becomes Stop while it runs, and
stopping keeps what already arrived — it is the reader's decision, not a
failure. A runtime or proxy that cannot stream answers `STREAM_UNSUPPORTED`,
and the client falls back to the blocking endpoint rather than failing. Answers
are parsed to a description of the text and rendered as elements, never as
HTML, so a source that quotes markup renders it as words. Voice turns are
posted to `POST /api/conversation/turns`, which is what keeps one thread of
memory: a typed follow-up knows what was said out loud, and the other way
round.

**Sources live on the server.** Ingestion returns an opaque `sourceId`, and later requests carry that id instead of the whole extraction. If the server has forgotten the session — a cold start, or another instance — the client resends the source once and the conversation continues. Storage is in-memory with a TTL and a cap, which the assessment names as sufficient; a shared store is a one-adapter swap.

**Large sources are windowed, not refused.** A 25 MB PDF can hold more text than any context window. The reader always sees the complete extraction; the model receives the largest faithful excerpt that fits, taken from the opening and the ending, with the elision marked so it never invents the middle. The budget is `CONTEXT_CHARACTER_BUDGET`.

**Uploads bypass the API.** Large PDFs go straight to object storage through a short-lived presigned form post, with progress shown. The server then reads the object, extracts, and deletes it in a `finally` block. This keeps multi-megabyte bodies away from a 6 MB Lambda payload limit.

**Hosting.** Terraform builds the Next.js image into ECR and runs it on Lambda behind API Gateway, alongside a caption Lambda, S3 and Secrets Manager. GitHub Actions deploys through OIDC with no long-lived AWS keys. The default runtime is Lambda because its scale-to-zero behavior and per-request billing suit intermittent demo traffic. ECS Fargate would win on steady traffic and long-lived connections; it costs more to leave running for a demo.

---

## The gate

| Caller               | `/api/health`, `/api/openapi` | Paid endpoints                       |
| -------------------- | ----------------------------- | ------------------------------------ |
| Anonymous            | 200                           | `401 UNAUTHENTICATED`                |
| Signed in, under cap | 200                           | 200, and the allowance is charged    |
| Signed in, over cap  | 200                           | `429 USAGE_LIMIT` with `Retry-After` |

429 rather than 402: nothing is for sale, so "payment required" would be a lie,
and `Retry-After` tells the reader exactly when their allowance reopens. The
streamed answer runs the gate _before_ the event stream opens, so a refusal is
an ordinary JSON reply the client can act on rather than an error frame. The
gate also runs before each route validates its body, which means a malformed
request still costs its units — the price of letting nothing at all slip in
front of it, and bounded by the same per-address limiter.

What each call costs, against an allowance of `USAGE_LIMIT_UNITS` (300) per
`USAGE_WINDOW_MS` (24 h). Every number is configuration with a named default:

| Endpoint                            | Units | Why                                           |
| ----------------------------------- | ----- | --------------------------------------------- |
| `POST /api/realtime/session`        | 50    | A voice session bills for as long as it lives |
| `POST /api/ingest`                  | 10    | A whole document extracted and primed         |
| `POST /api/uploads/extract`         | 10    | The same work, after a direct upload          |
| `POST /api/text-chat`, `.../stream` | 5     | One question against the source               |
| `POST /api/uploads`                 | 1     | Only a presigned form, but not a free-for-all |
| `POST /api/videos/search`           | 2     | Third-party search quota, not model tokens    |
| `POST /api/conversation/turns`      | 1     | Bookkeeping; it calls no provider             |

**Signing in.** `POST /api/auth/request-code` mails a code and answers `204`
whether or not the address is known, so it cannot be used to find out who has an
account. `POST /api/auth/confirm` exchanges the code for an `HttpOnly`,
`SameSite=Lax`, `Secure` session cookie. `GET /api/auth/session` reports the
signed-in address; `DELETE` on the same path signs out. Locally, `EMAIL_MODE`
defaults to `log`: the code appears in the server log as a `local sign-in code`
line, so the flow can be completed with no mail infrastructure. `EMAIL_MODE=ses`
sends it through Amazon SES instead.

**The escape hatch fails closed.** `AUTH_MODE=disabled` resolves every request
to one fixed local account, which is what keeps Compose, the acceptance suite
and the browser suite running. Any other value — including an unset one and a
typo — means `required`, so a misconfigured deployment is shut, never open.

---

## Trade-offs

- **Lambda over ECS.** Scale-to-zero and per-request billing fit a demo. The costs are cold starts, a 29-second API Gateway ceiling, and no shared process memory — which is exactly why sessions carry a rehydration fallback.
- **In-memory sessions over SQLite.** The assessment allows either. Memory has no schema, no migration and no file to ship; it forgets on restart, which the client already handles.
- **Window the context rather than chunk it.** The brief asks for no chunking, summarization or citations. Head-and-tail windowing keeps that promise and is honest with the reader about what the model can see. A long middle section is genuinely out of reach; retrieval would be the next step.
- **Two turns of context, not a full memory.** Recent exchanges are kept per session so follow-ups read naturally, capped so a long conversation cannot grow the prompt without limit.
- **A separate Python caption service.** `youtube-transcript-api` is the mature client for an endpoint with no official API. It costs a second runtime and a second Dockerfile, and buys a clean port boundary and a component that can be proxied or replaced on its own.
- **Fixed-window rate limiting, per process.** It bounds one address; a handful of addresses walk around it, which is why the paid endpoints now sit behind a session and a per-account cap as well. Still not a shared limiter.
- **Accounts and ledgers in memory, like sessions.** The same trade as the session store, and the same caveat: a restart forgets who is signed in and what they have spent, and a second instance counts on its own. A shared store is a one-adapter swap, and it is the first thing to do before running more than one instance.
- **A mailed code instead of a password.** No password to store, to leak or to reuse from somewhere less careful, and the mailbox is the proof. The cost is a mail dependency in production and a code with a short life.
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

## How we build

Every feature walks one loop, and it is done only when the loop closes. The landing page explains and animates the same loop for visitors.

1. **Concept** — an idea worth building, said plainly.
2. **Plan** — how it will be built, written before any code.
3. **Tools** — the best technology for the job, not the most familiar.
4. **Local** — the whole stack on one machine with Compose, every dependency included.
5. **Test** — behaviour (Gherkin), contract and unit tests on every cycle, so nothing regresses when the next feature lands.
6. **Secure** — security and compliance are the law: secret scanning, canary builds, CodeQL and dependency audits run on every change.
7. **Deliver** — continuous integration and delivery: every change is checked, then shipped automatically from `main`.
8. **Production** — deployed through OIDC and smoke-tested in production.
9. **Listen** — enough feedback from real people to make the models better each cycle.
10. **Train** — the direction we are building toward: what the loop learns trains the models, and every model provider gets its turn. The best model from one provider proves itself, an event hands off to the best from the next, each iterating on its own, locally and then in beta, through this same loop before the next step.

The training stage has a loop of its own, and the big loop waits for it. We build by voice because it is faster than a keyboard; gestures come next, and the motion mode shown in the top menu is the first step.

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
- [Publishing the introduction on YouTube](YOUTUBE.md)

## AI-assisted development

AI tooling (Claude Code and ChatGPT) was used throughout: requirements decomposition into executable Gherkin, designing the hexagonal boundaries, writing implementation and tests, debugging the Realtime event stream, and reviewing for security and requirement drift. Claims about behaviour are backed by executable tests or clearly labelled operational notes.
