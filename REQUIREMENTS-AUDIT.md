# PDF requirements audit — deployed application

Date: September 8, 2026. Reference: `Talk to a Document.pdf`, five pages, “Full-Stack Developer Take-Home Assessment.” This audit supersedes earlier reports of an unreachable domain, missing repository, and missing OpenAI key. Later recording evidence is linked below.

**Full compliance has not been demonstrated.** Web hosting, deployed PDF ingestion, real text chat, and Realtime credential issuance work. YouTube subsequently succeeded locally. Real audio and the complete acceptance walkthrough remain outstanding.

## Scope

The required deliverable is a **publicly accessible, mobile-first web application**. Expo binaries, Ursly branding, and bilingual support are additional user requests, not replacements for the web requirements.

The PDF permits a **local demonstration of real YouTube captions** when cloud addresses are blocked. Deployed YouTube is a bonus in the PDF and an additional user request. Mock transcripts do not satisfy the requirement.

Persistent authentication, durable storage, OCR, chunking, summarization, and citations are not mandatory. The proposed stack is recommended, not required. No submission or communication instructions contained in the PDF have been executed.

## Functional and security requirements

| ID | Requirement | Evidence and remaining limits |
| --- | --- | --- |
| F01 | Web interface for PDF and YouTube URL | Both tabs are visible at https://ursly.io. AWS YouTube remains unverified after the previously observed block. |
| F02 | PDF ≤ 25 MB | **Verified on AWS:** a valid 26,214,400-byte PDF was accepted and extracted; one additional byte was rejected with HTTP 400. The code uses 25 MiB. This does not cover every PDF type. |
| F03–F04 | Server extraction and deployed PDF ingestion | **Verified:** original 122,230-byte PDF produced 5,729 characters, including first- and last-page content. Browser import, direct S3 upload, extraction, and replay rejection after deletion were tested. |
| F05–F06 | Real server-side YouTube captions | Initial live tests returned `CLOUD_BLOCKED` / 403 locally and on AWS. **Later local success:** `UF8uR6Z6KLc` produced 12,131 characters and `jNQXAC9IVRw` produced 217 after a network change. Native import and preview were observed; see recording status. |
| F07 | Collapsible extracted-text preview | **Verified in the deployed browser:** “Extracted text · 5,729 characters” and complete PDF content were visible. |
| F08–F09 | Source text available as context | Real answer “25 MB” matched the PDF. **Remaining gap:** a 60,000-character limit absent from the requirements. A PDF under 25 MB can exceed it. Address provider context limits rather than simply removing validation. |
| F10–F12 | Start Voice Chat, WebRTC, real microphone and audio output | Client and button exist; **real credential verified**. Browser microphone denial and later iOS CoreAudio failures prevent complete bidirectional audio proof. |
| F13 | Real-time conversation transcript | Event handling and simulated tests exist. **Verify with real audio:** text chat does not validate microphone transcription. |
| F14 | Text fallback when microphone is unavailable | **Verified with real OpenAI on the deployed web:** source and conversation were preserved after microphone denial; text question received the correct “25 MB” answer. |
| F15 | Mobile-first layout around 390 px | Deployed browser viewport and document width both measured 390 px. This is not Safari or physical-device certification. |
| F16–F17 | Start/stop/mute and connection states | Controls exist; microphone denial is explained and source retained. Native session controls were moved outside scrolling content. Live mute/stop/reconnection effects remain unverified. |
| F18 | API key never exposed to clients | Dedicated Responses/Realtime key stored in ignored, mode-0600 `.env.local` and Secrets Manager `ursly/openai`. No secret added to the repository or printed. Deployed-revision CI secret and client/server separation checks passed. |
| F19–F20 | Server-issued ephemeral credentials | **Verified live locally and on ursly.io:** non-mock credential with future expiration, not logged. Web/native clients use it directly with OpenAI. Legacy `/api/realtime/connect` returns 410. Full audio negotiation remains unverified. |
| F21 | Lightweight storage; no mandatory persistent authentication | Session memory and temporary S3 fit the scope. Missing user accounts are not a PDF gap; public paid routes remain a commercial security limitation. |
| F22 | Recommended stack and backend | Next.js, React, TypeScript, Node server routes, and an additional Python caption service. |

## Deliverables

| ID | Requirement | Status |
| --- | --- | --- |
| D01 | Hosted, demo-ready web app | Hosting, HTTPS, and PDF verified. Complete voice demonstration remains outstanding. |
| D02–D04 | README, environment, architecture, YouTube tradeoffs | README, SERVICE-SETUP, ARCHITECTURE, Terraform and transcript guides provided. Local YouTube success is recorded separately; cloud limitation remains. |
| D05–D08 | 10–15 minute workflow, voice, architecture and library walkthrough | A 10:25 narrated review with real import excerpts was exported. **It is not the complete acceptance video:** live voice remains unvalidated. A script or synthetic narration cannot replace real app audio. |
| D09–D11 | Public GitHub, modular code and dependencies | **Verified:** https://github.com/stonyp90/Talk-to-a-Document-or-YouTube-Video contains frontend, backend, manifests, and lockfiles. |
| D12 | Appropriate tests | CI/deployment passed on `66a8ad7`; recent evidence includes 75 unit tests and 64 BDD scenarios / 361 steps. Counts do not certify blocked requirements. |
| D13 | AI-assistance disclosure | README identifies requirements, design, implementation, debugging, and testing assistance. |
| D14 | Seven-business-day deadline | Official receipt date and any extension were not supplied. Not verifiable; no submission communication sent. |

## Verification evidence

- Read the full original PDF text and compared it with the five previously rendered pages.
- `node infrastructure/scripts/smoke.mjs https://ursly.io`: health, HTML, signed S3 POST, exact extraction, and replay rejection passed.
- Original and valid 25 MiB PDFs uploaded/extracted on AWS; limit + 1 byte rejected. Local output: `/tmp/ursly-production-ingestion-results.jsonl`.
- `node scripts/demo/check.mjs http://localhost:3100` and `node scripts/demo/check.mjs https://ursly.io`: all four checks passed after key configuration; they do not certify audio.
- Browser import, preview, maximum-size question, and correct real answer observed. Microphone denial retained text fallback.
- 390 × 844 browser check showed no horizontal overflow.
- Initial YouTube tests failed with 403 and no text. Subsequent real local success is documented in [recording status](docs/demo/RECORDING-STATUS.md); no mock was reclassified as real evidence.

## Remaining work

1. Verify real spoken input/output, transcription, interruption, follow-up, mute/stop, and degraded-network behavior.
2. Reconfirm reliable local YouTube access for the demo and resolve the additional cloud-use request.
3. Address the 60,000-character limit within provider constraints and the document's needs.
4. Record the complete 10–15 minute acceptance walkthrough with functioning live conversations.
5. For additional user requests: HTTPS binaries, physical-iPhone signing, Android/iOS phone tests, and remaining mobile dependency fixes.

The observed OpenAI balance was USD 6.24 with pre-existing automatic reload enabled. No additional credit purchase was confirmed. Successful calls do not guarantee future quota or all account limits.
