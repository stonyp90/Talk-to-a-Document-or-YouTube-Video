import type { RTCPeerConnection, MediaStream } from 'react-native-webrtc';
import { ApiClient, IngestedSource } from './client';

export type VoiceStatus = 'connecting' | 'connected' | 'reconnecting' | 'ended' | 'error';
export class NativeVoice {
  private peer?: RTCPeerConnection;
  private stream?: MediaStream;
  private stopped = false;
  private timer?: ReturnType<typeof setTimeout>;
  private channel?: ReturnType<RTCPeerConnection['createDataChannel']>;
  constructor(private api: ApiClient, private source: IngestedSource,
    private status: (status: VoiceStatus) => void,
    private event: (event: Record<string, unknown>) => void,
    private error: (message: string) => void) {}

  async start() {
    this.status('connecting');
    try {
      const session = await this.api.session(this.source);
      if (this.stopped) return;
      if (session.mode === 'mock') {
        this.status('connected');
        this.event({ type: 'mock.ready' });
        return;
      }
      const native = await import('react-native-webrtc');
      if (this.stopped) return;
      const stream = await native.mediaDevices.getUserMedia({ audio: true, video: false });
      if (this.stopped) { stream.getTracks().forEach(track => track.stop()); return; }
      this.stream = stream;
      const peer = this.peer = new native.RTCPeerConnection({});
      stream.getTracks().forEach(track => peer.addTrack(track, stream));
      // Native WebRTC plays received audio through its native audio session.
      const channel = this.channel = peer.createDataChannel('oai-events');
      channel.onopen = () => { if (!this.stopped) { clearTimeout(this.timer); this.status('connected'); } };
      channel.onmessage = (message: { data: unknown }) => {
        if (this.stopped) return;
        try {
          const event = JSON.parse(String(message.data));
          if (event.type === 'error') this.error(event.error?.message || 'Voice service error.');
          this.event(event);
        } catch { this.error('An unreadable voice event was received.'); }
      };
      peer.onconnectionstatechange = () => {
        if (this.stopped) return;
        if (peer.connectionState === 'disconnected') {
          this.status('reconnecting');
          clearTimeout(this.timer);
          this.timer = setTimeout(() => this.fail('Connection lost. Retry voice or continue in text.'), 15000);
        }
        if (peer.connectionState === 'connected') { clearTimeout(this.timer); this.status('connected'); }
        if (peer.connectionState === 'failed') this.fail('Voice connection failed. Retry or use text chat.');
      };
      this.timer = setTimeout(() => this.fail('Voice connection timed out. Try again or use text chat.'), 30000);
      const offer = await peer.createOffer({});
      if (this.stopped) return;
      await peer.setLocalDescription(offer);
      if (this.stopped) return;
      const answer = await this.api.negotiate(this.source, offer.sdp!);
      if (this.stopped) return;
      await peer.setRemoteDescription(new native.RTCSessionDescription({ type: 'answer', sdp: answer }));
    } catch (error) {
      if (!this.stopped) this.fail(error instanceof Error ? error.message : 'Microphone unavailable. Use text chat.');
    }
  }
  setMuted(muted: boolean) { this.stream?.getAudioTracks().forEach(track => { track.enabled = !muted; }); }
  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.channel?.close();
    this.stream?.getTracks().forEach(track => track.stop());
    this.peer?.close();
    this.status('ended');
  }
  private fail(message: string) { this.stop(); this.status('error'); this.error(message); }
}
