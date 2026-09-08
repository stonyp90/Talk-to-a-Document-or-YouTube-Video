import { IngestedSource } from "@/packages/core/src/domain/ingestion";
import { answerTextQuestion } from "@/apps/web/src/composition";
import { sourceSchema } from "@/apps/web/src/validation";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      source?: IngestedSource;
      question?: string;
    };
    if (
      !sourceSchema.safeParse(payload.source).success ||
      typeof payload.question !== "string" ||
      payload.question.length > 4000
    )
      return Response.json(
        {
          error:
            "Provide a valid source and question of at most 4,000 characters.",
        },
        { status: 400 },
      );
    if (!payload.source?.text || !payload.question?.trim())
      return Response.json(
        { error: "Source context and a question are required." },
        { status: 400 },
      );
    return Response.json({
      answer: await answerTextQuestion(payload.source, payload.question.trim()),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Text chat failed." },
      { status: 500 },
    );
  }
}
