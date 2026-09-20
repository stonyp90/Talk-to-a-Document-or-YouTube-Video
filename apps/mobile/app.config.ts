import { version as packageVersion } from "./package.json";
import { withAndroidManifest, type ConfigPlugin } from "expo/config-plugins";
import { execFileSync } from "node:child_process";

/**
 * Release builds talk to a local API over plain HTTP on the emulator (through
 * `adb reverse`), which Android blocks unless the manifest says otherwise.
 * `android.usesCleartextTraffic` below documents the intent, but prebuild does
 * not write it, so the manifest attribute is set here. Distributed builds
 * point at an HTTPS API and never rely on it.
 */
const LOCAL_CLEARTEXT = true;
const withLocalCleartext: ConfigPlugin = (expoConfig) =>
  withAndroidManifest(expoConfig, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (application)
      application.$["android:usesCleartextTraffic"] = LOCAL_CLEARTEXT
        ? "true"
        : "false";
    return mod;
  });

/**
 * Releases are versioned by the pipeline, never by hand. The major and minor
 * come from package.json; CI supplies its monotonically increasing run number.
 * Local and EAS builds without that variable use the commit count, with a
 * timestamp fallback for source archives, so every build gets a new version
 * instead of silently reusing 0.1.0.
 */
function releaseVersion(): { name: string; build: number } {
  const configuredBuild =
    process.env.APP_BUILD ??
    process.env.GITHUB_RUN_NUMBER ??
    process.env.BUILD_NUMBER;
  const build = Number(configuredBuild ?? sourceBuildNumber());
  if (!Number.isInteger(build) || build < 1) {
    throw new Error("APP_BUILD must be a positive integer.");
  }

  function sourceBuildNumber(): number {
    try {
      const count = Number(
        execFileSync("git", ["rev-list", "--count", "HEAD"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim(),
      );
      if (Number.isInteger(count) && count > 0) return count;
    } catch {
      // EAS source archives may not contain .git; use a unique build number.
    }
    return Date.now();
  }
  const named = process.env.APP_VERSION?.trim();
  if (named) {
    if (!/^\d+\.\d+\.\d+$/.test(named)) {
      throw new Error("APP_VERSION must look like 1.2.3.");
    }
    return { name: named, build };
  }
  const [major = "0", minor = "0"] = packageVersion.split(".");
  return {
    name: `${major}.${minor}.${process.env.APP_BUILD ? build : 0}`,
    build,
  };
}

const release = releaseVersion();

const cloudBuild = Boolean(process.env.EAS_BUILD_PROFILE);
if (cloudBuild) {
  if (
    !process.env.EXPO_OWNER ||
    !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(
      process.env.EXPO_PROJECT_ID ?? "",
    )
  ) {
    throw new Error(
      "EAS builds require EXPO_OWNER and EXPO_PROJECT_ID in the preview environment.",
    );
  }
  const api = new URL(process.env.EXPO_PUBLIC_API_URL ?? "");
  if (
    api.protocol !== "https:" ||
    api.username ||
    api.password ||
    api.search ||
    api.hash ||
    /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(api.hostname)
  ) {
    throw new Error(
      "EAS builds require a non-loopback HTTPS EXPO_PUBLIC_API_URL without credentials.",
    );
  }
}

const config = {
  expo: {
    name: "Ursly",
    slug: "talk-to-a-source",
    scheme: "talktosource",
    version: release.name,
    icon: "./assets/icon.png",
    owner: process.env.EXPO_OWNER || "stonyp90",
    extra: {
      website: "https://ursly.io",
      eas: {
        projectId:
          process.env.EXPO_PROJECT_ID || "345afb85-8b7b-49a1-bf93-48e0f2ce0b35",
      },
    },
    orientation: "portrait",
    newArchEnabled: true,
    ios: {
      bundleIdentifier: "com.talktosource.demo",
      buildNumber: String(release.build),
      infoPlist: {
        NSMicrophoneUsageDescription:
          "Use your microphone to ask questions about your source.",
        NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
      },
    },
    android: {
      package: "com.talktosource.demo",
      softwareKeyboardLayoutMode: "resize",
      versionCode: release.build,
      permissions: ["RECORD_AUDIO", "MODIFY_AUDIO_SETTINGS"],
      usesCleartextTraffic: LOCAL_CLEARTEXT,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#F27561",
        monochromeImage: "./assets/monochrome-icon.png",
      },
    },
    plugins: [
      withLocalCleartext,
      "expo-asset",
      "expo-document-picker",
      [
        "expo-camera",
        {
          cameraPermission:
            "Use your camera during the Ursly experience.",
          microphonePermission:
            "Use your microphone to ask questions about your source.",
          recordAudioAndroid: false,
          barcodeScannerEnabled: false,
        },
      ],
      [
        "expo-sensors",
        {
          motionPermission:
            "Use device movement to navigate the Ursly experience.",
        },
      ],
      "expo-dev-client",
      "expo-speech-recognition",
      "@config-plugins/react-native-webrtc",
      "./src/ar/expo-ar-scene",
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-icon.png",
          imageWidth: 112,
          backgroundColor: "#F8F5EF",
          dark: {
            image: "./assets/splash-icon.png",
            backgroundColor: "#292735",
          },
        },
      ],
    ],
  },
};
export default config;
