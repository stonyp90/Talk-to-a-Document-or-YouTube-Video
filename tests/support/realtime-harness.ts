import type { Page } from "@playwright/test";

export interface TransportSnapshot {
  peers: number;
  closedPeers: number;
  remoteDescriptions: number;
  microphoneRequests: number;
  tracks: { enabled: boolean; stopped: boolean }[];
  sent: string[];
}

export interface RealtimeHarness {
  setConnection(state: RTCPeerConnectionState): Promise<void>;
  emit(event: Record<string, unknown>): Promise<void>;
  failChannel(): Promise<void>;
  snapshot(): Promise<TransportSnapshot>;
}

declare global {
  interface Window {
    __realtimeHarness: {
      setConnection(state: RTCPeerConnectionState): void;
      emit(event: Record<string, unknown>): void;
      failChannel(): void;
      snapshot(): TransportSnapshot;
    };
  }
}

/** Install BEFORE navigation. Fault injection only: no actual WebRTC/audio.
 * Ingestion, text chat, UI and RealtimeClient remain real. Only session issuance
 * and SDP network exchange are routed; media and peer state are controlled.
 * Reusable from Playwright or Cucumber with its existing Playwright Page.
 */
export async function installRealtimeHarness(
  page: Page,
): Promise<RealtimeHarness> {
  await page.route("**/api/realtime/session", async (route) => {
    await route.fulfill({
      json: { mode: "live", clientSecret: "transport-test-ephemeral" },
    });
  });
  await page.route(
    "https://api.openai.com/v1/realtime/calls",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/sdp",
        body: "v=0\r\ns=fault-injection-answer\r\n",
      });
    },
  );
  await page.addInitScript(() => {
    const tracks: { enabled: boolean; stopped: boolean; stop(): void }[] = [];
    const peers: Peer[] = [];
    let remoteDescriptions = 0;
    let microphoneRequests = 0;
    const sent: string[] = [];
    class Channel {
      readyState = "connecting";
      onopen: (() => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onmessage: ((event: { data: string }) => void) | null = null;
      send(data: string) {
        if (this.readyState !== "open")
          throw new Error("Injected channel is not open");
        sent.push(data);
      }
      close() {
        this.readyState = "closed";
        this.onclose?.();
      }
    }
    class Peer {
      connectionState: RTCPeerConnectionState = "new";
      onconnectionstatechange: (() => void) | null = null;
      channel = new Channel();
      closed = false;
      constructor() {
        peers.push(this);
      }
      addTrack() {}
      createDataChannel() {
        return this.channel;
      }
      async createOffer() {
        return { type: "offer", sdp: "v=0\r\ns=fault-injection-offer\r\n" };
      }
      async setLocalDescription() {}
      async setRemoteDescription() {
        remoteDescriptions++;
      }
      close() {
        this.closed = true;
        this.connectionState = "closed";
        this.onconnectionstatechange?.();
      }
    }
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          microphoneRequests++;
          const track = {
            enabled: true,
            stopped: false,
            stop() {
              this.stopped = true;
            },
          };
          tracks.push(track);
          return { getTracks: () => [track], getAudioTracks: () => [track] };
        },
      },
    });
    Object.defineProperty(window, "RTCPeerConnection", {
      configurable: true,
      value: Peer,
    });
    const latest = () => {
      const peer = peers.at(-1);
      if (!peer)
        throw new Error(
          "Start voice and wait for SDP before injecting transport events",
        );
      return peer;
    };
    window.__realtimeHarness = {
      setConnection(state) {
        const peer = latest();
        peer.connectionState = state;
        if (state === "connected") peer.channel.readyState = "open";
        peer.onconnectionstatechange?.();
        if (state === "connected") peer.channel.onopen?.();
      },
      emit(event) {
        latest().channel.onmessage?.({ data: JSON.stringify(event) });
      },
      failChannel() {
        latest().channel.onerror?.();
      },
      snapshot: () => ({
        peers: peers.length,
        closedPeers: peers.filter((p) => p.closed).length,
        remoteDescriptions,
        microphoneRequests,
        tracks: tracks.map(({ enabled, stopped }) => ({ enabled, stopped })),
        sent: [...sent],
      }),
    };
  });
  return {
    setConnection: (state) =>
      page.evaluate(
        (state) => window.__realtimeHarness.setConnection(state),
        state,
      ),
    emit: (event) =>
      page.evaluate((event) => window.__realtimeHarness.emit(event), event),
    failChannel: () =>
      page.evaluate(() => window.__realtimeHarness.failChannel()),
    snapshot: () => page.evaluate(() => window.__realtimeHarness.snapshot()),
  };
}
