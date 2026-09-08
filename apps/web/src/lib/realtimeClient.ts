import type { ConversationMessage } from "@/packages/core/src/domain/conversation";
import type { IngestedSource } from "@/packages/core/src/domain/ingestion";

type EventHandler = (event: {
  type:
    | "connected"
    | "reconnecting"
    | "ended"
    | "error"
    | "message-started"
    | "message-delta"
    | "message-completed";
  message?: ConversationMessage;
  id?: string;
  text?: string;
  error?: string;
}) => void;

export class RealtimeClient {
  private peer?: RTCPeerConnection;
  private dataChannel?: RTCDataChannel;
  private microphone?: MediaStream;
  private output?: HTMLAudioElement;
  private readonly mock: boolean;
  private active = false;
  private generation = 0;
  private abort?: AbortController;
  private status?: string;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private recoveryTimer?: ReturnType<typeof setTimeout>;
  private messages = new Map<
    string,
    { role: "user" | "assistant"; complete: boolean }
  >();

  constructor(
    private readonly source: IngestedSource,
    private readonly onEvent: EventHandler,
    mode: "mock" | "live",
    private readonly secret?: string,
  ) {
    this.mock = mode === "mock";
  }

  async connect(): Promise<void> {
    if (this.active) return;
    this.active = true;
    const generation = ++this.generation;
    const current = () => this.active && this.generation === generation;
    this.messages.clear();
    if (this.mock) {
      this.schedule(() => this.connectionStatus("connected"), 180);
      return;
    }
    this.schedule(() => {
      if (this.status !== "connected" && this.status !== "reconnecting")
        this.fail(
          "Voice connection timed out. Start a new session or use text chat.",
        );
    }, 30000);
    try {
      if (!this.secret)
        throw new Error("A short-lived session secret is required.");
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("Microphone access is unavailable in this browser.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!current()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.microphone = stream;
      this.peer = new RTCPeerConnection();
      this.output = document.createElement("audio");
      this.output.autoplay = true;
      this.peer.ontrack = (event) => {
        if (current() && this.output) {
          this.output.srcObject =
            event.streams[0] ?? new MediaStream([event.track]);
          void this.output.play().catch(() => {
            if (current())
              this.fail("Audio playback was blocked. Restart voice chat.");
          });
        }
      };
      this.microphone
        .getTracks()
        .forEach((track) =>
          this.peer?.addTrack(track, this.microphone as MediaStream),
        );
      this.dataChannel = this.peer.createDataChannel("oai-events");
      const peer = this.peer;
      const channel = this.dataChannel;
      const update = () => {
        if (!current()) return;
        if (peer.connectionState === "failed")
          this.fail("Voice connection failed. Start a new session.");
        else if (peer.connectionState === "closed") this.stop();
        else if (peer.connectionState === "disconnected") {
          this.connectionStatus("reconnecting");
          this.recoveryTimer ??= setTimeout(() => {
            if (current())
              this.fail(
                "Voice connection could not recover. Start a new session.",
              );
          }, 15000);
        } else if (
          peer.connectionState === "connected" &&
          channel.readyState === "open"
        ) {
          clearTimeout(this.recoveryTimer);
          this.recoveryTimer = undefined;
          this.connectionStatus("connected");
        }
      };
      peer.onconnectionstatechange = update;
      channel.onopen = update;
      channel.onclose = channel.onerror = () => {
        if (current())
          this.fail("Voice data connection failed. Start a new session.");
      };
      channel.onmessage = (event) => {
        if (!current()) return;
        let parsed: unknown;
        try {
          parsed = JSON.parse(event.data as string);
        } catch {
          return;
        }
        if (parsed && typeof parsed === "object")
          this.handleServerEvent(parsed as Record<string, unknown>);
      };
      const offer = await peer.createOffer();
      if (!current()) return;
      await peer.setLocalDescription(offer);
      if (!current()) return;
      this.abort = new AbortController();
      const response = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp",
          Authorization: `Bearer ${this.secret}`,
        },
        body: offer.sdp,
        signal: this.abort.signal,
      });
      if (!current()) return;
      if (!response.ok)
        throw new Error("Realtime connection failed. Start a new session.");
      const sdp = await response.text();
      if (!current()) return;
      await peer.setRemoteDescription({ type: "answer", sdp });
    } catch (error) {
      if (!current()) return;
      const message =
        error instanceof Error && error.name === "NotAllowedError"
          ? "Microphone permission denied. Enable microphone access or use text chat."
          : error instanceof Error
            ? error.message.replaceAll(this.secret ?? "\u0000", "[redacted]")
            : "Realtime connection failed.";
      this.fail(message);
      throw new Error(message);
    }
  }

  sendText(text: string): void {
    if (!this.active) throw new Error("Voice chat is not connected.");
    if (!text.trim()) return;
    if (this.mock) {
      const userId = crypto.randomUUID();
      const assistantId = crypto.randomUUID();
      this.onEvent({
        type: "message-started",
        message: { id: userId, role: "user", text, status: "complete" },
      });
      this.onEvent({
        type: "message-started",
        message: {
          id: assistantId,
          role: "assistant",
          text: "",
          status: "partial",
        },
      });
      this.schedule(
        () =>
          this.onEvent({
            type: "message-delta",
            id: assistantId,
            text: `Local voice answer based on ${this.source.sourceName}: ${this.source.text.slice(0, 160)}`,
          }),
        220,
      );
      this.schedule(
        () => this.onEvent({ type: "message-completed", id: assistantId }),
        280,
      );
      return;
    }
    if (!this.dataChannel || this.dataChannel.readyState !== "open")
      throw new Error("Voice chat is not connected.");
    const id = crypto.randomUUID();
    this.dataChannel.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          id,
          type: "message",
          role: "user",
          content: [{ type: "input_text", text }],
        },
      }),
    );
    this.startMessage(id, "user", text, true);
    this.dataChannel.send(
      JSON.stringify({
        type: "response.create",
        response: { output_modalities: ["audio"] },
      }),
    );
  }

  setMuted(muted: boolean): void {
    this.microphone?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  stop(): void {
    if (!this.active) return;
    this.cleanup();
    this.onEvent({ type: "ended" });
  }

  private cleanup(): void {
    this.active = false;
    ++this.generation;
    this.status = undefined;
    this.abort?.abort();
    this.abort = undefined;
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    clearTimeout(this.recoveryTimer);
    this.recoveryTimer = undefined;
    this.microphone?.getTracks().forEach((track) => track.stop());
    this.microphone = undefined;
    if (this.dataChannel)
      this.dataChannel.onmessage =
        this.dataChannel.onopen =
        this.dataChannel.onclose =
        this.dataChannel.onerror =
          null;
    this.dataChannel?.close();
    this.dataChannel = undefined;
    if (this.peer) this.peer.ontrack = this.peer.onconnectionstatechange = null;
    this.peer?.close();
    this.peer = undefined;
    if (this.output) {
      this.output.pause();
      this.output.srcObject = null;
      this.output.remove();
      this.output = undefined;
    }
  }

  private fail(error: string): void {
    this.cleanup();
    this.onEvent({ type: "error", error });
  }

  private schedule(callback: () => void, delay: number): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (this.active) callback();
    }, delay);
    this.timers.add(timer);
  }

  private connectionStatus(type: "connected" | "reconnecting"): void {
    if (this.status !== type) {
      this.status = type;
      this.onEvent({ type });
    }
  }

  private startMessage(
    id: string,
    role: "user" | "assistant",
    text = "",
    complete = false,
  ): void {
    if (this.messages.has(id)) return;
    this.messages.set(id, { role, complete });
    this.onEvent({
      type: "message-started",
      message: { id, role, text, status: complete ? "complete" : "partial" },
    });
  }

  private completeMessage(id: string, text?: string): void {
    const message = this.messages.get(id);
    if (!message || message.complete) return;
    message.complete = true;
    this.onEvent({
      type: "message-completed",
      id,
      ...(text === undefined ? {} : { text }),
    });
  }

  private handleServerEvent(event: Record<string, unknown>): void {
    const type = event.type;
    if (
      type === "response.output_item.added" ||
      type === "response.output_item.created"
    ) {
      const item = event.item as
        | { id?: string; type?: string; role?: string }
        | undefined;
      if (item?.type === "message" && item.role === "assistant" && item.id)
        this.startMessage(item.id, "assistant");
    }
    const input =
      typeof type === "string" &&
      type.startsWith("conversation.item.input_audio_transcription.");
    const output =
      typeof type === "string" &&
      (type.startsWith("response.output_audio_transcript.") ||
        type.startsWith("response.output_text."));
    const id = typeof event.item_id === "string" ? event.item_id : undefined;
    if (
      id &&
      (input || output) &&
      typeof type === "string" &&
      (type.endsWith(".delta") ||
        type.endsWith(".done") ||
        type.endsWith(".completed"))
    ) {
      this.startMessage(id, input ? "user" : "assistant");
      if (type.endsWith(".delta")) {
        if (!this.messages.get(id)?.complete && typeof event.delta === "string")
          this.onEvent({ type: "message-delta", id, text: event.delta });
      } else
        this.completeMessage(
          id,
          typeof event.transcript === "string"
            ? event.transcript
            : typeof event.text === "string"
              ? event.text
              : undefined,
        );
    }
    if (type === "input_audio_buffer.speech_started") {
      // WebRTC VAD cancels and truncates audio server-side; finish local captions.
      for (const [itemId, message] of this.messages)
        if (message.role === "assistant" && !message.complete)
          this.completeMessage(itemId);
    }
    if (type === "response.done") {
      const response = event.response as
        | { output?: { id?: string }[]; status?: string }
        | undefined;
      for (const item of response?.output ?? [])
        if (item.id) this.completeMessage(item.id);
      if (response?.status === "failed")
        this.fail("Voice response failed. Start a new session.");
    }
    if (
      type === "error" ||
      type === "conversation.item.input_audio_transcription.failed"
    )
      this.fail(
        "Realtime processing failed. Start a new session or use text chat.",
      );
  }
}
