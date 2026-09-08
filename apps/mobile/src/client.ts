import type { IngestedSource } from '../../../src/domain/ingestion';
export type { IngestedSource };
export type Turn = { id: string; role: 'user' | 'assistant'; text: string };
export type Session = { mode: 'mock' | 'live' };
export type Asset = { name: string; size?: number; uri: string; mimeType?: string };

export function apiOrigin(_platform: string, override?: string) {
  // Android uses adb reverse for both API and MinIO. Keep signed URLs intact.
  return (override || 'http://localhost:3000').replace(/\/$/, '');
}
export function validateAsset(asset: Pick<Asset, 'name' | 'size' | 'mimeType'>) {
  if (!asset.name.toLowerCase().endsWith('.pdf') || (asset.mimeType && asset.mimeType !== 'application/pdf')) throw new Error('Please select a PDF.');
  if (asset.size === undefined || asset.size <= 0) throw new Error('Cannot verify this file size. Choose a downloaded PDF.');
  if (asset.size > 25 * 1024 * 1024) throw new Error('PDF files must be 25 MB or smaller.');
}
export function updateTranscript(turns: Turn[], event: Record<string, unknown>): Turn[] {
  const type = String(event.type);
  const user = type === 'conversation.item.input_audio_transcription.completed';
  const delta = /response\.(output_audio_transcript|audio_transcript|output_text)\.delta/.test(type);
  const done = /response\.(output_audio_transcript|audio_transcript|output_text)\.done/.test(type);
  if (!user && !delta && !done) return turns;
  const id = String(event.item_id ?? event.response_id ?? 'assistant');
  const previous = turns.find(turn => turn.id === id);
  const text = delta ? (previous?.text ?? '') + String(event.delta ?? '') : String(event.transcript ?? event.text ?? previous?.text ?? '');
  const turn: Turn = { id, role: user ? 'user' : 'assistant', text };
  return previous ? turns.map(item => item.id === id ? turn : item) : [...turns, turn];
}
export class ApiClient {
  constructor(readonly origin: string, private transport: typeof fetch = fetch) {}
  async request(path: string, init: RequestInit) {
    return this.requestUrl(this.origin + path, init);
  }
  private async requestUrl(url: string, init: RequestInit, timeoutMs = 45000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await this.transport(url, { ...init, signal: controller.signal });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || `Request failed (${response.status}). Please retry.`);
      }
      return response;
    } finally { clearTimeout(timeout); }
  }
  async youtube(url: string): Promise<IngestedSource> {
    const body = new FormData(); body.append('url', url.trim());
    const response = await this.request('/api/ingest', { method: 'POST', body });
    return (await response.json()).source;
  }
  async pdf(asset: Asset): Promise<IngestedSource> {
    validateAsset(asset);
    const health = await (await this.request('/api/health', { method: 'GET' })).json() as { directUpload?: boolean };
    const body = new FormData();
    if (health.directUpload) {
      const upload = await this.json('/api/uploads', { name: asset.name, type: 'application/pdf', size: asset.size }) as { url: string; fields: Record<string, string>; key: string };
      Object.entries(upload.fields).forEach(([key, value]) => body.append(key, value));
      // S3 requires the file part last. Do not set multipart Content-Type: the
      // native networking layer supplies the correct boundary for its URI part.
      body.append('file', { uri: asset.uri, name: asset.name, type: 'application/pdf' } as unknown as Blob);
      // Never rewrite a presigned hostname, query or field on the client.
      await this.requestUrl(upload.url, { method: 'POST', body }, 120000);
      return (await this.json('/api/uploads/extract', { key: upload.key, name: asset.name })).source;
    }
    // React Native's FormData accepts file URI objects; DOM typings accept Blob only.
    body.append('file', { uri: asset.uri, name: asset.name, type: 'application/pdf' } as unknown as Blob);
    return (await (await this.request('/api/ingest', { method: 'POST', body })).json()).source;
  }
  async json(path: string, body: unknown) {
    return (await this.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
  }
  async session(source: IngestedSource): Promise<Session> { return this.json('/api/realtime/session', source); }
  async ask(source: IngestedSource, question: string): Promise<string> {
    return (await this.json('/api/text-chat', { source, question })).answer;
  }
  async negotiate(source: IngestedSource, sdp: string): Promise<string> {
    return (await this.request('/api/realtime/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source, sdp }) })).text();
  }
}
