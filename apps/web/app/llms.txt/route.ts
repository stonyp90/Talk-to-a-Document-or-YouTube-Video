import { llmsText } from "@/packages/core/src/domain/discoverability";
import { siteProfile } from "../seo/profile";

/**
 * A plain reading of Ursly for the models that answer questions about it.
 * They rarely watch a video and never open a dialog, so the introduction is
 * offered here as words, with a link to wherever it is actually published.
 */
export function GET(): Response {
  return new Response(llmsText(siteProfile()), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
