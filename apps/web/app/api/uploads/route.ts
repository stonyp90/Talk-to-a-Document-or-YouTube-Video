import { prepareUpload } from "@/apps/web/src/composition";
import { InputValidationError } from "@/packages/core/src/domain/ingestion";
export async function POST(request: Request) {
  try {
    return Response.json(await prepareUpload(await request.json()), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      error instanceof InputValidationError
        ? { error: error.message, code: error.code }
        : {
            error:
              "Could not prepare upload. Check the PDF type and 25 MB limit.",
          },
      { status: 400 },
    );
  }
}
