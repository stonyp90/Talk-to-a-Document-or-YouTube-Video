# Local UI/UX verification — 2026-09-08

The updated application is running at http://localhost:3000 using the host Next.js development server. The previous Compose `web` service was stopped to free port 3000. MinIO remains running on port 9002. The Compose transcript service on port 3010 was recreated with `TRANSCRIPT_MODE=live`; this environment override applies to the running container, not the Compose defaults. AI remains in `PROVIDER_MODE=mock`.

## Changes

- Responsive source/conversation workspace, warm neutral palette, outlined controls and transparent button backgrounds, including the native file picker.
- Lightweight entrance, interaction, loading and voice-indicator animations; respects reduced-motion preferences.
- Keyboard source tabs with panel associations, visible focus and mobile touch targets.
- Suggested questions populate and focus the composer.
- Pending-answer feedback, cleared on source replacement; failed text questions are restored without overwriting a newer draft.
- Explicit disclosure of simulated AI responses for text as well as voice.

## Verified

- `npm test`: 78 tests passed.
- `npm run test:e2e -- --workers=2`: 23 tests passed in the final run, with live YouTube captions and simulated AI.
- `npm run lint`, `npm run typecheck`, `npm run build`: passed.
- Real YouTube retrieval through the local application: `dQw4w9WgXcQ` (2,089 characters) and `jNQXAC9IVRw` (217 characters). Both were also imported and questioned through the in-app browser; replacement removed prior messages.
- PDF upload through MinIO and extraction, corrupt PDF and invalid URL errors, text replies, voice simulation, mute/unmute/stop/restart, transport fixtures, timeouts and stale-response cancellation.
- In-app browser visual review at mobile 390×844 and desktop 1280×900. Mobile document width was 390 px. Computed backgrounds of application buttons were transparent.

## Limits

Actual OpenAI text generation, microphone transmission and spoken responses were not validated. The voice transport tests use controlled fixtures. Other video platforms and uploaded video files are not supported; the two tested videos are YouTube videos. No production deployment or commit was performed.
