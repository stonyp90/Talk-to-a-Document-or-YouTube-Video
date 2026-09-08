# Demo readiness — September 8, 2026

**The complete live-service demo is not yet ready.** Real PDF ingestion, OpenAI text chat, and Realtime credential issuance work locally and on https://ursly.io. Local YouTube retrieval subsequently succeeded after a network change. Real audio remains unverified. See the [requirements audit](REQUIREMENTS-AUDIT.md) and [latest recording status](docs/demo/RECORDING-STATUS.md).

| Check | Observed result |
| --- | --- |
| Local server `http://localhost:3100` | Available in `live` mode |
| Real PDF | Signed MinIO upload, exact extraction, and replay rejection verified |
| Web | 18 browser tests passed, including errors and late responses |
| Earlier local Android/iOS tests | Text responses and simulated start/mute/stop verified |
| Expo account | CLI session available for `stonyp90` |
| OpenAI key | Dedicated restricted key configured in `.env.local` and AWS Secrets Manager |
| Model access and quota | Responses and Realtime calls succeeded; future quota is not guaranteed |
| Real ephemeral credential | Issuance and expiration verified locally and on ursly.io |
| Real audio | Not validated; latest iOS simulator recording encountered CoreAudio failures |
| Real YouTube | Initially blocked; two videos later succeeded locally after changing networks |
| Physical phones and complete production behavior | Not certified by these checks |

## Server configuration

The key is configured. To replace it, set `OPENAI_API_KEY` in the root `.env.local`, which is excluded from Git. Do not publish the key in chat or overwrite an existing configuration.

```dotenv
OPENAI_API_KEY=<your-project-key>
PROVIDER_MODE=live
TRANSCRIPT_MODE=live
```

AWS credentials and Expo sign-in do not replace an OpenAI key. A ChatGPT subscription is not proof of API credit. Verify real calls and project limits before declaring readiness.

```bash
docker compose --env-file .env.local up -d --wait web
npm run demo:check -- http://localhost:3100
```

`demo:check` rejects mock mode, tests a real PDF and text response, and verifies a real ephemeral credential and expiration without printing the credential. Live calls may incur charges. Passing does not certify remaining quota or end-to-end audio.

Then perform an audible conversation: import a PDF, ask a spoken question, hear the response, inspect transcription, interrupt, mute, stop, recover from network loss, and switch between English and French on the native client. Repeat on every platform shown in the demo.

## YouTube

The initial real Python-service tests were blocked by YouTube. On the new connection, `UF8uR6Z6KLc` and `jNQXAC9IVRw` returned real captions. Test the exact demo videos again on the intended network; local success does not certify AWS access. Keep a PDF fallback and disclose cloud limitations. A mock transcript does not satisfy real ingestion requirements.

## Local demo conditions

- Keep Docker running and the Mac available.
- Android requires `adb reverse` for ports 3100 and 9002 in this demo environment.
- The iOS simulator uses the local API on port 3100.
- Local builds are not autonomous phone distributions.
- Before commercial public use, address access controls, quotas, and the [security review](SECURITY-REVIEW.md).
