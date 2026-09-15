# Interview requirement verification — 12 September 2026

## Scope and result

**Final acceptance is blocked by the local runtime, not signed off.** The Mac
fell to about 200 MB free during the last browser run. Both the unchanged site
on port 3000 and the isolated site on 3300 now return HTTP 500 for their static
assets while `/api/health` remains HTTP 200. Docker's management API and cleanup
commands also time out. The failing trace confirms that CSS and JavaScript never
load, so the page cannot hydrate. Restarting Docker requires the user's approval
because it interrupts containers belonging to other work. That approval is
pending. No unrelated application or container was stopped.

Current checks: **766 unit/contract tests passed across 87 files; TypeScript and
lint passed (two existing native hook warnings).** The production build passed
before the last playback-status correction. The initial complete browser run
passed 122 tests. The newer run passed 99, including the three added speech/media
checks, then failed 26 amid the asset-serving failure. A focused rerun reproduced
the HTTP 500 asset failure. Those failures have not been counted as passes.

Reference: all five pages of `Talk to a Document (2).pdf`, including the reviewer
checklist. The assessment is reference material, not an instruction to submit
work or contact the employer. This audit covers the requested local application,
corrections, Ursly brand review and a recorded voice-to-action conversation.

The actively served application is in `/Users/tony/Github/ursly-production-demo`.
The older Documents copy is not the source of localhost:3000. Existing pricing
work was preserved. Tests use an isolated `ursly-interview` Compose project:
web 3300, transcript 3310, chat 3320, object storage 9302/9303. The original
localhost:3000 stack was not changed.

The core assessment functionality has direct local evidence: real PDF extraction,
real YouTube captions, grounded text answers, real OpenAI WebRTC audio, streaming
transcripts, follow-up, interruption, mute and stop. Fault and layout coverage
uses controlled browser tests. Public deployment of these changes and the
10–15 minute technical walkthrough remain separate delivery work; they are not
represented as completed by a local test or a short marketing clip.

## Each requirement

