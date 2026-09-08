import assert from 'node:assert/strict';
import { ApiClient } from '../../apps/mobile/src/client';

// Exercises the actual running Compose API; never requires provider secrets.
const api = new ApiClient(process.env.MOBILE_API_URL || 'http://localhost:3000');
async function main() {
  const source = await api.youtube('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(source.kind, 'youtube');
  assert.ok(source.text.length > 0);
  const answer = await api.ask(source, 'What is this source about?');
  assert.ok(answer.length > 0);
  const session = await api.session(source);
  assert.equal(session.mode, 'mock', 'Run this smoke check against PROVIDER_MODE=mock');
  await assert.rejects(() => api.youtube('https://example.org/not-youtube'));
  console.log('PASS: native API adapter → Compose ingestion, text answer, mock session, invalid URL');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
