import { version as packageVersion } from "./package.json";

/**
 * Releases are versioned by the pipeline, never by hand. The major and minor
 * come from package.json; the pipeline supplies the patch and the native build
 * number from its run number, which only ever increases. A local build with
 * nothing set is 0 (`…​.0`, build 1), so a hand-built binary can never be
 * mistaken for a released one.
 */
function releaseVersion(): { name: string; build: number } {
  const build = Number(process.env.APP_BUILD ?? "1");
  if (!Number.isInteger(build) || build < 1) {
    throw new Error("APP_BUILD must be a positive integer.");
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
      softwareKeyboardLayoutMode: "pan",
      versionCode: release.build,
      permissions: ["RECORD_AUDIO", "MODIFY_AUDIO_SETTINGS"],
      usesCleartextTraffic: true,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#F27561",
        monochromeImage: "./assets/monochrome-icon.png",
      },
    },
    plugins: [
      "expo-document-picker",
      "expo-dev-client",
      "expo-speech-recognition",
      "@config-plugins/react-native-webrtc",
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
