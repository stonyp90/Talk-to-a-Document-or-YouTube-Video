import {
  commandSpeechEnabled,
  contextBudget,
} from "@/apps/web/src/composition";

export function GET() {
  return Response.json(
    {
      ok: true,
      service: "talk-to-a-document",
      mode: process.env.PROVIDER_MODE ?? "mock",
      directUpload: !!process.env.UPLOAD_BUCKET,
      contextCharacterBudget: contextBudget(),
      commandSpeech: commandSpeechEnabled() ? "realtime" : "browser",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
