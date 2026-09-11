/**
 * The languages the interface speaks. English is the source language: every
 * user-facing string is written in English and French is an explicit
 * translation looked up by that English key. Unsupported browsers fall back to
 * English rather than to a partial translation.
 */
export const LANGUAGES = ["en", "fr"] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = "en";

/** Persists an explicit choice so the root URL keeps honouring it. */
export const LANGUAGE_COOKIE = "ursly-language";
export const LANGUAGE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

/** The language named by a path such as `/fr` or `/en/`, if any. */
export function pathLanguage(pathname: string): Language | undefined {
  const [segment] = pathname.split("/").filter(Boolean);
  return isLanguage(segment) ? segment : undefined;
}

type Preference = { tag: string; quality: number; order: number };

/** Parses an Accept-Language header into tags ordered by preference. */
function parseAcceptLanguage(header: string): Preference[] {
  return header
    .split(",")
    .map((part, order): Preference | undefined => {
      const [rawTag, ...params] = part.trim().split(";");
      const tag = rawTag?.trim().toLowerCase();
      if (!tag) return undefined;
      const q = params
        .map((param) => param.trim())
        .find((param) => param.startsWith("q="));
      const quality = q ? Number.parseFloat(q.slice(2)) : 1;
      return { tag, quality: Number.isFinite(quality) ? quality : 0, order };
    })
    .filter((item): item is Preference => item !== undefined && item.quality > 0)
    .sort((left, right) => right.quality - left.quality || left.order - right.order);
}

/**
 * Picks the interface language. A stored choice wins; otherwise the browser's
 * ranked preferences are matched by primary subtag, so `fr-CA` and `fr-FR`
 * both read French. Anything else, including a wildcard, is English.
 */
export function negotiateLanguage({
  cookie,
  acceptLanguage,
}: {
  cookie?: string | null;
  acceptLanguage?: string | null;
}): Language {
  if (isLanguage(cookie)) return cookie;
  for (const { tag } of parseAcceptLanguage(acceptLanguage ?? "")) {
    const primary = tag.split("-")[0];
    if (isLanguage(primary)) return primary;
  }
  return DEFAULT_LANGUAGE;
}
