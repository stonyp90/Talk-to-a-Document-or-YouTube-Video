import assert from 'node:assert/strict';

// Run against the exact EXPO_PUBLIC_API_URL embedded in the distributed app.
// This exercises real model requests; it never certifies microphone/audio or
// physical-device behavior. No credentials belong in the URL or in this script.
const origin = process.argv[2];
try {
  const url = new URL(origin);
  assert(url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash,
    'Supply a public HTTPS API origin without credentials.');
  assert(!/^(localhost|127\.|0\.|\[::1\])/.test(url.hostname), 'A local server is not production.');
  const request = async (path, body) => {
    const response = await fetch(new URL(path, url), {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(45000),
    });
    assert(response.ok, `${path}: HTTP ${response.status}`);
    return response.json();
  };
  const health = await request('/api/health');
  assert.equal(health.ok, true, 'Health check must be healthy.');
  assert.equal(health.service, 'talk-to-a-document', 'Unexpected backend service.');
  assert.equal(health.mode, 'live', 'Mock responses do not validate production.');
  assert.equal(health.directUpload, true, 'Production PDF uploads require object storage.');
  console.log('PASS: public HTTPS, expected backend, live mode and direct uploads configured.');
  const text = 'Ursly release verification: the sample color is green.';
  const source = { kind: 'pdf', sourceName: 'release-check.txt', text, characters: text.length };
  const chat = await request('/api/text-chat', { source, question: 'What is the sample color? Answer in English.' });
  assert.equal(typeof chat.answer, 'string');
  assert.match(chat.answer, /green/i, 'The answer must use the supplied source.');
  assert.doesNotMatch(chat.answer, /local demo response/i, 'Demo answers are not production evidence.');
  const session = await request('/api/realtime/session', source);
  assert.equal(session.mode, 'live', 'Voice must not silently use mock mode.');
  console.log('PASS: live text answer and voice session endpoint.');
  console.log('Still required: PDF upload/extraction smoke, live YouTube captions, native audio and real-phone Wi-Fi/cellular tests.');
} catch (error) {
  console.error(`FAIL: ${error instanceof Error ? error.message : 'Production verification failed'}`);
  if (error?.cause?.code) console.error(`Network: ${error.cause.code}`);
  process.exitCode = 1;
}
