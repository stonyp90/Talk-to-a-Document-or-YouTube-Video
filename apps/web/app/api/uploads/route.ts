import { prepareUpload } from "@/apps/web/src/composition";
import { errorResponse, json, jsonError, rateLimit } from "@/apps/web/src/http";
import { guard, unitsFor } from "@/apps/web/src/auth";
import { uploadRequestSchema } from "@/apps/web/src/validation";

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    name: "uploads",
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;
  const account = await guard(request, { units: unitsFor("upload") });
  if (account instanceof Response) return account;
  try {
    const parsed = uploadRequestSchema.safeParse(await request.json());
    if (!parsed.success)
      return jsonError(
        "INVALID_FILE",
        "Describe the PDF with a name, a type and a size.",
        400,
      );
    return json(await prepareUpload(parsed.data));
  } catch (error) {
    return errorResponse(
      error,
      "Could not prepare the upload. Check the PDF type and the 25 MB limit.",
    );
  }
}
