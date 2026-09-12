/**
 * How Ursly describes itself to the machines that read the web: search
 * crawlers, social unfurlers, and the answer engines that quote a page
 * without ever showing it. The intro video is the part at most risk of being
 * invisible, because a muted file behind a dialog is text to nobody. Naming it
 * as a VideoObject, with its transcript and its published location, is what
 * turns twenty-four seconds of motion into something quotable.
 *
 * Everything here is a pure reading of a profile value. Where that profile
 * comes from - environment, configuration, a dictionary - is the adapter's
 * business, not the domain's.
 */

export type ChangeFrequency = "daily" | "weekly" | "monthly" | "yearly";

export type SitePage = {
  /** Path under the language prefix, "/" for the home page. */
  path: string;
  priority: number;
  changeFrequency: ChangeFrequency;
};

export type IntroVideo = {
  language: string;
  name: string;
  description: string;
  /** The spoken and on-screen words, so the video is readable as text. */
  transcript: string;
  durationSeconds: number;
  /** ISO 8601 date; search engines reject a VideoObject without one. */
  publishedOn: string;
  contentPath: string;
  captionsPath: string;
  thumbnailPath: string;
  /**
   * Set once the video is published on YouTube. YouTube is itself a source
   * every answer engine already crawls, so a copy there is worth more than a
   * file only this origin serves.
   */
  youtubeId?: string;
};

export type SiteProfile = {
  siteUrl: string;
  name: string;
  description: string;
  /** Other places the same organization is known by. */
  sameAs: readonly string[];
  defaultLanguage: string;
  languages: readonly string[];
  pages: readonly SitePage[];
  application: {
    category: string;
    operatingSystem: string;
    price: string;
    currency: string;
  };
  /** Paths no crawler should spend a budget on. */
  privatePaths: readonly string[];
  videos: readonly IntroVideo[];
};

const YOUTUBE_WATCH = "https://www.youtube.com/watch?v=";
/** The no-cookie host keeps an embedded player from tracking a reader. */
const YOUTUBE_EMBED = "https://www.youtube-nocookie.com/embed/";

export function absoluteUrl(profile: SiteProfile, path: string): string {
  return new URL(path, profile.siteUrl).toString().replace(/\/$/, "");
}

/** Seconds as the ISO 8601 duration schema.org expects, such as `PT1M30S`. */
export function isoDuration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const parts: string[] = [];
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const remainder = whole % 60;
  if (hours) parts.push(`${hours}H`);
  if (minutes) parts.push(`${minutes}M`);
  if (remainder || parts.length === 0) parts.push(`${remainder}S`);
  return `PT${parts.join("")}`;
}

export type VideoLinks = {
  /** Where a person watches it; absent until the video is on YouTube. */
  watchUrl?: string;
  embedUrl?: string;
  /** The file this origin serves, always available as the fallback. */
  contentUrl: string;
  captionsUrl: string;
  thumbnailUrl: string;
};

export function videoLinks(
  profile: SiteProfile,
  video: IntroVideo,
): VideoLinks {
  return {
    ...(video.youtubeId
      ? {
          watchUrl: `${YOUTUBE_WATCH}${video.youtubeId}`,
          embedUrl: `${YOUTUBE_EMBED}${video.youtubeId}`,
        }
      : {}),
    contentUrl: absoluteUrl(profile, video.contentPath),
    captionsUrl: absoluteUrl(profile, video.captionsPath),
    thumbnailUrl: absoluteUrl(profile, video.thumbnailPath),
  };
}

export function videoFor(
  profile: SiteProfile,
  language: string,
): IntroVideo | undefined {
  return profile.videos.find((video) => video.language === language);
}

export function homeUrl(profile: SiteProfile, language: string): string {
  return absoluteUrl(profile, `/${language}`);
}

/** Drops absent branches so the serialised JSON carries no empty keys. */
function defined<T extends Record<string, unknown>>(node: T): T {
  return Object.fromEntries(
    Object.entries(node).filter(([, value]) => value !== undefined),
  ) as T;
}

function organization(profile: SiteProfile) {
  return defined({
    "@type": "Organization",
    "@id": `${profile.siteUrl}#organization`,
    name: profile.name,
    url: profile.siteUrl,
    description: profile.description,
    logo: absoluteUrl(profile, "/brand/icon-512.png"),
    sameAs: profile.sameAs.length ? [...profile.sameAs] : undefined,
  });
}

function website(profile: SiteProfile, language: string) {
  return {
    "@type": "WebSite",
    "@id": `${profile.siteUrl}#website`,
    name: profile.name,
    url: homeUrl(profile, language),
    description: profile.description,
    inLanguage: language,
    publisher: { "@id": `${profile.siteUrl}#organization` },
  };
}

