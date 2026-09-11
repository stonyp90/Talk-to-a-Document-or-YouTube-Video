# Security policy

## Reporting a vulnerability

Please report suspected vulnerabilities privately through [GitHub Security Advisories](https://github.com/stonyp90/Talk-to-a-Document-or-YouTube-Video/security/advisories/new). Do not open a public issue, paste credentials or tokens into a comment, or upload a private document as a reproduction.

Include the affected component, impact, reproduction steps, and a minimal redacted proof of concept. If the issue involves a live credential, revoke it immediately and mention only the credential type—not its value.

## Supported branch

| Branch | Support                                |
| ------ | -------------------------------------- |
| `main` | Current public demo and security fixes |

This is a public demo application. Deployed provider and infrastructure configuration is intentionally kept outside the repository; see [SERVICE-SETUP.md](SERVICE-SETUP.md) for the safe configuration boundary.

## Security controls

The repository uses secret scanning and push protection, CI secret checks, client-bundle canary checks, dependency review, CodeQL analysis, and OIDC-based AWS deployment. Changes affecting uploads, provider credentials, public endpoints, or Terraform should explain their security impact in the pull request.
