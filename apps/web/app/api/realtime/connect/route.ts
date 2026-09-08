// Retired: clients negotiate directly using the short-lived session credential.
// Never forward anonymous SDP with the permanent server API key.
export async function POST() {
  return Response.json(
    { error: "Use a short-lived Realtime client credential." },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
