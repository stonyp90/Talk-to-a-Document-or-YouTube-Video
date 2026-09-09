import { contextBudget } from "@/apps/web/src/composition";

export function GET() {
  return Response.json(
    {
      ok: true,
      service: "talk-to-a-document",
      mode: process.env.PROVIDER_MODE ?? "mock",
      directUpload: !!process.env.UPLOAD_BUCKET,
      contextCharacterBudget: contextBudget(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
