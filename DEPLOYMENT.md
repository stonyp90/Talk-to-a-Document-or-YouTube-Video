# Verified deployment — September 8, 2026

The web app and backend are deployed at **https://ursly.io** in AWS `us-east-1`, account `436136277668`.

- Route 53: AWS nameserver delegation verified; domain alias targets API Gateway.
- HTTPS: existing ACM certificate, regional domain, and `$default` stage mapping.
- Runtime: two Lambda images, immutable ECR tags, and private temporary S3 storage.
- GitHub Actions: OIDC restricted to this repository and the `production` environment, using immutable repository identifiers in the trust policy. No permanent AWS key was added to GitHub.
- Separate bootstrap, application, and domain Terraform states, stored in encrypted, versioned S3.

## Observed evidence

The [CI validation](https://github.com/stonyp90/Talk-to-a-Document-or-YouTube-Video/actions/runs/34227614084) and [first successful deployment](https://github.com/stonyp90/Talk-to-a-Document-or-YouTube-Video/actions/runs/34227995926) cover revision `da64665a02fe409dd223f2dc4a3b87d33baf53e9`. Later runs may deploy newer revisions; check GitHub Actions for the current version.

`node infrastructure/scripts/smoke.mjs https://ursly.io` passed: HTTP health, HTML, signed S3 form, real PDF upload, exact extraction, and rejection of a second extraction after consuming the file. Local evidence also includes 75 unit tests and 64 BDD scenarios / 361 steps.

## Outstanding limitations

**Deployment is not complete production validation.**

- The local OpenAI key and `ursly/openai` secret are configured. Real text calls and Realtime credentials were verified on September 8, 2026. Audio still needs validation: the browser previously denied microphone access, and the latest iOS simulator recording encountered CoreAudio failures. Health `mode: live` reports configuration, not effective provider access.
- AWS YouTube retrieval returned `CLOUD_BLOCKED` / HTTP 403 for `UF8uR6Z6KLc`. Google registration alone does not fix this. Local retrieval subsequently succeeded after a network change; see [recording status](docs/demo/RECORDING-STATUS.md).
- Demo routes are public. Add appropriate authentication and per-user limits for public paid-provider use.
- Release `v0.1.0-demo.1` uses the local backend. New HTTPS mobile builds and physical-phone tests remain necessary. A simulator build is not an iPhone IPA.
- Mobile dependencies still have findings documented in [SECURITY-REVIEW.md](SECURITY-REVIEW.md).

See [SERVICE-SETUP.md](SERVICE-SETUP.md) for account setup, credentials, and YouTube integration limits.
