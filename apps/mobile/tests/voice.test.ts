import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NativeVoice } from '../src/voice';
import { ApiClient } from '../src/client';
const source = { kind: 'pdf' as const, sourceName: 'test.pdf', text: 'Context', characters: 7 };
test('mock voice starts and stops without requesting the native microphone', async () => {
  const statuses: string[] = [], events: string[] = [];
  const api = new ApiClient('http://localhost', async () => new Response(JSON.stringify({ mode: 'mock' })));
  const voice = new NativeVoice(api, source, state => statuses.push(state), event => events.push(String(event.type)), assert.fail);
  await voice.start(); voice.stop();
  assert.deepEqual(statuses, ['connecting', 'connected', 'ended']);
  assert.deepEqual(events, ['mock.ready']);
});
test('stopping during session setup never reconnects after the request resolves', async () => {
  let resolve!: (response: Response) => void;
  const statuses: string[] = [];
  const api = new ApiClient('http://localhost', () => new Promise(done => { resolve = done; }));
  const voice = new NativeVoice(api, source, state => statuses.push(state), () => assert.fail('Unexpected event'), assert.fail);
  const starting = voice.start(); voice.stop();
  resolve(new Response(JSON.stringify({ mode: 'mock' })));
  await starting;
  assert.deepEqual(statuses, ['connecting', 'ended']);
});
test('backend session failure leaves an actionable error and no connected state', async () => {
  const errors: string[] = [], statuses: string[] = [];
  const api = new ApiClient('http://localhost', async () => new Response(JSON.stringify({ error: 'Service unavailable' }), { status: 503 }));
  const voice = new NativeVoice(api, source, state => statuses.push(state), () => assert.fail('Unexpected event'), error => errors.push(error));
  await voice.start();
  assert.equal(statuses.at(-1), 'error');
  assert.ok(!statuses.includes('connected'));
  assert.deepEqual(errors, ['Service unavailable']);
});
