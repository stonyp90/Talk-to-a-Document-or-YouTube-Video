import { InputValidationError } from "@/packages/core/src/domain/ingestion";
import { ingestFormData } from "@/apps/web/src/composition";

export async function POST(request: Request) {
  try {
    const result = await ingestFormData(await request.formData());
    return Response.json({ source: result });
  } catch (error) {
    if (error instanceof InputValidationError || error instanceof Error) {
      return Response.json(
        {
          error: error.message,
          code:
            error instanceof InputValidationError
              ? error.code
              : "INGESTION_FAILED",
        },
        { status: 400 },
      );
    }
    return Response.json(
      { error: "Source ingestion failed.", code: "INGESTION_FAILED" },
      { status: 500 },
    );
  }
}