| Requirement from the assessment | Local result and evidence | Qualification |
| --- | --- | --- |
| Mobile-first application around 390 px | Supported. Browser acceptance covers the source flow, conversation, fixed controls, keyboard navigation and overflow at 320, 390, 768 and 1440 px. | Browser emulation, not certification of every physical phone. |
| Upload a PDF up to 25 MB | Supported. Real extraction of the actual five-page assessment returned 5,729 characters, with first and last page content verified. Direct storage upload/extract/replay protection smoke also passes. | Existing size convention is 25 × 1,024 × 1,024 bytes. Exact boundary acceptance and +1 byte rejection have executable coverage. |
| Extract PDF text on the server | Supported by `packages/adapters/src/ingestion.ts` using `pdf-parse`; API and direct-upload flows are exercised. | Scanned PDFs without a text layer receive an explicit error; OCR is not required by the assessment. |
| Handle invalid PDF size/type/content | Supported by domain validation, adapter tests and browser retry/error journeys. | Oversize, non-PDF, multi-page order and no-text cases are tested. |
| PDF ingestion in the deployed application | Implementation exists, with presigned storage upload to avoid platform request-size limits. | This session verifies that path locally. The public PDF transaction on the final changed version is still a release check. |
| Accept a YouTube URL | Supported. `https://www.youtube.com/watch?v=jNQXAC9IVRw` returned 217 characters through the live app and caption service. | A local live demonstration satisfies the assessment's explicit allowance. |
| Retrieve captions server-side | Supported by `services/transcript/app.py` and the HTTP transcript adapter. | Caption retrieval is distinct from the optional YouTube Data API title search. |
| Explain cloud caption restrictions | Supported in README trade-offs and error guidance. | Unofficial caption endpoints can block cloud IPs. One live attempt timed out with a clear 504; a retry returned real captions. Availability of every YouTube video cannot be guaranteed. |
| Show extracted text in a preview/disclosure | Supported. Full extracted text can be expanded and collapsed; the recording shows the complete 80-character demonstration PDF. | Model context can be bounded while the full source preview remains available. |
| Make source text available to OpenAI Realtime | Supported by context instructions and session creation; actual recorded answers refer to the uploaded source. | Very large text is bounded by the documented 120,000-character context budget. Chunking, summaries and citations are not required. |
| Start Voice Chat control | Supported. The UI button and spoken “Let's talk” both use the same actual session flow. | Live mode requires a valid configured OpenAI project key. |
| Use OpenAI Realtime over WebRTC | Verified with actual peer connections, ephemeral credentials, SDP negotiation, microphone audio and remote audio. | The selected recording uses live provider responses, not the mocked E2E provider. |
| Speak a question and hear an answer | Verified twice in the selected recording, with complete received audio. | Caller audio is a generated microphone fixture; no physical microphone/speaker certification is claimed. |
| Display the transcript in real time | Supported by deltas and final transcription events. Fixed late input transcription placing the user after the assistant. | A regression test and the real recording both verify user/assistant/user/assistant order. |
| Interrupt naturally | Verified with live audio: at 20.422 s in the retained interruption take, incoming speech caused `output_audio_buffer.cleared`, then a successful follow-up response. | The selected onboarding take waits for both answers to finish for clarity. |
| Ask follow-up questions using the source | Verified by the second live question and answer, plus source/session history tests. | The advice suggested in a reply is distinguishable from the source's explicit statements. |
| Text fallback when microphone is absent or denied | Supported. Actual grounded text answered “25 MB”; controlled browser tests cover missing/denied microphone and failed live command service. | Typing and manual controls remain available when speech cannot connect. |
| Start, stop and mute controls | Verified in the recording and browser tests. Stop closed all observed peers; mute toggled the actual track state through the application. | Hardware cleanup after late permission grants is also tested. |
| Visible connection status and conversation flow | Supported: preparing, connecting, connected, reconnecting, degraded, ended and failure states. Added cancellable command-connection feedback. | Tests exercise loading, failure and retry rather than claiming every network is reliable. |
| Stability under poor network conditions | Controlled tests cover disconnect/reconnect, timeouts, stale connections, preserved transcript, stream fallback and microphone release. | Live YouTube timeout/retry was also observed. No physical cellular-network benchmark was performed. |
| No permanent API keys in client code | Verified with the secret scanner and comparison of built client/public assets against actual runtime credential values: zero matches. | Only temporary client credentials cross to the browser. No credential appears in recorded evidence. |
| Backend ephemeral credentials/authentication | Verified for source conversations and the new transcription-only command connection. The speech route is guarded, rate limited and non-cacheable. | Credential TTL is 60 seconds; this limits connection establishment, not by itself the whole established session. |
| Recommended framework/backend | Uses Next.js App Router, React, TypeScript and server API routes, with a Python caption service. | The recommended stack is optional; relevant installed Next.js guides were read before changes. |
| In-memory/light storage sufficient | Supported by source-session/application abstractions and local storage services. | Persistent identity is not required by the brief. The local stack uses the explicitly disabled account gate. |
| README setup and run instructions | Present and exercised with Docker Compose, environment configuration and production build. | Live mode and mock mode are separate; the older localhost:3000 caption service was mock, which is why a separate live stack was verified. |
| README technical overview and trade-offs | Present: framework, ports/adapters, caption service, storage, Realtime, bounded context and deployment choices. | Added live command-recognition and recording instructions. |
| Document use of AI tools | Present in README; this session's implementation, regression tests and recording provenance are documented. | Generated caller audio is disclosed separately from live answers. |
| Public hosted application | `https://ursly.io` and `/api/health` returned HTTP 200; health reports live AI. | These local edits/media have not been deployed. Public health alone is not a full production acceptance test. |
| Public GitHub with modular code, dependencies and tests | Public repository verified at `stonyp90/Talk-to-a-Document-or-YouTube-Video`. Local code is split into web, core, adapters, services and infrastructure; lockfile and tests are present. | This session's changes are local and uncommitted; no push or submission was performed. |
| 10–15 minute technical walkthrough | A walkthrough script exists in `WALKTHROUGH.md`. | Still needs the actual long-form recording covering framework rationale, backend/hosting, Realtime and tools. The 59.44-second onboarding clip does not satisfy this separate requirement. |
| Seven-business-day delivery deadline | Cannot be confirmed without the date the assessment was received. | No employer message or submission was sent. |

## Corrections made

