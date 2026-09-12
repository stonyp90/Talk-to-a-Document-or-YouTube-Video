import type { MetadataRoute } from "next";
import { sitemapEntries } from "@/packages/core/src/domain/discoverability";
import { siteProfile } from "./seo/profile";

/** Every page in every language, each one pointing at its translations. */
export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries(siteProfile()).map((entry) => ({
    url: entry.url,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
    alternates: entry.alternates,
  }));
}
