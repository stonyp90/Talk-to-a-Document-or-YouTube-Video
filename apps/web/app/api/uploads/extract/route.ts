import { extractUpload, openSource } from "@/apps/web/src/composition";
import { errorResponse, json, jsonError, rateLimit } from "@/apps/web/src/http";
import { guard, unitsFor } from "@/apps/web/src/auth";
import { extractRequestSchema } from "@/apps/web/src/validation";

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    name: "extract",
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;
  const account = await guard(request, { units: unitsFor("extract") });
  if (account instanceof Response) return account;
  try {
    const parsed = extractRequestSchema.safeParse(await request.json());
    if (!parsed.success)
      return jsonError(
        "INVALID_UPLOAD",
        "Upload the PDF again: its reference is missing.",
        400,
      );
    return json(
      await openSource(await extractUpload(parsed.data.key, parsed.data.name)),
    );
  } catch (error) {
    return errorResponse(
      error,
      "Could not read this uploaded PDF. Please upload it again.",
    );
  }
}
