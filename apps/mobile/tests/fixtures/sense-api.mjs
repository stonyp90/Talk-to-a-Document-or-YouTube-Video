// Deterministic local-only API for the Simulator smoke flow. No provider calls.
// Run with: node tests/fixtures/sense-api.mjs
import { createServer } from "node:http";

const port = Number(process.env.SENSE_QA_API_PORT || 3099);
const account = { email: "sense-qa@example.test" };
const requests = [];
const sourceText =
  "Short breaks help people restore attention and return to focused work.";
const server = createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString();
  const path = new URL(request.url, `http://127.0.0.1:${port}`).pathname;
  if (path !== "/__requests") requests.push({ method: request.method, path });
  const json = (value, status = 200) => {
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(value));
  };
  if (path === "/__requests") return json(requests);
  if (path === "/api/health")
    return json({ mode: "mock", directUpload: false });
  if (path === "/api/auth/request-code") return json({ ok: true });
  if (path === "/api/auth/confirm") {
    const credentials = JSON.parse(body);
    if (credentials.email !== account.email || credentials.code !== "123456")
      return json(
        { error: "Use the local QA identity and fixture code." },
        400,
      );
    return json({ ...account, token: "local-sense-qa-fixture" });
  }
  if (path === "/api/auth/session") return json(account);
  if (path === "/api/ingest")
    return json({
      source: {
        kind: "youtube",
        sourceName: "Sense QA video",
        text: sourceText,
        characters: sourceText.length,
      },
    });
  if (path === "/api/text-chat") {
    const { question } = JSON.parse(body);
    return json({
      answer: `Simulated answer: ${question} Short breaks restore attention and support focused work.`,
    });
  }
  if (path === "/api/session") return json({ mode: "mock" });
  return json({ error: `No QA fixture for ${request.method} ${path}` }, 404);
});
server.listen(port, "127.0.0.1", () => {
  console.log(`Sense QA API listening on http://127.0.0.1:${port}`);
});
