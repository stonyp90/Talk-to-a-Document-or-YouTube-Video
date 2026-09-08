import { createRealtimeCallAnswer } from "@/src/server/openai";
import { sourceSchema } from "@/src/server/validation";
import { z } from "zod";

const connectionSchema = z.object({
  sdp: z.string().min(1).max(100000),
  source: sourceSchema,
});

export async function POST(request: Request) {
  try {
    const parsed = connectionSchema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        {
          error:
            "Valid SDP and source context within the size limit are required.",
        },
        { status: 400 },
      );
    const answer = await createRealtimeCallAnswer(
      parsed.data.sdp,
      parsed.data.source,
    );
    return new Response(answer, {
      headers: {
        "Content-Type": "application/sdp",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Realtime connection failed.",
      },
      { status: 500 },
    );
  }
}
