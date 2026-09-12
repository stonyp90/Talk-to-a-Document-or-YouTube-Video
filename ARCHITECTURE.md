# Monorepo and hexagonal architecture

```text
apps/
  web/                 Next.js UI + HTTP inbound adapters + composition root
  mobile/              Expo/React Native client + device/WebRTC adapters
packages/
  core/src/domain/     Source models, validation, conversation state transitions
  core/src/application/Ports and technology-independent use cases
  adapters/src/        PDF.js, transcript HTTP/mock, S3/MinIO, OpenAI, Secrets Manager
services/transcript/   Python HTTP caption service (local container / Lambda image)
infrastructure/
  terraform/           Operator bootstrap, demo root and reusable AWS module
  scripts/             Deployment smoke, asset-security and container-test tooling
tests/                 Cross-package architecture, BDD and browser regression tests
features/              Executable Gherkin acceptance contract
```

Dependency direction is **inbound adapters → application → domain**. Outbound
adapters implement interfaces owned by the application; the core never imports
Next.js, React, AWS SDKs, PDF.js, OpenAI, environment variables or network clients.
`apps/web/src/composition.ts` assembles concrete adapters and use cases. Routes
only decode/validate HTTP inputs and call that assembly point. Shared source
models remain in the core and are imported by both clients.

`PdfTextPort`, `TranscriptPort`, `VideoSearchPort`, `TemporaryUploadPort`,
`ConversationPort`, `CredentialPort`, `AccountStorePort`, `NotifierPort` and `SecureTokenPort`
define replaceable boundaries. To replace S3, implement the
temporary-upload port and change composition. To replace the conversation vendor,
implement the conversation port and supply its credential adapter. Keep provider
payloads and SDK types out of the domain. The current presigned-upload contract
is an HTTP multipart POST with URL/fields; a provider that uses a different upload
protocol needs a translating adapter or an explicit versioned API contract change.
Ports avoid business-model coupling; they do not make every transport interchangeable.

`VideoSearchPort` exists because a spoken source is named, not spelled: the
speaker says an artist and the application has to turn that into a video. The
core owns only the rules — the query is trimmed to one phrase and bounded, the
list is capped, de-duplicated by video id, and entries with no id or no link are
dropped — while `packages/adapters/src/videoSearch.ts` owns the YouTube Data API
call, its deadline, its key and its `videoCaption=closedCaption` filter. That
filter is a product rule enforced at the boundary: this application can only
talk about a video it can read, so an uncaptioned result is not a source. The
same adapter returns deterministic fixtures when the mode is `mock` or no key is
configured, announcing it once, so local runs and the acceptance suites exercise
the spoken entry path without quota or network.

The voice vocabulary is domain, not interface. `packages/core/src/domain/voiceCommands.ts`
imports nothing and owns normalization, the per-language phrase sets, matching
with near-miss tolerance, and the separation of a command from the words spoken
around it. The browser engine is wrapped in `apps/web/src/lib/speech.ts`, which
hands each new phrase over once and says whether the engine has settled on it;
`VoiceActions` only decides what to do with what it is told. That split is why
the same rules can be tested without a microphone and why a recogniser quirk is
an adapter concern rather than a product one.

Streaming is a port method, not a transport detail. `ConversationPort.streamTextAnswer`
yields text deltas; the application validates the question before the first one
escapes, the OpenAI adapter turns the provider's own event stream into those
deltas, and the route re-frames them as server-sent events. Nothing above the
adapter knows the provider's event names, and the non-streaming method stays for
callers and contracts that do not want a stream.

Accounts follow the same split. `packages/core/src/domain/account.ts` owns email
normalization, the one-time-code rules and `chargeUsage`, the pure spend cap that
rolls its window over and refuses without touching the ledger.
`packages/core/src/application/accounts.ts` sequences sign-in, session lookup and
charging over the three account ports. Randomness, hashing, the server-side
pepper, mail delivery and storage are adapters in `packages/adapters/src/accounts.ts`:
an in-memory store with the same eviction discipline and the same per-process
caveat as the session store, plus a notifier that writes the message to the
server log locally and signs a SES v2 request when `EMAIL_MODE=ses`. What a
message says is not the adapter's business: every email is rendered by the one
template in `packages/core/src/domain/email.ts`, which owns the brand, both
parts (HTML and plain text) and both languages, and the adapter is handed a
message already written. One template and one delivery means a second kind of
mail cannot arrive looking like it came from somewhere else. The gate itself —
cookie, `requireAccount`, `guard` and the unit cost table — is an inbound HTTP
concern in `apps/web/src/auth.ts`, assembled through the composition root like
every other adapter. `AUTH_MODE` is read there and nowhere else, and anything
but the exact word `disabled` means the gate is required, so a misconfigured
deployment fails closed.

PDF signature/size checks, normalization, caption URL validation, context limits,
question validation, the spend cap and upload deletion orchestration are
application/domain work.
S3 object I/O, PDF parsing, caption HTTP calls, model HTTP payloads, credential
retrieval, code generation, hashing and mail are adapters. Temporary object cleanup runs in the use case's `finally`
block, including parser failures. No extracted-text database is introduced.

The root npm workspace covers `apps/web` and `packages/*` with a single lockfile
and centralized tooling. The Expo app retains its own lockfile/toolchain to avoid
forcing native React/Metro dependency versions into the Next.js build. It is still
in the same repo and CI gate; native build scripts copy the same core source.
Python dependencies remain owned by the transcript service.

Use tests first: failing use-case tests with fake ports, then implementation,
adapter contract tests, and finally route/BDD/browser regression tests. Architecture
tests enforce core isolation and stop HTTP routes importing outbound adapters.
Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`,
`npm run test:gherkin -- --tags 'not @external'` and `npm run test:e2e`.
Terraform has its own credential-free validate/mock-test gate; see its README.

Docker Compose includes every running application service: web/backend, transcript,
and S3-compatible MinIO plus bucket initialization. Terraform is deployment tooling,
not a long-running service. iOS and Android simulators run on the host; this migration
does not claim new device permissions or verified simulator/media access.

Interface language is a routing concern, not a domain one. `apps/web/proxy.ts`
negotiates `en` or `fr` (cookie, then `Accept-Language`) and rewrites the root
URL to `app/[lang]`, so both languages are prerendered with the right `lang`.
`apps/web/app/i18n` holds the English-keyed dictionary and the client provider;
the core never sees a locale. Presigned uploads go straight from the browser to
the object store, so the Content Security Policy — fixed at build time in
`next.config.ts` — must name the public store address the runtime hands out;
Compose passes the same value as a build argument and as an environment variable.
