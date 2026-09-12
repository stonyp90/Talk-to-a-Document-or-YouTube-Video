# Native companion

Expo SDK 57 / React Native 0.86 companion for the primary web application.
This directory has its own manifest and lockfile; run its npm commands here.
No root package changes are required. `src/client.ts` imports the shared
`IngestedSource` type directly from `packages/core/src/domain/ingestion.ts` using a type-only
import, so no server code or provider credentials enter the native bundle.

## Local loop

Start the repository's Docker Compose services first. Then:

Use Node.js 24 for the repository's current toolchain. iOS compilation requires
Xcode 26.4 or newer, as listed in the [Expo SDK requirements](https://docs.expo.dev/versions/latest/).
Check the selected installation with `xcodebuild -version` before downloading
Pods or starting an isolated build. Xcode 26.2 fails while compiling
`ExpoModulesJSI` with Swift reference-ownership annotation errors.

```sh
cd apps/mobile
npm ci
npm test
npm run typecheck
npm start
```

The default API is `http://localhost:3000` on both iOS Simulator and
Android Emulator (using `adb reverse`, below). Override with
`EXPO_PUBLIC_API_URL` for a physical device or HTTPS deployment. Public Expo
variables must never contain secrets. Local cleartext is enabled for this demo;
use HTTPS and disable Android cleartext before distributing a production app.
Android development requires the Android SDK and an available AVD; use
`adb reverse` to forward the emulator to the local web API.

Install a development build once, then Metro reloads TypeScript changes:

```sh
npm run ios
# Or, with an existing configured SDK and AVD:
npm run android
```

For repositories whose path contains spaces, use the isolated iOS builder from
the repository root:

```sh
bash scripts/mobile/build-ios-isolated.sh
```

The script creates a fresh `mktemp` directory under `/Users/Shared`, copies only
the mobile app and shared core (including the discussion client), installs locked local dependencies,
regenerates iOS/Pods, and builds an unsigned arm64 Simulator Release app with
JavaScript bundled. The original repository is not moved or modified. A real
copy is intentional: symlinks and `/tmp` can cause Xcode and Metro to disagree
on the canonical entry-file path. The script prints the retained build directory,
build log, and `.app` path. Compilation is bounded with `xcodebuild -jobs 2`
to limit contention with other local work. Nothing is installed globally.

Install and launch the resulting app using the exact paths printed by the build:

```sh
bash scripts/mobile/simulator.sh check
bash scripts/mobile/simulator.sh ios-boot <shutdown-simulator-UDID>
bash scripts/mobile/simulator.sh ios-install <UDID> <printed-app-path>
bash scripts/mobile/simulator.sh ios-launch <UDID>
```

Skip `ios-boot` for an already booted simulator. The Release app does not need
Metro. Set `EXPO_PUBLIC_API_URL` before invoking the builder if using an API
other than the default iOS `http://localhost:3000`. Temporary builds are retained
for review; they can be removed later using their exact printed directory.

WebRTC requires a development build with `react-native-webrtc`; Expo Go does
not contain that native module. The config plugin registers native microphone
permissions. Live voice obtains its provider mode from the server session route
and negotiates SDP directly with OpenAI using the returned ephemeral credential;
the server controls initial source instructions and retains the long-lived provider
key. The old `/api/realtime/connect` relay now returns HTTP 410; rebuild older
native binaries before deploying this backend change. Received audio plays via
native WebRTC's audio session. Server VAD handles spoken interruption. Microphone
tracks are disabled on mute and released on stop, errors, and app backgrounding.
Transient disconnects have a 15-second recovery window, followed by an explicit
retry. Starting a new voice session preserves the displayed transcript.

Voice actions also use the native `expo-speech-recognition` module, so rebuild
the development client after adding or changing the speech-recognition plugin.
The home-screen voice-action card can listen for saved phrases such as
“YouTube”, “Upload”, “Let’s talk”, and “Summarize this”.
Back, Next, and Cancel are enabled by default, can be renamed or remapped in
the trigger editor, and provide spoken confirmations through `expo-speech`.

Mock sessions simulate connection controls and use the backend text answer
route. They do not produce or verify microphone/remote audio. The app labels
this mode explicitly. Text fallback is always available. The current backend
text contract accepts one question and source per request; it does not preserve
multi-turn text context.

## Verification and simulator scripts

From the repository root, the following check is read-only:

```sh
bash scripts/mobile/simulator.sh check
```

Control commands require an explicit device identifier and only act when invoked:

```sh
bash scripts/mobile/simulator.sh ios-boot <UDID>
bash scripts/mobile/simulator.sh ios-install <UDID> <built-app-path>
bash scripts/mobile/simulator.sh ios-launch <UDID>
bash scripts/mobile/simulator.sh ios-screenshot <UDID> <output.png>
bash scripts/mobile/simulator.sh android-boot <existing-avd>
bash scripts/mobile/simulator.sh android-launch <adb-serial>
bash scripts/mobile/simulator.sh android-reverse <adb-serial>
```

Run `android-reverse` before using the local Android app: it forwards both
`tcp:3000` (Next.js API) and `tcp:9002` (MinIO). The client checks
`/api/health.directUpload` for PDF ingestion. When enabled it requests metadata
at `/api/uploads`, uploads the native file URI directly to the presigned form
endpoint, then posts the returned key and filename to `/api/uploads/extract`.
This avoids sending a 25 MB file through Lambda/API Gateway request bodies.
Without object storage configured, it uses the multipart `/api/ingest` route.

The client preserves the presigned URL and fields exactly. In particular,
it does not substitute `10.0.2.2` for `localhost` in MinIO URLs. Forwarding port
9002 makes the original signed URL reachable from Android. For a physical device
or deployment, configure the server's `OBJECT_STORE_PUBLIC_ENDPOINT` to an
address reachable by that client before generating the signature; set
`EXPO_PUBLIC_API_URL` independently for the API. Do not rewrite signed hosts.

No script installs SDKs, globally installs packages, or resets a simulator.
To verify the actual Compose API through the native adapter:

```sh
cd apps/mobile
./node_modules/.bin/tsx ../../scripts/mobile/api-smoke.ts
npx --no-install expo install --check
npx --no-install expo export --platform ios --platform android
```

For a native UI smoke test, install the development build and open its Metro
project first. With an existing Maestro installation and mock backend:

```sh
maestro test tests/smoke.yaml
```

`tests/native.feature` describes the native acceptance behaviors. It is a
specification, not an executable Cucumber suite. Unit tests execute through
`npm test`; `tests/smoke.yaml` supplies the runnable native UI flow. PDF picker
and live microphone acceptance still require simulator/device execution.
Place a PDF in the simulator's Files/Downloads, choose it through the native
picker, verify full preview, and then deny/grant microphone access in live mode.
On a physical device, verify heard audio, spoken interruption, mute, stop, and
network loss; bundle export alone cannot validate these behaviors.

Root CI runs native unit tests, type checking, and bundle export on pull requests
and main. After successful main push CI, the Expo workflow compiles and stores
Android and iOS Simulator binaries on EAS. See [EAS setup and verification](EAS.md)
for required account configuration, signing, artifact storage, and runtime checks.

## Sources

- [Expo document picker](https://docs.expo.dev/versions/v54.0.0/sdk/document-picker/)
- [React Native WebRTC installation](https://github.com/react-native-webrtc/react-native-webrtc)

Run the commands above for the repeatable checks. Simulator and physical-device
audio behavior still requires the manual acceptance flow described here.