function application(profile: SiteProfile, language: string) {
  return {
    "@type": "SoftwareApplication",
    "@id": `${profile.siteUrl}#application`,
    name: profile.name,
    url: homeUrl(profile, language),
    description: profile.description,
    applicationCategory: profile.application.category,
    operatingSystem: profile.application.operatingSystem,
    inLanguage: [...profile.languages],
    offers: {
      "@type": "Offer",
      price: profile.application.price,
      priceCurrency: profile.application.currency,
    },
    publisher: { "@id": `${profile.siteUrl}#organization` },
  };
}

function videoObject(profile: SiteProfile, video: IntroVideo) {
  const links = videoLinks(profile, video);
  return defined({
    "@type": "VideoObject",
    "@id": `${profile.siteUrl}#intro-${video.language}`,
    name: video.name,
    description: video.description,
    transcript: video.transcript,
    inLanguage: video.language,
    uploadDate: video.publishedOn,
    duration: isoDuration(video.durationSeconds),
    thumbnailUrl: links.thumbnailUrl,
    contentUrl: links.contentUrl,
    url: links.watchUrl,
    embedUrl: links.embedUrl,
    isFamilyFriendly: true,
    publisher: { "@id": `${profile.siteUrl}#organization` },
    caption: {
      "@type": "MediaObject",
      encodingFormat: "text/vtt",
      contentUrl: links.captionsUrl,
    },
  });
}

/**
 * The linked-data graph for one language of the home page. A single script
 * holding several nodes lets them reference each other by id, which is how a
 * crawler learns that the video, the application and the organization are the
 * same story rather than three unrelated facts.
 */
export function structuredData(
  profile: SiteProfile,
  language: string,
): readonly unknown[] {
  const video = videoFor(profile, language);
  return [
    organization(profile),
    website(profile, language),
    application(profile, language),
    ...(video ? [videoObject(profile, video)] : []),
  ];
}

/** The graph wrapped in the context a `application/ld+json` script carries. */
export function structuredDataDocument(
  profile: SiteProfile,
  language: string,
): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": structuredData(profile, language),
  });
}

export type SitemapEntry = {
  url: string;
  changeFrequency: ChangeFrequency;
  priority: number;
  alternates: { languages: Record<string, string> };
};

/**
 * Every page in every language, each one pointing at its translations. The
 * default language doubles as `x-default`, so a reader with no stated
 * preference is sent somewhere real rather than to a redirect.
 */
export function sitemapEntries(profile: SiteProfile): SitemapEntry[] {
  return profile.pages.flatMap((page) => {
    const pathFor = (language: string) =>
      absoluteUrl(profile, `/${language}${page.path}`);
    const languages: Record<string, string> = Object.fromEntries([
      ...profile.languages.map((language) => [language, pathFor(language)]),
      ["x-default", pathFor(profile.defaultLanguage)],
    ]);
    return profile.languages.map((language) => ({
      url: pathFor(language),
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      alternates: { languages },
    }));
  });
}

export type RobotsPolicy = {
  rules: { userAgent: string; allow: string[]; disallow: string[] }[];
  sitemap: string;
  host: string;
};

/**
 * One rule for everyone. Answer engines are not singled out: keeping them out
 * of a product that wants to be explained would only make it unexplainable.
 */
export function robotsPolicy(profile: SiteProfile): RobotsPolicy {
  return {
    rules: [
      { userAgent: "*", allow: ["/"], disallow: [...profile.privatePaths] },
    ],
    sitemap: absoluteUrl(profile, "/sitemap.xml"),
    host: profile.siteUrl,
  };
}

/**
 * The `/llms.txt` reading of the site: what the product is, where its pages
 * are, and what the intro video says. A model that lands here should be able
 * to answer a question about Ursly without guessing from marketing copy.
 */
export function llmsText(profile: SiteProfile): string {
  const lines = [
    `# ${profile.name}`,
    "",
    `> ${profile.description}`,
    "",
    "## Pages",
    "",
    ...profile.languages.map(
      (language) => `- [${language}](${homeUrl(profile, language)})`,
    ),
    "",
    "## Introduction video",
    "",
  ];
  for (const video of profile.videos) {
    const links = videoLinks(profile, video);
    lines.push(
      `### ${video.name} (${video.language})`,
      "",
      video.description,
      "",
      `- Watch: ${links.watchUrl ?? links.contentUrl}`,
      `- Captions: ${links.captionsUrl}`,
      `- Duration: ${isoDuration(video.durationSeconds)}`,
      "",
      "Transcript:",
      "",
      video.transcript,
      "",
    );
  }
  return lines.join("\n");
}
