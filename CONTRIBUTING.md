# Contributing to Ursly

## Before opening an issue

Use the issue forms for reproducible bugs and focused feature proposals. Do not include API keys, tokens, private documents, or unredacted provider responses. Security vulnerabilities belong in a private GitHub security advisory, not a public issue.

## Local validation

From the repository root, install Node.js 22 and Docker Desktop, then run:

```bash
npm ci
npm run lint
npm run typecheck
npm test
```

For changes that affect the running stack, also run the relevant Docker, Gherkin, Playwright, mobile, or Terraform checks documented in the [README](README.md) and [service setup guide](SERVICE-SETUP.md). Keep provider-backed tests clearly marked; mock mode is the deterministic default.

## Pull requests

Keep each pull request focused and describe the user impact, validation performed, deployment risk, rollback plan, and documentation impact. The pull request template calls out security-sensitive areas because this application handles uploaded documents, provider credentials, and billable model calls.

The default branch is `main`. Prefer a short branch name that describes the change, such as `fix/upload-cleanup` or `docs/operations-runbook`. CI must pass before merge.

## Architecture expectations

Preserve the dependency direction described in [ARCHITECTURE.md](ARCHITECTURE.md): inbound adapters call the application, the application owns ports, and the domain remains independent of frameworks, SDKs, environment variables, and network clients. Add or update tests at the narrowest useful boundary.
