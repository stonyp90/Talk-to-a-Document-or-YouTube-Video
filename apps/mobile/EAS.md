# Expo binary delivery

GitHub Actions runs `Expo native binaries` after successful push CI on `main`.
It checks out the exact tested SHA, compiles both targets on Expo EAS, waits for
completion, and verifies project, commit, and nonempty downloadable artifacts.
Failed, canceled, queued, missing, or inaccessible binaries fail delivery.
Pull requests run the integration's unit/contract tests in the existing mobile
CI job; they do not receive Expo credentials or create billable cloud builds.

The default `preview` profile produces a standalone Android APK and an unsigned
iOS Simulator app, with JavaScript bundled and native WebRTC included. These
are not Expo Go bundles and do not require Metro. The iOS simulator artifact
cannot be installed on an iPhone. The optional `preview-device` profile produces
an ad hoc iPhone build and requires Apple Developer membership, registered
devices, and provisioning. Neither profile submits to an app store.

## One-time account setup (required before live verification)

1. Select/create an EAS project named `talk-to-a-source` under the intended Expo
   owner. Record its UUID. Do not reuse a different application's project.
2. Create the GitHub environment `mobile-builds`, with any desired reviewer and
   deployment-branch restrictions. Set these environment variables:
   - `EXPO_OWNER`: owning Expo account or organization.
   - `EXPO_PROJECT_ID`: the selected project's UUID.
   - `EXPO_PUBLIC_API_URL`: reachable HTTPS AWS API origin (no credentials).
3. Set the same three **plain-text** variables in that project's EAS `preview`
   environment. GitHub's process environment is not automatically copied to
   remote builders. These values must agree on both services. The app config
   rejects missing project configuration or local/HTTP API URLs during EAS builds.
4. Create a least-privileged Expo automation/robot access token and save it as
   the GitHub environment secret `EXPO_TOKEN`. Never commit it, add it to EAS
   public environment variables, or paste it into chat. Rotate it as needed.
   Expo uses this token; the existing AWS deployment keeps its separate OIDC
   role and does not gain Expo permissions.
5. In a trusted terminal, export the three non-secret variables above, sign in
   to the intended Expo account, and run from `apps/mobile`:

   ```sh
   eas build --platform all --profile preview
   ```

   Use EAS CLI 18.3.0, matching `eas.json` and the workflow. Complete the initial
   Android keystore prompts and keep signing credentials in EAS. iOS Simulator
   does not need Apple signing credentials. Initial interactive setup is required
   before non-interactive CI can build. Do not regenerate an existing keystore.
6. Merge the integration normally. Inspect the successful CI run, then its
   `Expo native binaries` workflow and both finished builds in the Expo project.
   Download/install the Android APK and iOS simulator archive from those builds;
   test PDF ingestion, HTTPS backend access, and native WebRTC. Compilation and
   artifact availability alone do not establish runtime feature acceptance.

## Storage and operational behavior

EAS stores the compiled binaries. GitHub retains only the JSON build metadata
for 30 days, including artifact URLs; treat that metadata as download-capable
information. Configure internal-distribution access controls in Expo. EAS
retention, quotas, and build charges follow the chosen account plan; this is
not an indefinite archive guarantee. The workflow does not purchase a plan.

Builds are serialized and in-progress runs are not canceled by newer pushes.
The job waits up to 180 minutes. A GitHub timeout/manual cancellation does not
guarantee remote EAS builds stop: inspect and cancel unwanted builds in Expo
before retrying. Rerunning a job creates new builds. This stage is independent
of AWS deployment completion; configure an already reachable backend origin.

`eas.json` lives in the mobile app directory; EAS commands run there while the
Git archive includes the repository's shared source types. Native `ios/` and
`android/` directories remain ignored and EAS regenerates them using the Expo
config plugins. Local npm/simulator/Docker Compose development is unchanged.

## Local checks

```sh
npm test --prefix apps/mobile
npm run typecheck --prefix apps/mobile
```

The tests cover configuration rejection, both-platform completion, stale commit
and wrong-project rejection, download failures, and privileged-workflow gating.
They use synthetic EAS responses, not real binary-build evidence.

References: [Expo CI setup](https://docs.expo.dev/build/building-on-ci/),
[programmatic access](https://docs.expo.dev/accounts/programmatic-access/),
[build environment variables](https://docs.expo.dev/eas/environment-variables/usage/),
[monorepo builds](https://docs.expo.dev/build-reference/build-with-monorepos/).
