#!/usr/bin/env bash
set -euo pipefail

# Copy this mobile application and the core shared by both clients. Native
# projects are regenerated so no absolute paths from the original Pods survive.
repo_dir="$(cd "$(dirname "$0")/../.." && pwd)"
# SDK 57 needs Xcode 26.4+. Check before making a copy or downloading Pods.
xcode_version="$(xcodebuild -version | awk '/^Xcode / {print $2}')"
xcode_major="${xcode_version%%.*}"
xcode_minor="${xcode_version#*.}"
xcode_minor="${xcode_minor%%.*}"
if (( xcode_major < 26 || (xcode_major == 26 && xcode_minor < 4) )); then
  printf 'Xcode 26.4 or newer is required for Expo SDK 57; selected: %s\n' "$xcode_version" >&2
  exit 1
fi
# /tmp is a symlink on macOS; Xcode and Metro can disagree on /tmp versus
# /private/tmp entry paths. /Users/Shared has a canonical, space-free path.
build_dir="$(mktemp -d /Users/Shared/talk-mobile.XXXXXX)"
printf 'Isolated build directory: %s\n' "$build_dir"
mkdir -p "$build_dir/apps/mobile" "$build_dir/packages/core"
rsync -a --exclude=node_modules --exclude=ios --exclude=android --exclude=dist \
  --exclude=.expo --exclude=.env.local --exclude='*.tsbuildinfo' \
  "$repo_dir/apps/mobile/" "$build_dir/apps/mobile/"
rsync -a --exclude=node_modules --exclude=dist "$repo_dir/packages/core/" "$build_dir/packages/core/"
cd "$build_dir/apps/mobile"
npm ci
CI=1 npx --no-install expo prebuild --no-install --platform ios
cd ios
pod install --silent
printf 'Compiling; detailed output: %s/build.log\n' "$build_dir"
if ! xcodebuild -jobs 2 -workspace Ursly.xcworkspace -scheme Ursly \
  -configuration Release -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' ARCHS=arm64 ONLY_ACTIVE_ARCH=YES \
  -derivedDataPath "$build_dir/DerivedData" CODE_SIGNING_ALLOWED=NO build \
  > "$build_dir/build.log" 2>&1; then
  tail -80 "$build_dir/build.log"
  exit 1
fi
printf 'Built app: %s/DerivedData/Build/Products/Release-iphonesimulator/Ursly.app\n' "$build_dir"
printf '%s\n' 'Temporary build retained for inspection and simulator installation; no repository files were moved.'
