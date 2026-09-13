#!/usr/bin/env bash
set -euo pipefail
# No installation or host changes occur during `check`.
action="${1:-check}"
case "$action" in
  check)
    if command -v xcrun >/dev/null; then
      xcodebuild -version
      xcrun simctl list devices available
    else printf '%s\n' 'BLOCKED: Xcode/simctl unavailable'; fi
    command -v pod || true
    sdk="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/Library/Android/sdk}}"
    if command -v adb >/dev/null; then adb devices -l
    elif [[ -x "$sdk/platform-tools/adb" ]]; then "$sdk/platform-tools/adb" devices -l
    else printf '%s\n' 'BLOCKED: Android adb unavailable'; fi
    if command -v emulator >/dev/null; then emulator -list-avds
    elif [[ -x "$sdk/emulator/emulator" ]]; then "$sdk/emulator/emulator" -list-avds
    else printf '%s\n' 'BLOCKED: Android emulator unavailable'; fi
    command -v maestro || printf '%s\n' 'Maestro not installed; native UI smoke requires an existing installation.'
    ;;
  ios-boot)
    device="${2:?Provide an exact simulator UDID from check}"
    xcrun simctl boot "$device"
    xcrun simctl bootstatus "$device" -b
    ;;
  ios-launch)
    xcrun simctl launch "${2:?Provide a simulator UDID}" com.talktosource.demo
    ;;
  ios-install)
    xcrun simctl install "${2:?Provide a simulator UDID}" "${3:?Provide built .app path}"
    ;;
  ios-screenshot)
    xcrun simctl io "${2:?Provide a simulator UDID}" screenshot "${3:?Provide output PNG path}"
    ;;
  android-boot)
    emulator -avd "${2:?Provide an existing AVD name}"
    ;;
  android-launch)
    adb -s "${2:?Provide an exact adb serial}" shell am start -n com.talktosource.demo/.MainActivity
    ;;
  android-reverse)
    adb -s "${2:?Provide an exact adb serial}" reverse tcp:3000 tcp:3000
    adb -s "$2" reverse tcp:9002 tcp:9002
    ;;
  *) printf '%s\n' 'Usage: simulator.sh check|ios-boot|ios-launch|ios-install|ios-screenshot|android-boot|android-launch|android-reverse [device] [path]'; exit 2 ;;
esac
