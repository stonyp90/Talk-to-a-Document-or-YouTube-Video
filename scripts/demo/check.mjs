import { spawnSync } from "node:child_process";

const base = new URL(process.argv[2] || "http://localhost:3100");
if (
  !["http:", "https:"].includes(base.protocol) ||
  base.username ||
  base.password
) {
  throw new Error("Use an HTTP(S) application origin without credentials.");
}
const results = [];
async function check(name, action) {
  try {
    await action();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, reason: error.message });
  }
}
async function json(path, body) {
  const response = await fetch(new URL(path, base), {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });
  // Do not print provider bodies or ephemeral credentials.
  if (!response.ok)
    throw new Error(
      `HTTP ${response.status}; inspect server configuration and provider access.`,
    );
  return response.json();
}
let live = false;
await check("Live AI enabled", async () => {
  const health = await json("/api/health");
  if (!health.ok || health.mode !== "live")
    throw new Error(
      "Backend is not in live mode. Configure OPENAI_API_KEY and PROVIDER_MODE=live.",
    );
  live = true;
});
if (live) {
  await check("Real PDF upload, extraction and replay protection", async () => {
    const result = spawnSync(
      process.execPath,
      ["infrastructure/scripts/smoke.mjs", base.origin],
      { encoding: "utf8", timeout: 180000 },
    );
    if (result.status !== 0)
      throw new Error(
        "PDF/storage smoke check failed; run the storage smoke script separately.",
      );
  });
  const source = {
    kind: "pdf",
    sourceName: "demo-readiness.txt.pdf",
    text: "The demo observatory studies Saturn and its rings.",
    characters: 49,
  };
  source.characters = source.text.length;
  await check("Real grounded text response", async () => {
    const result = await json("/api/text-chat", {
      source,
      question:
        "Which planet does this observatory study? Reply with its name only.",
    });
    if (
      typeof result.answer !== "string" ||
      !/saturn/i.test(result.answer) ||
      /local demo response/i.test(result.answer)
    ) {
      throw new Error("A real grounded answer was not returned.");
    }
  });
  await check("Real ephemeral voice credential issued", async () => {
    const session = await json("/api/realtime/session", source);
    if (
      session.mode !== "live" ||
      typeof session.clientSecret !== "string" ||
      !session.clientSecret ||
      session.clientSecret.startsWith("mock_") ||
      !(session.expiresAt > Date.now())
    ) {
      throw new Error("No valid live ephemeral voice credential was returned.");
    }
  });
}
for (const result of results)
  console.log(
    `${result.ok ? "PASS" : "FAIL"} ${result.name}${result.reason ? `: ${result.reason}` : ""}`,
  );
console.log(
  "Not certified by this script: actual microphone/audio playback, interruption, physical devices, live YouTube and remaining provider quota. Check these before the demo.",
);
process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
