import {
  answerTextQuestion,
  recordTurns,
  resolveSession,
} from "@/apps/web/src/composition";
import { errorResponse, json, jsonError, rateLimit } from "@/apps/web/src/http";
import { textChatSchema } from "@/apps/web/src/validation";

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    name: "text-chat",
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;
  try {
    const parsed = textChatSchema.safeParse(await request.json());
    if (!parsed.success)
      return jsonError(
        "INVALID_QUESTION",
        "Provide a source and a question of at most 4,000 characters.",
        400,
      );

    const { question, ...reference } = parsed.data;
    const session = await resolveSession(reference);
    const answer = await answerTextQuestion(
      session.source,
      question,
      session.turns,
    );
    await recordTurns(session.id, [
      { role: "user", text: question },
      { role: "assistant", text: answer },
    ]);
    return json({ answer, sourceId: session.id });
  } catch (error) {
    return errorResponse(error, "The answer could not be produced. Please retry.");
  }
}
