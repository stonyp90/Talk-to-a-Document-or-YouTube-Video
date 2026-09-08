# Verification record

Checks performed locally on 2026-09-07:

| Check | Result |
| --- | --- |
| Root `npm run lint` after Button/config corrections | PASS, exit 0 |
| Mobile `npm run typecheck` | PASS |
| Mobile `npm test` | PASS, 12 tests, including presigned PDF upload routing |
| Native API adapter against running Compose API | PASS: YouTube ingestion, text answer, mock session, invalid URL rejection |
| `expo install --check` | PASS, SDK-compatible dependencies |
| Expo iOS and Android JS/Hermes bundle export | PASS |
| iOS and Android native project generation | PASS |
| iOS CocoaPods dependency resolution | PASS, includes native WebRTC |
| iOS simulator binary compilation | PASS: isolated Release arm64 build with bundled JS |
| Simulator script shell syntax | PASS |
| Native simulator UI | PASS: launch, YouTube fixture, preview, text answer, mock voice start/mute/stop |
| Native live audio | NOT RUN |

The original in-place build failed because upstream generated Expo shell
scripts split paths at spaces. This is resolved using
`bash scripts/mobile/build-ios-isolated.sh`, which copies only the mobile app
and shared type into a fresh space-free temporary directory and regenerates
native dependencies. A `/private/tmp` attempt then exposed a Metro `/tmp`
canonical-path mismatch; using `/Users/Shared` avoids both issues.

Successful build directory: `/Users/Shared/talk-mobile.oT320R`.
Log: `/Users/Shared/talk-mobile.oT320R/build.log` (`BUILD SUCCEEDED`).
Binary: `DerivedData/Build/Products/Release-iphonesimulator/TalktoaSource.app`
under that directory. This is a Release arm64 Simulator app with bundled JS,
installed and launched on the existing iPhone 17 Pro. No Metro server is needed.
Native UI verified YouTube ingestion against localhost:3000, collapsible preview,
text answer, and mock voice controls. Root lint and mobile typecheck pass after
the API integration changes. No global tools were installed or repository files
moved. Future native builds are bounded to `xcodebuild -jobs 2`; process inspection
after completion found no remaining xcodebuild or isolated-build processes.

Read-only host assessment found Xcode 26.2, CocoaPods, and an available but
initially shutdown iPhone 17 Pro simulator (iOS 26.3). Android `adb`, emulator, and the
default Android SDK directory were absent. Maestro was absent. Simulator
device was subsequently booted for the authorized install/launch checks. It was
not reset. A synthetic PDF fixture was added to its local file-provider storage
for picker testing; no existing documents were overwritten.

The twelve unit tests cover simulator API origins, PDF validation, accumulated
transcript events, backend error messages, text request contract, mock voice
lifecycle, cancellation during session setup, and session setup failure.
Additional tests cover direct upload metadata, preserved signed URL/fields,
file-last multipart ordering, upload failure without extraction, and non-S3
fallback. Android now uses adb reverse for both 3000 and 9002, preserving signed
localhost URLs instead of rewriting hosts. Native picker upload through S3 has
not yet been verified end-to-end. Gherkin in `tests/native.feature` remains a
specification. The Maestro flow is provided but unexecuted. Voice audio, interruption,
permission-denial UI, and reconnection require runtime acceptance testing.

Dependency audit still reports 20 findings (11 moderate, 9 high) after a
non-breaking `npm audit fix`, mainly in Expo/Metro tooling dependencies.
It is not a clean security audit. The suggested forced fix crosses Expo SDK
major versions and was not applied to this SDK-compatible native setup.

Only `apps/mobile/` and `scripts/mobile/` are owned by this implementation.
Root CI wiring, root build exclusions for generated native files, cloud
deployment, and GitHub pushes belong to the coordinating implementation.
