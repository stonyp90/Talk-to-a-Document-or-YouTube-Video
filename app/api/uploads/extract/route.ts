import { extractUpload } from "@/src/server/uploads";
import { InputValidationError } from "@/src/domain/ingestion";
export async function POST(request: Request) {
  try {
    const { key, name } = await request.json();
    return Response.json({ source: await extractUpload(key, name) });
  } catch (error) {
    return Response.json(
      error instanceof InputValidationError
        ? { error: error.message, code: error.code }
        : {
            error:
              "Could not extract this uploaded PDF. Please upload it again.",
          },
      { status: 400 },
    );
  }
}
