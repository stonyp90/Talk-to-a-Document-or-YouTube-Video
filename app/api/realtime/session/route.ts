import { createRealtimeSession } from "@/src/server/openai";
import { IngestedSource } from "@/src/domain/ingestion";
import { sourceSchema } from "@/src/server/validation";

export async function POST(request: Request) {
  try {
    const parsed = sourceSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({error:"A valid source of at most 60,000 characters is required."},{status:400});
    const source: IngestedSource = parsed.data;
    if (!source?.text || !source?.sourceName) return Response.json({ error: "A source context is required." }, { status: 400 });
    const session = await createRealtimeSession(source);
    return Response.json(session, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Realtime session setup failed." }, { status: 500 });
  }
}
