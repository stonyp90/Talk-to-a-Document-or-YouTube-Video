import { ingestFormData, openSource } from "@/apps/web/src/composition";
import { errorResponse, json, rateLimit } from "@/apps/web/src/http";
import { guard, unitsFor } from "@/apps/web/src/auth";

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    name: "ingest",
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;
  const account = await guard(request, { units: unitsFor("ingest") });
  if (account instanceof Response) return account;
  try {
    return json(
      await openSource(await ingestFormData(await request.formData())),
    );
  } catch (error) {
    return errorResponse(error, "Source ingestion failed. Please try again.");
  }
}
