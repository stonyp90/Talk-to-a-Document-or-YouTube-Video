# Security review — 2026-09-08

No AWS/OpenAI credential was detected in the available Git history (one commit, all refs) or in current publication candidates. This is a scoped automated scan and source review, not a guarantee that the application has no vulnerabilities or that the AWS account is secure.

## Changes applied

- Added `npm run security:secrets`: Gitleaks scans all available Git history and an isolated snapshot of tracked/unignored files. Sensitive credential files, Terraform state/variable files, generated directories and symlinks fail the publication check. Output is redacted. Temporary AWS access-key identifiers have an additional detection rule.
- Added the scanner to the required CI aggregate. The scanner image is pinned by digest; checkout does not retain its Git token in the scanner/deployment jobs. No Git remote is configured here, so remote CI and branch protection have not been activated or verified.
- Expanded Git and Docker exclusions for private keys, AWS credential directories, provisioning/signing credentials and local output. Exclusion rules do not erase files already committed; history was scanned separately.
- Bound this project's Docker services to `127.0.0.1`, including MinIO with its demonstration credentials. These credentials are local fixtures, not AWS credentials. Other projects' containers are outside this review.
- Retired the anonymous permanent-key SDP relay (`/api/realtime/connect`, now HTTP 410). Native voice uses the ephemeral credential returned by the session endpoint and exchanges SDP directly with OpenAI, like the web client. Missing credentials fail before microphone initialization; provider errors cannot echo credentials through this new exchange. This follows [OpenAI's ephemeral WebRTC connection flow](https://developers.openai.com/api/docs/guides/realtime-webrtc).
- Updated the mobile PostCSS dependency through a compatible override to 8.5.28.
- Corrected animated-value initialization flagged by the existing React lint rule, retaining stable animation instances.

## Findings that still require action before public production

1. **Public API abuse:** session issuance, text requests and uploads still lack user authentication and per-user quotas. Removing the SDP relay does not close this risk: an anonymous caller can still request ephemeral sessions or consume paid services. Add server-verified identity, authorization, shared rate limits and spending/upload quotas before exposing live providers. CORS and ephemeral credentials alone are not access control.
2. **Mobile dependency vulnerabilities:** the final production dependency audit reports 19 affected package entries (9 high, 10 moderate, 0 critical). Most entries inherit the same issues through Expo tooling. Remaining root advisories concern `image-size` parser denial of service and `uuid` buffer bounds. The latest published `image-size` version checked (2.0.2) remains covered by the advisories. No forced Expo major migration or audit suppression was applied. Do not process untrusted build assets in this toolchain; assess and test a supported dependency migration separately.
   - [ICNS parser advisory](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr)
   - [JXL/HEIF parser advisory](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq)
   - [UUID advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq)
3. **Credentials shared in conversation:** AWS session credentials were supplied in this conversation. A clean repository does not undo that disclosure. Revoke the shared sessions where supported and renew credentials through the normal AWS login process; do not put replacements in chat or Git. This review has not revoked sessions or audited the live AWS account.
4. **Deployment permissions:** infrastructure code separates runtime permissions from deployment permissions and scopes runtime access to the application's resources. The deployment role still has regional API Gateway management permissions; use an isolated deployment account and review effective cloud policies before production. The deployed account's current policies were not certified here.
5. **Previously built apps:** earlier EAS APK/iOS simulator binaries do not contain this turn's native changes. Rebuild them before deploying the retired-relay backend. JavaScript exports and unit tests below do not certify live audio or physical-device behavior.

## Evidence

- Gitleaks history scan: no findings in one available commit. Publication-candidate scan: no findings.
- Expanded scan including ignored output: 33 findings across 24 files, all verified ignored by Git. These include internal generated Next.js signing/cache keys and generated native/CDK output. Do not publish generated directories or raw scan output; these were not broadly allowlisted.
- Negative scanner test: a synthetic temporary AWS identifier in an isolated temporary Git repository correctly fails publication; the fixture was removed.
- Root production dependency audit: zero reported vulnerabilities. Mobile final production audit: 19 as detailed above.
- Web/shared tests: 75 passed. Mobile tests: 22 passed, including ephemeral transport, missing-credential and sanitized-error checks.
- Root/mobile TypeScript checks pass. Next production build passes. Lint passes with one existing lifecycle-ref warning in `apps/mobile/App.tsx`.
- Android and iOS JavaScript exports pass. These are not newly signed native releases.

The working tree already contained extensive uncommitted application work. No history rewrite, commit, push, secret deletion from other projects or AWS account mutation was performed.