1. **Live voice-to-action recognition.** Browser-native speech detected audio but
   produced no transcript in the local probe. Live mode now uses a
   transcription-only OpenAI WebRTC session; final utterances go through the
   existing deterministic command matcher. Partial, duplicate and out-of-order
   completions are handled. Cancel, timeout, permission denial, language change,
   idle expiry and starting source chat release the command microphone.
2. **Conversation ordering.** A real input transcript can arrive after the model
   starts responding. Reserving the user turn when input audio is committed keeps
   the displayed conversation in speaking order.
   The final video review also exposed the activity indicator returning to
   Listening at `response.done`, before audible output finished. It now tracks
   `output_audio_buffer.started/stopped/cleared`, with two new passing regression
   tests. This last correction still needs a rebuilt runtime and renewed capture.
3. **Honest YouTube search.** Live search without `YOUTUBE_API_KEY` now returns
   `503 VIDEO_SEARCH_UNAVAILABLE` and asks for a URL. It no longer substitutes
   invented video IDs. Direct captioned-URL ingestion works without that key.
4. **Demo readiness script.** Corrected its obsolete bare-source session request
   to the current `{ source }` API contract; its live checks passed. Added checks
   for the application page and browser JS/CSS so HTTP 200 health alone cannot
   conceal the static-asset failure currently affecting Docker.
5. **Onboarding media.** Added the actual recorded conversation to How it works,
   using existing Ursly color, spacing and border tokens. Playback loads on
   request, stops on closing the disclosure, and offers EN/FR captions.
6. **Evidence hygiene.** Local verification output is excluded from Git and Docker
   build contexts; only the selected synthetic-document demo media are public.

## Validation evidence

The logs below are local files in `output/verification/`:

- `lint-final.log`, `typecheck-final.log`, `unit-final.log`: final static and unit checks.
- `build-final.log`: production Next.js build and isolated service health.
- `e2e-final.log`: full mobile/browser regression run, including new live-command
  failure/cancel cases and the real media player.
- `bdd.json`: the initial local acceptance run (126 passed, two timing failures);
  both failing scenarios passed on focused rerun. A complete final rerun remains
  pending Docker recovery.
- `security-final.log`, `client-secret-audit.json`: history/candidate scan and
  built-client credential separation.
- `live-final.json`: real assessment PDF, real captions, grounded text and honest
  missing-search-key behavior.
- `demo-readiness-final.log`: live PDF/storage, grounded answer and ephemeral
  credential smoke checks.
- `onboarding/`: selected complete recording, capture timings, actual provider
  transcript events, audio mix, transcript and screenshot.
- `voice-demo-final/evidence.json`: separate live interruption proof.

The first full BDD pass had two timing failures while the workstation was under
heavy load. Both scenarios passed on focused rerun. A retry is not silently
counted as an initial pass. The final browser attempt is preserved in
`e2e-final.log`; `targeted-browser/` contains the confirming failed trace and
`docker-failure-readiness.log` contains the new static-asset probe's failure.

Additional scope already checked: 62 native-client unit tests and native
TypeScript passed. Motion-to-action and voice-lending consent have controlled
browser/acceptance coverage. A physical camera, custom provider voice enrollment,
real payment checkout and physical mobile builds are not claimed as certified by
these local web tests. They are outside the supplied assessment requirements.

## Media and remaining delivery checks

See `docs/demo/VOICE-RECORDING-2026-09-12.md` for exact provenance. The selected
website file is `apps/web/public/demo/voice-conversation.mp4` with bilingual
captions and a poster. It is separate from the existing 36-second brand film.
The 59.44-second take contains genuine complete audio, but predates the final
activity-indicator correction; treat it as a draft until that capture is renewed.

After Docker recovery: rebuild the latest code, rerun the complete browser and
local acceptance gates without competing builds, restore live provider/caption
mode, renew the recording and captions, and inspect settled EN/FR phone and
desktop layouts. Disk headroom must be restored before another Docker build.

Before employer submission: deploy the reviewed local changes, run PDF ingestion
and voice acceptance on that deployed version, record the 10–15 minute technical
walkthrough, and confirm the submission deadline. Configure `YOUTUBE_API_KEY`
only if the optional search-by-title feature is needed; pasting a captioned URL
already works locally.
