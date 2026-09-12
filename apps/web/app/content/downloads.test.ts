import { describe, expect, it } from "vitest";
import {
  appDownloads,
  checksumsUrl,
  releaseNotesUrl,
  releaseTag,
  repositoryUrl,
} from "./downloads";

describe("app downloads", () => {
  it("offers one build per platform the preview supports", () => {
    expect(appDownloads.map((build) => build.id)).toEqual(["android", "ios"]);
  });

  it("points every link at the same published release", () => {
    for (const build of appDownloads) {
      expect(build.url.startsWith(`${repositoryUrl}/releases/download/`)).toBe(
        true,
      );
      expect(build.url).toContain(releaseTag);
    }
    expect(releaseNotesUrl).toContain(releaseTag);
    expect(checksumsUrl).toContain(releaseTag);
  });

  it("names what the reader will actually be able to run", () => {
    const ios = appDownloads.find((build) => build.id === "ios");
    // An iPhone cannot install a preview build from a web link, and saying
    // otherwise would send readers to a file they cannot open.
    expect(ios?.label).toContain("Simulator");
    expect(ios?.url).toMatch(/\.tar\.gz$/);
    expect(appDownloads.find((build) => build.id === "android")?.url).toMatch(
      /\.apk$/,
    );
  });
});
