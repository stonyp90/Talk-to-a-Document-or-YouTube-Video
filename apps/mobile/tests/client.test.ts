import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiOrigin, validateAsset, updateTranscript, ApiClient } from '../src/client';

test('simulators resolve the host API correctly', () => {
  assert.equal(apiOrigin('android'), 'http://localhost:3000');
  assert.equal(apiOrigin('ios'), 'http://localhost:3000');
  assert.equal(apiOrigin('ios', 'https://demo.example/'), 'https://demo.example');
});

const pdf = { name: 'test.pdf', size: 2500, uri: 'file:///cache/test.pdf', mimeType: 'application/pdf' };
const pdfSource = { kind: 'pdf', sourceName: 'test.pdf', text: 'PDF text', characters: 8 };
test('direct PDF upload preserves signed endpoint and fields then extracts by key', async () => {
  const calls: string[] = [];
  const signedUrl = 'http://localhost:9002/demo-bucket';
  const api = new ApiClient('http://localhost:3000', async (url, init) => {
    calls.push(String(url));
    if (String(url).endsWith('/health')) return Response.json({ directUpload: true });
    if (String(url).endsWith('/uploads')) {
      assert.deepEqual(JSON.parse(init!.body as string), { name: pdf.name, type: 'application/pdf', size: pdf.size });
      return Response.json({ url: signedUrl, fields: { key: 'uploads/123.pdf', policy: 'signed-policy', 'x-amz-signature': 'signature' }, key: 'uploads/123.pdf' });
    }
    if (url === signedUrl) {
      assert.deepEqual([...(init!.body as FormData).keys()], ['key', 'policy', 'x-amz-signature', 'file']);
      assert.equal((init!.body as FormData).get('policy'), 'signed-policy');
      assert.equal(init!.headers, undefined, 'Native fetch must supply its own multipart boundary');
      return new Response(null, { status: 204 });
    }
    assert.equal(url, 'http://localhost:3000/api/uploads/extract');
    assert.deepEqual(JSON.parse(init!.body as string), { key: 'uploads/123.pdf', name: pdf.name });
    return Response.json({ source: pdfSource });
  });
  assert.deepEqual(await api.pdf(pdf), pdfSource);
  assert.deepEqual(calls, ['http://localhost:3000/api/health', 'http://localhost:3000/api/uploads', signedUrl, 'http://localhost:3000/api/uploads/extract']);
});
test('failed object upload never invokes extraction or falls back to API multipart', async () => {
  const calls: string[] = [];
  const api = new ApiClient('http://localhost:3000', async url => {
    calls.push(String(url));
    if (String(url).endsWith('/health')) return Response.json({ directUpload: true });
    if (String(url).endsWith('/uploads')) return Response.json({ url: 'http://localhost:9002/bucket', fields: {}, key: 'uploads/123.pdf' });
    return new Response('<Error>Signature expired</Error>', { status: 403 });
  });
  await assert.rejects(() => api.pdf(pdf), /403/);
  assert.equal(calls.length, 3);
});
test('without object storage PDF uses multipart ingestion after checking health', async () => {
  const calls: string[] = [];
  const api = new ApiClient('http://localhost:3000', async (url, init) => {
    calls.push(String(url));
    if (String(url).endsWith('/health')) return Response.json({ directUpload: false });
    assert.equal((init!.body as FormData).has('file'), true);
    return Response.json({ source: pdfSource });
  });
  assert.deepEqual(await api.pdf(pdf), pdfSource);
  assert.deepEqual(calls, ['http://localhost:3000/api/health', 'http://localhost:3000/api/ingest']);
});
test('oversized PDF is rejected before any health or upload request', async () => {
  const api = new ApiClient('http://localhost:3000', async () => assert.fail('No network request expected'));
  await assert.rejects(() => api.pdf({ ...pdf, size: 25 * 1024 * 1024 + 1 }), /25 MB/);
});
test('PDF selection rejects oversized and unknown-size files before upload', () => {
  assert.doesNotThrow(() => validateAsset({ name: 'source.pdf', size: 25 * 1024 * 1024 }));
  assert.throws(() => validateAsset({ name: 'source.pdf', size: 25 * 1024 * 1024 + 1 }), /25 MB/);
  assert.throws(() => validateAsset({ name: 'source.pdf' }), /size/);
  assert.throws(() => validateAsset({ name: 'source.txt', size: 10 }), /PDF/);
});
test('partial audio transcript is created, accumulated and finalized without duplicates', () => {
  let turns = updateTranscript([], { type: 'response.output_audio_transcript.delta', item_id: 'a', delta: 'Hello ' });
  turns = updateTranscript(turns, { type: 'response.output_audio_transcript.delta', item_id: 'a', delta: 'there' });
  turns = updateTranscript(turns, { type: 'response.output_audio_transcript.done', item_id: 'a', transcript: 'Hello there' });
  assert.deepEqual(turns, [{ id: 'a', role: 'assistant', text: 'Hello there' }]);
  turns = updateTranscript(turns, { type: 'conversation.item.input_audio_transcription.completed', item_id: 'u', transcript: 'Question' });
  assert.equal(turns[1].role, 'user');
});
test('HTTP errors retain actionable server messages', async () => {
  const api = new ApiClient('http://localhost', async () => new Response(JSON.stringify({ error: 'Captions unavailable' }), { status: 400 }));
  await assert.rejects(() => api.youtube('https://youtu.be/abcdefghijk'), /Captions unavailable/);
});
test('text fallback sends the shared source contract to the backend', async () => {
  const source = { kind: 'pdf' as const, sourceName: 'test.pdf', text: 'Context', characters: 7 };
  const api = new ApiClient('http://localhost', async (url, init) => {
    assert.equal(url, 'http://localhost/api/text-chat');
    assert.deepEqual(JSON.parse(init!.body as string), { source, question: 'Why?' });
    return new Response(JSON.stringify({ answer: 'Because.' }));
  });
  assert.equal(await api.ask(source, 'Why?'), 'Because.');
});

 test('voice SDP uses only the ephemeral credential at the fixed provider endpoint', async () => {
  const api = new ApiClient('https://ursly.io', async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/realtime/calls');
    assert.equal(init!.method, 'POST');
    assert.equal(init!.body, 'offer-sdp');
    assert.deepEqual(init!.headers, { 'Content-Type': 'application/sdp', Authorization: 'Bearer ephemeral-test' });
    return new Response('answer-sdp');
  });
  assert.equal(await api.negotiate('offer-sdp', 'ephemeral-test'), 'answer-sdp');
});
test('voice errors cannot echo a provider credential', async () => {
  const api = new ApiClient('https://ursly.io', async () => Response.json({ error: 'credential echoed' }, { status: 401 }));
  await assert.rejects(() => api.negotiate('offer', 'ephemeral-test'), { message: 'Voice connection failed. Retry or use text chat.' });
});
test('missing voice credential fails before contacting the network', async () => {
  const api = new ApiClient('https://ursly.io', async () => assert.fail('Network must not be called'));
  await assert.rejects(() => api.negotiate('offer', ''), /Missing voice session credential/);
});
