# Recording status — September 9, 2026

The final 10–15 minute acceptance walkthrough is not complete: live voice recording remains blocked. Interrupted takes are not presented as successful demonstrations.

## Latest checks

- The motion update (`7df25ed`) passed CI and AWS deployment.
- September 9 production checks passed: live health, real PDF upload/extraction, grounded text answer, and ephemeral voice credential.
- Fresh local and production YouTube attempts remain blocked. Earlier successful retrieval below is historical evidence, not current acceptance.
- The September 8 10:49 iOS attempt terminated during native audio initialization. No clean spoken exchange was captured.
- GitHub release `v0.1.0-demo.2` provides a signed Android APK and an ARM64 iOS Simulator archive targeting `https://ursly.io`. It does not provide a physical-iPhone IPA.
- Expo cloud build project variables are configured. `EXPO_TOKEN` is still missing from the `mobile-builds` GitHub environment.

## Earlier verified progress

- New network: real caption retrieval returned HTTP 200 for `UF8uR6Z6KLc` (12,131 characters) and `jNQXAC9IVRw` (217 characters).
- Local caption service and backend run in live mode, without mock transcript substitution.
- iOS app rebuilt with Ursly branding and local API `http://localhost:3100`, then installed in the simulator.
- iOS PDF flow: actual requirements PDF selected, 5,729 characters extracted, preview visible.
- iOS YouTube flow: URL entered, 12,131 characters extracted server-side, Stanford speech preview visible.
- Public site: `demo:check` verified real PDF extraction, a grounded text response, and a real Realtime credential.
- Session controls moved outside scrolling content and visible while connecting. Live mute/stop still require a functioning-session test.
- Mobile TypeScript and 22 tests passed. Lint had no errors and one pre-existing warning.

## Observed blocker

Three iOS attempts terminated during audio initialization with:

`SetProperty: RPC timeout. Apparently deadlocked. Aborting now.`

CoreAudio logs show the failure with audio recording active, without recording, and after simulator restart. Microphone permission was allowed. This does not establish missing OpenAI credits or denied microphone access. The exact cause remains unresolved.

System-audio capture alone produced an audible synthetic test phrase. This does not validate recording an OpenAI voice response.

Restarting macOS audio requires administrator authentication unavailable to the agent. Restarting the Mac would allow a clean-state test, without guaranteeing a fix.

## Next take

Follow [WALKTHROUGH.md](WALKTHROUGH.md). Prepared questions may use clearly disclosed speech synthesis; answers must come from the actual live session, be audible, and match the source. Never replace a missing app response with narration.

## Review video

Ursly branding was confirmed on the public site after deployment. A 10:25, 1080p narrated review with 11 chapters was exported to the Desktop as `Ursly-revue-complete-2026-09-08.mp4`. This existing artifact has French synthetic narration; it is retained as a historical review, not an English-default deliverable or proof of successful live conversations. New documentation and default review scripts use English.

The final file decoded without errors. Chapter images and PDF/YouTube excerpts were inspected. A timestamped transcript accompanies it. File verification does not validate product voice conversations.

Android compiled after five duplicate generated splash resources were moved out of the build. Replacement installation failed because the signature differs from the installed app. Existing app data was not deleted.
