#!/usr/bin/env bash
# Builds the Android companion in an isolated copy, the way
# build-ios-isolated.sh does for the iOS Simulator, so a checkout whose path
# contains spaces (or that other sessions are editing) never hosts a Gradle
# build. Produces a release APK with the debug signing key: installable on an
# emulator or a sideloading device, never a store build.
#
#   bash scripts/mobile/build-android-isolated.sh
#
# Environment (all optional): ANDROID_HOME (falls back to the Homebrew
# command-line tools), JAVA_HOME (falls back to the newest JDK 17 found),
# EXPO_PUBLIC_API_URL (baked into the bundle; defaults to the emulator's
# adb-reversed http://localhost:3000).
set -euo pipefail
repo_dir="$(cd "$(dirname "$0")/../.." && pwd)"
build_dir="$(mktemp -d /Users/Shared/talk-mobile-android.XXXXXX)"
printf 'Isolated build directory: %s\n' "$build_dir"
mkdir -p "$build_dir/apps/mobile" "$build_dir/packages/core"
rsync -a --exclude=node_modules --exclude=ios --exclude=android --exclude=dist \
  --exclude=.expo --exclude=.env.local --exclude='*.tsbuildinfo' \
  "$repo_dir/apps/mobile/" "$build_dir/apps/mobile/"
rsync -a --exclude=node_modules --exclude=dist "$repo_dir/packages/core/" "$build_dir/packages/core/"

export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [[ -z "$ANDROID_HOME" ]]; then
  for candidate in "$HOME/Library/Android/sdk" /opt/homebrew/share/android-commandlinetools; do
    [[ -d "$candidate/platform-tools" ]] && ANDROID_HOME="$candidate" && break
  done
fi
[[ -d "${ANDROID_HOME:-}" ]] || { printf '%s\n' 'BLOCKED: no Android SDK; set ANDROID_HOME'; exit 1; }
export ANDROID_SDK_ROOT="$ANDROID_HOME"
if [[ -z "${JAVA_HOME:-}" ]]; then
  JAVA_HOME="$(/usr/libexec/java_home -v 17 2>/dev/null || true)"
  [[ -n "$JAVA_HOME" ]] || JAVA_HOME="$(ls -d /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home 2>/dev/null || true)"
fi
export JAVA_HOME
[[ -x "${JAVA_HOME:-}/bin/java" ]] || { printf '%s\n' 'BLOCKED: no JDK 17; set JAVA_HOME'; exit 1; }
printf 'SDK: %s\nJDK: %s\n' "$ANDROID_HOME" "$JAVA_HOME"

cd "$build_dir/apps/mobile"
npm ci
CI=1 npx --no-install expo prebuild --no-install --platform android
cd android
printf 'Compiling; detailed output: %s/build.log\n' "$build_dir"
if ! ./gradlew --no-daemon --quiet assembleRelease -x lint > "$build_dir/build.log" 2>&1; then
  tail -80 "$build_dir/build.log"
  exit 1
fi
apk="$build_dir/apps/mobile/android/app/build/outputs/apk/release/app-release.apk"
printf 'Built apk: %s\n' "$apk"
printf '%s\n' 'Temporary build retained for inspection and emulator installation; no repository files were moved.'
