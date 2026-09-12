import { describe, expect, it } from "vitest";
import {
  isoDuration,
  llmsText,
  robotsPolicy,
  sitemapEntries,
  structuredData,
  videoLinks,
  type SiteProfile,
} from "./discoverability";

const profile: SiteProfile = {
  siteUrl: "https://example.test",
  name: "Ursly",
  description: "Explore your sources through conversation.",
  sameAs: ["https://github.com/example/ursly"],
  defaultLanguage: "en",
  languages: ["en", "fr"],
  pages: [{ path: "/", priority: 1, changeFrequency: "weekly" }],
  application: {
    category: "EducationalApplication",
    operatingSystem: "Web",
    price: "0",
    currency: "USD",
  },
  privatePaths: ["/api/"],
  videos: [
    {
      language: "en",
      name: "Ursly in 24 seconds",
      description: "A source, a question, a conversation.",
      transcript: "Ursly. A source. A conversation.",
      durationSeconds: 24,
      publishedOn: "2026-09-01",
      contentPath: "/brand/ursly-intro.en.mp4",
      captionsPath: "/brand/ursly-intro.en.vtt",
      thumbnailPath: "/brand/social-card.png",
      youtubeId: "abc123XYZ_-",
    },
    {
      language: "fr",
      name: "Ursly en 24 secondes",
      description: "Une source, une question, une conversation.",
      transcript: "Ursly. Une source. Une conversation.",
      durationSeconds: 24,
      publishedOn: "2026-09-01",
      contentPath: "/brand/ursly-intro.fr.mp4",
      captionsPath: "/brand/ursly-intro.fr.vtt",
      thumbnailPath: "/brand/social-card.png",
    },
  ],
};

function nodeOfType(graph: readonly unknown[], type: string) {
  return graph.find(
    (node) => (node as { "@type"?: string })["@type"] === type,
  ) as Record<string, unknown> | undefined;
}

describe("isoDuration", () => {
  it("spells seconds the way schema.org reads them", () => {
    expect(isoDuration(24)).toBe("PT24S");
    expect(isoDuration(90)).toBe("PT1M30S");
    expect(isoDuration(3600)).toBe("PT1H");
  });
});

describe("videoLinks", () => {
  it("prefers YouTube once the video is published there", () => {
    const links = videoLinks(profile, profile.videos[0]!);
    expect(links.watchUrl).toBe("https://www.youtube.com/watch?v=abc123XYZ_-");
    expect(links.embedUrl).toBe(
      "https://www.youtube-nocookie.com/embed/abc123XYZ_-",
    );
  });

  it("falls back to the self-hosted file until a YouTube id is configured", () => {
    const links = videoLinks(profile, profile.videos[1]!);
    expect(links.watchUrl).toBeUndefined();
    expect(links.contentUrl).toBe(
      "https://example.test/brand/ursly-intro.fr.mp4",
    );
  });
});

describe("structuredData", () => {
  it("describes the organization, the site and the application", () => {
    const graph = structuredData(profile, "en");
    expect(nodeOfType(graph, "Organization")?.url).toBe("https://example.test");
    expect(nodeOfType(graph, "Organization")?.sameAs).toContain(
      "https://github.com/example/ursly",
    );
    expect(nodeOfType(graph, "WebSite")?.inLanguage).toBe("en");
    expect(nodeOfType(graph, "SoftwareApplication")?.applicationCategory).toBe(
      "EducationalApplication",
    );
  });

  it("gives the intro video a transcript and captions a model can read", () => {
    const video = nodeOfType(structuredData(profile, "en"), "VideoObject");
    expect(video?.name).toBe("Ursly in 24 seconds");
    expect(video?.duration).toBe("PT24S");
    expect(video?.transcript).toContain("A source");
    expect(video?.embedUrl).toBe(
      "https://www.youtube-nocookie.com/embed/abc123XYZ_-",
    );
    expect(video?.contentUrl).toBe(
      "https://example.test/brand/ursly-intro.en.mp4",
    );
    expect(video?.uploadDate).toBe("2026-09-01");
    expect(video?.thumbnailUrl).toContain("https://example.test/brand/");
  });

  it("describes the video of the language being read, not another one", () => {
    const video = nodeOfType(structuredData(profile, "fr"), "VideoObject");
    expect(video?.name).toBe("Ursly en 24 secondes");
    expect(video?.embedUrl).toBeUndefined();
  });

  it("serialises to JSON without undefined leaves", () => {
    expect(JSON.stringify(structuredData(profile, "fr"))).not.toContain(
      "undefined",
    );
  });
});

describe("sitemapEntries", () => {
  it("lists every language of every page with its alternates", () => {
    const entries = sitemapEntries(profile);
    expect(entries.map((entry) => entry.url)).toEqual([
      "https://example.test/en",
      "https://example.test/fr",
    ]);
    expect(entries[0]!.alternates.languages).toEqual({
      en: "https://example.test/en",
      fr: "https://example.test/fr",
      "x-default": "https://example.test/en",
    });
  });
});

describe("robotsPolicy", () => {
  it("welcomes search and answer engines while keeping the API out", () => {
    const policy = robotsPolicy(profile);
    expect(policy.rules[0]!.userAgent).toBe("*");
    expect(policy.rules[0]!.disallow).toContain("/api/");
    expect(policy.sitemap).toBe("https://example.test/sitemap.xml");
  });
});

describe("llmsText", () => {
  it("offers a plain reading of the product, its pages and its video", () => {
    const text = llmsText(profile);
    expect(text.startsWith("# Ursly")).toBe(true);
    expect(text).toContain("https://example.test/en");
    expect(text).toContain("https://www.youtube.com/watch?v=abc123XYZ_-");
    expect(text).toContain("A source, a question, a conversation.");
  });
});
