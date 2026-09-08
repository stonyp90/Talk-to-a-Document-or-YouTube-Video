import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Self-contained PDF/xref writer: deployment needs Node, no root npm install.
function pdfBytes(text) {
  const stream = `BT /F1 12 Tf 72 720 Td (${text.replace(/[()\\]/g, " ")}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let document = "%PDF-1.4\n";
  const offsets = [];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(document));
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(document);
  document += "xref\n0 6\n0000000000 65535 f \n";
  document += offsets.map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  document += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(document);
}

const base = process.argv[2];
assert(base && /^https?:\/\//.test(base), "An application URL is required");
const health = await fetch(new URL("/api/health", base), { signal: AbortSignal.timeout(30000) });
assert.equal(health.status, 200);
assert.equal((await health.json()).ok, true);
const page = await fetch(base, { signal: AbortSignal.timeout(30000) });
assert.equal(page.status, 200);
assert.match(page.headers.get("content-type") ?? "", /text\/html/);
const post = (path, body) => fetch(new URL(path, base), {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
});
const expectedText = `Deployment PDF proof ${randomUUID()}`;
const bytes = pdfBytes(expectedText);
const name = "deployment-smoke.pdf";
const prepared = await post("/api/uploads", { name, type: "application/pdf", size: bytes.length });
assert.equal(prepared.status, 200, "S3 upload signing failed");
const { url, fields, key } = await prepared.json();
assert.equal(typeof url, "string");
assert.match(key, /^uploads\/[a-f0-9-]{36}\.pdf$/);
assert.equal(fields.key, key);
const form = new FormData();
for (const [field, value] of Object.entries(fields)) form.append(field, String(value));
form.append("file", new Blob([bytes], { type: "application/pdf" }), name);
const uploaded = await fetch(url, { method: "POST", body: form, signal: AbortSignal.timeout(30000) });
assert.ok(uploaded.ok, `Direct S3 POST failed (${uploaded.status})`);
const extracted = await post("/api/uploads/extract", { key, name });
assert.equal(extracted.status, 200, "Stored PDF extraction failed");
const { source } = await extracted.json();
assert.deepEqual(source, { kind: "pdf", sourceName: name, text: expectedText, characters: expectedText.length });

// API maps missing uploads to 400. This checks replay rejection, not privileged
// S3 deletion or lifecycle expiry. Neither signed fields nor URLs are logged.
const replay = await post("/api/uploads/extract", { key, name });
assert.equal(replay.status, 400, "Consumed upload must not remain extractable");
const replayBody = await replay.json();
assert.equal(replayBody.source, undefined);
assert.match(replayBody.error ?? "", /upload.*again/i);
console.log("Health, HTML, direct S3 POST, exact PDF extraction, and consumed-upload replay rejection passed. Live voice remains a separate release check.");
