import {
  INTRO_DESCRIPTION,
  INTRO_DURATION_SECONDS,
  INTRO_PUBLISHED_ON,
  INTRO_SCENES,
  INTRO_TITLE_KEY,
  introVideoPaths,
} from "../content/intro-video";
import { SITE_COPY, SITE_NAME } from "../content/site";
import { dictionaryFor } from "../i18n/dictionaries";
import { createTranslator } from "../i18n/translate";
import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from "../i18n/languages";
import type {
  IntroVideo,
  SiteProfile,
} from "@/packages/core/src/domain/discoverability";

/**
 * The adapter that turns environment and copy into the profile the domain
 * reads. Nothing here decides what the graph looks like; it only answers
 * where this deployment lives and where its introduction has been published.
 */

const DEFAULT_SITE_URL = "https://ursly.io";

/** Comma-separated configuration, forgiving about spacing and trailing commas. */
function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * A YouTube id per language, because the introduction is narrated twice and
 * each version deserves its own listing. An unset id is not a failure: the
 * graph then points at the file this origin serves, which is what happens
 * before the videos are uploaded and after a channel is ever taken down.
 */
function youtubeId(language: Language): string | undefined {
  const ids: Record<Language, string | undefined> = {
    en: process.env.INTRO_VIDEO_YOUTUBE_ID_EN,
    fr: process.env.INTRO_VIDEO_YOUTUBE_ID_FR,
  };
  return ids[language]?.trim() || undefined;
}

function introVideo(language: Language): IntroVideo {
  const t = createTranslator(dictionaryFor(language));
  const paths = introVideoPaths(language);
  const id = youtubeId(language);
  return {
    language,
    // The heading ends in a full stop on the page; a title does not.
    name: t(INTRO_TITLE_KEY, { seconds: INTRO_DURATION_SECONDS }).replace(
      /\.$/,
      "",
    ),
    description: t(INTRO_DESCRIPTION),
    // Each half is keyed on its own in the dictionary, so the halves are
    // translated and then joined. Translating the joined line would ask for a
    // sentence no translator has seen, and answer engines would read English.
    transcript: INTRO_SCENES.map(
      (scene) => `${t(scene.headline)} ${t(scene.lede)}`,
    ).join(" "),
    durationSeconds: INTRO_DURATION_SECONDS,
    publishedOn: process.env.INTRO_VIDEO_PUBLISHED_ON || INTRO_PUBLISHED_ON,
    contentPath: paths.mp4,
    captionsPath: paths.captions,
    thumbnailPath: paths.poster,
    ...(id ? { youtubeId: id } : {}),
  };
}

export function siteProfile(
  language: Language = DEFAULT_LANGUAGE,
): SiteProfile {
  return {
    siteUrl: (process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, ""),
    name: SITE_NAME,
    description: SITE_COPY[language].description,
    sameAs: list(process.env.SITE_SAME_AS),
    defaultLanguage: DEFAULT_LANGUAGE,
    languages: [...LANGUAGES],
    pages: [{ path: "/", priority: 1, changeFrequency: "weekly" }],
    application: {
      category: "EducationalApplication",
      operatingSystem: "Web",
      price: "0",
      currency: "USD",
    },
    privatePaths: ["/api/"],
    videos: LANGUAGES.map((entry) => introVideo(entry)),
  };
}
