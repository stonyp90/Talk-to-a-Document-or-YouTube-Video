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

`PdfTextPort`, `TranscriptPort`, `TemporaryUploadPort`, `ConversationPort` and
`CredentialPort` define replaceable boundaries. To replace S3, implement the
temporary-upload port and change composition. To replace the conversation vendor,
implement the conversation port and supply its credential adapter. Keep provider
payloads and SDK types out of the domain. The current presigned-upload contract
is an HTTP multipart POST with URL/fields; a provider that uses a different upload
protocol needs a translating adapter or an explicit versioned API contract change.
Ports avoid business-model coupling; they do not make every transport interchangeable.

PDF signature/size checks, normalization, caption URL validation, context limits,
question validation and upload deletion orchestration are application/domain work.
S3 object I/O, PDF parsing, caption HTTP calls, model HTTP payloads and credential
retrieval are adapters. Temporary object cleanup runs in the use case's `finally`
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
