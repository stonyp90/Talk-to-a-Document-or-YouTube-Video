#!/usr/bin/env bash
set -euo pipefail
# CocoaPods refuses to run from a shell without a UTF-8 locale (CI, cron, agents).
export LANG="${LANG:-en_US.UTF-8}"

# Copy only this mobile application and its type-only shared contract. Native
# projects are regenerated so no absolute paths from the original Pods survive.
repo_dir="$(cd "$(dirname "$0")/../.." && pwd)"
# /tmp is a symlink on macOS; Xcode and Metro can disagree on /tmp versus
# /private/tmp entry paths. /Users/Shared has a canonical, space-free path.
build_dir="$(mktemp -d /Users/Shared/talk-mobile.XXXXXX)"
printf 'Isolated build directory: %s\n' "$build_dir"
mkdir -p "$build_dir/apps/mobile" "$build_dir/packages/core/src/domain"
rsync -a --exclude=node_modules --exclude=ios --exclude=android --exclude=dist \
  --exclude=.expo --exclude=.env.local --exclude='*.tsbuildinfo' \
  "$repo_dir/apps/mobile/" "$build_dir/apps/mobile/"
cp "$repo_dir/packages/core/src/domain/ingestion.ts" "$build_dir/packages/core/src/domain/ingestion.ts"
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
