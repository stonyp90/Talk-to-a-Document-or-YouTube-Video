import { ingestFormData, openSource } from "@/apps/web/src/composition";
import {
  errorResponse,
  json,
  multipartFormData,
  rateLimit,
} from "@/apps/web/src/http";

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    name: "ingest",
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;
  try {
    const form = await multipartFormData(request);
    return json(await openSource(await ingestFormData(form)));
  } catch (error) {
    return errorResponse(error, "Source ingestion failed. Please try again.");
  }
}
