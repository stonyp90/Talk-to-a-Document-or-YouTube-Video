import type { MetadataRoute } from "next";
import { robotsPolicy } from "@/packages/core/src/domain/discoverability";
import { siteProfile } from "./seo/profile";

/** Crawlers are welcome everywhere a person is; the API is not a page. */
export default function robots(): MetadataRoute.Robots {
  const policy = robotsPolicy(siteProfile());
  return {
    rules: policy.rules,
    sitemap: policy.sitemap,
    host: policy.host,
  };
}
