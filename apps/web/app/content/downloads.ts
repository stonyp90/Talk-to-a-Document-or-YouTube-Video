import type { BrandIconName } from "../components/BrandIcon";

/**
 * Where the mobile builds live. One place, because the top menu and the
 * applications section offer the same files and must never disagree about a
 * version. The tag is configuration so cutting a release does not mean editing
 * a component; the default is the release currently published.
 */
const REPOSITORY =
  process.env.NEXT_PUBLIC_APP_REPOSITORY ??
  "https://github.com/stonyp90/Talk-to-a-Document-or-YouTube-Video";
const TAG = process.env.NEXT_PUBLIC_APP_RELEASE_TAG ?? "v0.1.0-demo.2";

export const repositoryUrl = REPOSITORY;
export const releaseNotesUrl = `${REPOSITORY}/releases/tag/${TAG}`;
export const checksumsUrl = `${REPOSITORY}/releases/download/${TAG}/SHA256SUMS.txt`;
export const releaseTag = TAG;

export type AppDownload = {
  id: "android" | "ios";
  icon: BrandIconName;
  /** Shown in the menu; already short enough for a narrow screen. */
  label: string;
  /** What the reader gets, in their own terms. */
  detail: string;
  url: string;
};

export const appDownloads: AppDownload[] = [
  {
    id: "android",
    icon: "android",
    label: "Android APK",
    detail: "Android 7.0 or later",
    url: `${REPOSITORY}/releases/download/${TAG}/ursly-${TAG}-android.apk`,
  },
  {
    id: "ios",
    icon: "apple",
    // Apple does not let a preview build install on a phone from a web link,
    // so the honest offer is the Simulator archive rather than an ".ipa" a
    // reader could not use.
    label: "iOS Simulator build",
    detail: "Xcode Simulator, Apple silicon",
    url: `${REPOSITORY}/releases/download/${TAG}/ursly-${TAG}-ios-simulator-arm64.tar.gz`,
  },
];
