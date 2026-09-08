# Ursly mobile build verification — 2026-09-08
Follow-up: see [PRODUCTION-VERIFICATION.md](PRODUCTION-VERIFICATION.md) for the later Android emulator installation, production connectivity failure, physical-iPhone signing check, and replacement builds. Earlier statements below describe the original verification time.

Expo project: [@stonyp90/talk-to-a-source](https://expo.dev/accounts/stonyp90/projects/talk-to-a-source).

Project ID: `345afb85-8b7b-49a1-bf93-48e0f2ce0b35`. Both builds use the current local source snapshot, including uncommitted changes, and the `preview` profile. The recorded Git HEAD alone does not identify that snapshot.

## Native builds

- [Android APK](https://expo.dev/accounts/stonyp90/projects/talk-to-a-source/builds/ef3ef149-56f3-405d-8638-40d89a82d5a9): finished. Downloaded; ZIP integrity check passed. Manifest, DEX, JavaScript bundle, and 68 native libraries are present. The bundled backend origin is `https://ursly.io`. Device execution remains unverified.
- [iOS Simulator](https://expo.dev/accounts/stonyp90/projects/talk-to-a-source/builds/0851b733-64c9-40a7-9985-637fb3009791): finished. Downloaded, extracted, installed, and launched successfully on the iPhone 17 Pro simulator, iOS 26.3. Bundle ID `com.talktosource.demo`, version `0.1.0`, build `1`.

The iOS archive is for a Mac simulator, not a physical iPhone or App Store submission. A `preview-device` build was attempted; EAS rejected it because no suitable internal-distribution signing credentials exist. Physical-device signing remains outstanding, and no iPhone build was submitted.

Downloaded artifacts are in the repository's ignored `dist/mobile-builds/` directory:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `ursly-android.apk` | 130937834 | `b024ccc9d3dd9268b6d43c743f3f312868a5547619e33260b87894198e587ec2` |
| `ursly-ios-simulator.tar.gz` | 24512744 | `427b32f4877c728a2dc5d290e11bc4c52b5a8bcad9d18c1c29cb38efdd84ac36` |

Both builds target `https://ursly.io`. Its AWS nameserver delegation is published, but there is no public application endpoint at the domain yet. These binaries therefore do not establish working remote ingestion or chat.

## Checks executed

- Root lint and TypeScript: passed.
- Root unit tests: 78 passed.
- Mobile unit tests: 18 passed; mobile TypeScript passed.
- Metro exports: both Android and iOS passed.
- Next.js production build and Docker runtime image build: passed.
- Playwright web end-to-end suite: 23 passed.
- Final BDD invocation (configured feature paths plus the corrected local-service scenario): 90 scenarios, 59 passed, 31 pending, none failed. Cucumber exits nonzero for pending scenarios; this is not a fully green acceptance suite.
- Native API adapter smoke test against local mock backend: passed.
- Existing local iOS build: PDF picker/import, extracted text, question and mock response, mock session start/mute/unmute/stop verified through Simulator UI. This is separate evidence from the downloaded EAS build's launch check.
- Real YouTube transcript retrieval from the native client encountered a provider network block. Deterministic transcript tests do not certify live YouTube access.

Two BDD expectations were updated to match the current interface text. Integration checks require the actual Compose web service and deterministic transcript mode; the initial host-server run did not satisfy those prerequisites. The test Compose web service was started on port 3100 to preserve the existing server on port 3000.

## Outstanding acceptance

- Public HTTPS backend deployment and its OpenAI secret configuration.
- Real microphone/WebRTC audio and interruption on a device.
- Android runtime testing: this Mac has no Android SDK/emulator installed.
- Physical iPhone signing and installation, if requested.
- Existing BDD scenarios marked pending are not successful acceptance evidence.

## Local Simulator walkthrough

The user-requested walkthrough runs against the Compose backend at `http://localhost:3100`, with mock provider and mock transcript services. A fresh, cache-cleared iOS Hermes bundle was exported for that origin and placed in a separate copy of the compatible EAS simulator app, then signed ad hoc and installed. The original EAS archive is unchanged. The local app is retained at `dist/mobile-demo/TalktoaSource.app`.

Verified interactively on iPhone 17 Pro / iOS 26.3: PDF selection and real text extraction; preview expand/collapse; typed question and mock answer; mock session start, mute, unmute, stop and restart; transition to text chat with history preserved; invalid YouTube URL with the existing PDF retained; valid YouTube URL with deterministic transcript and history reset; session stop when backgrounded and return to the app. The app and backend are left running for the user. This walkthrough does not validate real model answers, live captions, microphone capture, or spoken output.
