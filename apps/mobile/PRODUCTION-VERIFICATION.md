# Native production acceptance — 2026-09-08

**Release status: NOT validated for production or physical phones.**

## Evidence from the distributed binaries

- Original Android EAS build `ef3ef149-56f3-405d-8638-40d89a82d5a9`: APK signature verification passes (v2). Installed unchanged on a new Android 15 / API 35 ARM64 emulator. Cold launch succeeds; MainActivity is resumed and the crash log is empty at inspection. This checks installation/startup, not successful server interaction.
- Original iOS EAS build `0851b733-64c9-40a7-9985-637fb3009791`: installed unchanged in a separate iPhone 17 Pro / iOS 26.3 simulator, `Ursly Release QA`. Launch succeeds. Submitting a YouTube URL produces `Network request failed You can retry or use text chat.`
- The original artifacts contain the old interface, not the recent Ursly redesign/localization.
- iOS binary metadata identifies `IOSSIMULATOR` for both architectures. It cannot be installed on a physical iPhone.

## Production blockers confirmed

- Public resolver 1.1.1.1 returns the four AWS nameservers for ursly.io. The authoritative AWS server returns no A record. The Mac's resolver still returned the old GoDaddy nameservers during this check.
- `https://ursly.io/api/health` fails DNS resolution (`ENOTFOUND`). No production PDF, text, YouTube or voice success can be claimed.
- AWS access was restored and account identity verified. Lambda/API Gateway inventory in us-east-1/us-east-2 and Lambda inventory in ca-central-1/us-west-2 show no Ursly deployment. Do not modify unrelated application resources or reuse their secrets without identifying the intended configuration.
- No Ursly OpenAI secret identified. User was asked for its secure location.
- `eas build --platform ios --profile preview-device --non-interactive --no-wait` fails before build submission: no credentials suitable for internal distribution. Local codesigning identities: zero valid identities.
- No physical iPhone or Android phone connected during inspection. Wi-Fi, cellular, microphone permissions, real WebRTC audio, interruptions and Bluetooth remain untested.

## Current-source builds requested

- Android: `2d627029-5c0a-44f1-884b-82d0f058ac99`.
- iOS Simulator: `04037d5e-c96e-4df3-b07a-39cb0e33a4a0`.

These use the current uncommitted source snapshot and the existing EAS preview environment. Their completion and runtime checks must be recorded below; submission alone is not acceptance. The iOS build remains a simulator build.

## Repeatable server gate

```sh
node apps/mobile/scripts/check-production.mjs https://ursly.io
```

Requires public HTTPS, the expected backend, live mode, direct uploads, a source-based real text answer and a live voice-session endpoint. It exits nonzero on failure. It does not certify real microphone/audio, live captions or physical hardware. After this passes, run the existing `infrastructure/scripts/smoke.mjs` for actual PDF upload/extraction and perform the native phone walkthrough.

Local test evidence is retained under ignored `dist/mobile-release-qa/`. No AWS or model credentials are written into the report or the mobile app.

## Follow-up results: current iOS binary

Build `04037d5e-c96e-4df3-b07a-39cb0e33a4a0` finished at 11:40:55 UTC. Downloaded and installed without modifying its bundle. Maestro `release-ui.yaml` passes on the dedicated iOS simulator: English default, French/English switching, source reading, source preservation across language changes, conversation navigation and resume. Runtime: 83.6 seconds; no app crash detected.

A separate negative connectivity test also passes: starting a voice session against the unavailable production domain shows the connection error, changes status to interrupted and retains the source. This is evidence of error handling, not successful voice operation.

The first original-Android connectivity run reached its expected network-error assertion but failed writing a screenshot to a disallowed absolute path. The rerun was interrupted by the emulator's `Process system isn't responding` dialog during keyboard input; the emulator was rebooted. Neither run is recorded as a fully passing flow.

## Follow-up results: current Android binary

Build `2d627029-5c0a-44f1-884b-82d0f058ac99` finished at 11:44:23 UTC. The downloaded APK passes signature verification and installs unchanged on the Android 15 emulator. Maestro `release-ui.yaml` passes (105 seconds): English default, both language transitions, sample source, reading screen, source retention, conversation navigation and resume.

`zipalign -c -P 16 4` passes. All 34 ARM64/x86_64 native libraries have ELF LOAD segment alignment of at least 16 KiB. This is a packaging check, not a runtime test on a 16 KiB physical phone. Hashes and file sizes are recorded in `dist/mobile-release-qa/artifacts.json`.

The production gate script passes syntax and lint checks and correctly rejects a local HTTP URL. Running it against ursly.io fails with ENOTFOUND.

The current Android negative connectivity test also passes (14 seconds): the app displays the network error, reports the interrupted session and retains the source. The final Android crash buffer is empty. Both current binaries have passing UI and network-error-handling flows; **neither has passed live production feature tests or physical-phone acceptance**.
