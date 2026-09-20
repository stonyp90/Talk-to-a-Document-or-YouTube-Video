# Native workspace checks

`native.feature` describes the behavior. The Maestro flows exercise the actual
native UI. They preserve app data: neither flow clears storage or resets a
device.

## Local simulated-input flow

Use a dedicated simulator and a development client matching this app's native
modules. Choose a separate QA bundle identifier when reusing a client, so the
normal app and its data remain untouched.

Start the deterministic, loopback-only fixture API from `apps/mobile`:

```sh
node tests/fixtures/sense-api.mjs
```

Start Metro in a second terminal, also from `apps/mobile`:

```sh
NODE_OPTIONS=--dns-result-order=ipv4first \
EXPO_PUBLIC_SENSE_TEST_MODE=1 \
EXPO_PUBLIC_API_URL=http://127.0.0.1:3099 \
npx expo start --dev-client --localhost --port 8089
```

The DNS option makes Metro's listener match its advertised IPv4 loopback URL.
Open that Metro project in the development client. Dismiss Expo's initial
introduction if this is the first launch of the dedicated client.

Run the native flows, using the simulator and bundle identifiers for your QA
installation:

```sh
maestro --udid "$SENSE_QA_UDID" test \
  -e APP_ID="$SENSE_QA_APP_ID" tests/release-ui.yaml
maestro --udid "$SENSE_QA_UDID" test \
  -e APP_ID="$SENSE_QA_APP_ID" tests/smoke.yaml
```

The default app identifier is `com.talktosource.demo`. The UI-only flow does not
start sensors or require the test flag. The smoke flow requires both the local
API and the test flag. It signs into that fixture only, with
`sense-qa@example.test` and `123456`; no email is sent. Responses, camera,
recognition, and movement are deterministic. The fixture API accepts no external
configuration or provider credentials and never makes outbound requests.

`SENSE_QA_API_PORT` can change the fixture port; update `EXPO_PUBLIC_API_URL` to
match. The development-only Settings controls emit voice and motion events
through the same action handlers as the actual adapters. They do nothing before
Start experience or after Stop experience. The test mode is gated by both
`__DEV__` and the explicit environment flag.

Injected speech stays active until Stop, so time spent in simulator automation
does not expire the mock listener. Real merged voice input retains its
120-second silence timeout; the legacy panel retains its eight-second timeout.

The flow checks one workspace, source and settings transitions, preferences and
language continuity, typed answers, spoken navigation, motion questions, and
shared start/stop. It does not verify physical sensors, real speech recognition,
production authentication, or paid model responses.
