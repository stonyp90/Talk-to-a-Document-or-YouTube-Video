import type { SpeechListener, SpeechListenerOptions } from "./speech";

/** Live commands use the same microphone transport as the source conversation. */
export function createRealtimeSpeechListener(
  options: SpeechListenerOptions,
): SpeechListener {
  let language = options.language;
  let wanted = false;
  let generation = 0;
  let peer: RTCPeerConnection | undefined;
  let microphone: MediaStream | undefined;
  let abort: AbortController | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let quiet: ReturnType<typeof setTimeout> | undefined;

  function stop() {
    const active = wanted;
    wanted = false;
    generation++;
    clearTimeout(deadline);
    clearTimeout(quiet);
    abort?.abort();
    abort = undefined;
    peer?.close();
    peer = undefined;
    microphone?.getTracks().forEach((track) => track.stop());
    microphone = undefined;
    if (active) options.onListeningChange?.(false);
    if (active) options.onConnectingChange?.(false);
  }
  function fail(error?: unknown) {
    stop();
    options.onError?.(
      error instanceof Error && error.name === "NotAllowedError"
        ? "denied"
        : "failed",
    );
  }
  function activity() {
    clearTimeout(quiet);
    quiet = setTimeout(stop, options.quietLimitMs ?? 120000);
  }
  function start() {
    if (wanted) return;
    wanted = true;
    options.onConnectingChange?.(true);
    const epoch = ++generation;
    const current = () => wanted && epoch === generation;
    const controller = new AbortController();
    abort = controller;
    deadline = setTimeout(() => {
      if (current()) fail();
    }, 20000);
    void (async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (!current()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      microphone = stream;
      const credentialResponse = await fetch("/api/speech/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: language.startsWith("fr") ? "fr" : "en",
        }),
        signal: controller.signal,
      });
      if (!credentialResponse.ok) throw new Error("Speech session unavailable");
      const credential = (await credentialResponse.json()) as {
        clientSecret: string;
        expiresAt: number;
      };
      if (!current()) return;
      if (!credential.clientSecret || credential.expiresAt <= Date.now())
        throw new Error("Speech session expired");
      const connection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      peer = connection;
      for (const track of stream.getTracks())
        connection.addTrack(track, stream);
      const channel = connection.createDataChannel("speech-commands");
      const queue: string[] = [];
      const pending = new Map<string, string>();
      const partials = new Map<string, string>();
      const delivered = new Set<string>();
      channel.onopen = () => {
        if (!current()) return;
        clearTimeout(deadline);
        options.onConnectingChange?.(false);
        options.onListeningChange?.(true);
        activity();
      };
      channel.onmessage = (event) => {
        if (!current()) return;
        try {
          const data = JSON.parse(event.data);
          const id = data.item_id as string;
          if (
            data.type === "error" ||
            data.type === "conversation.item.input_audio_transcription.failed"
          ) {
            fail();
            return;
          }
          if (data.type === "input_audio_buffer.speech_started") activity();
          if (
            data.type === "input_audio_buffer.committed" &&
            id &&
            !queue.includes(id) &&
            !delivered.has(id)
          )
            queue.push(id);
          if (
            data.type === "conversation.item.input_audio_transcription.delta" &&
            id &&
            typeof data.delta === "string" &&
            !delivered.has(id)
          ) {
            const text = (partials.get(id) ?? "") + data.delta;
            partials.set(id, text);
            options.onPhrase({ text, final: false });
            activity();
          }
          if (
            data.type ===
              "conversation.item.input_audio_transcription.completed" &&
            id &&
            typeof data.transcript === "string" &&
            !delivered.has(id)
          ) {
            if (!queue.includes(id)) queue.push(id);
            pending.set(id, data.transcript);
            while (queue.length && pending.has(queue[0])) {
              const next = queue.shift()!;
              const text = pending.get(next)!.trim();
              pending.delete(next);
              partials.delete(next);
              delivered.add(next);
              if (text) options.onPhrase({ text, final: true });
              if (!current()) return;
            }
            activity();
          }
        } catch {
          fail();
        }
      };
      channel.onerror = () => {
        if (current()) fail();
      };
      channel.onclose = () => {
        if (current()) fail();
      };
      connection.onconnectionstatechange = () => {
        if (
          current() &&
          ["failed", "disconnected", "closed"].includes(
            connection.connectionState,
          )
        )
          fail();
      };
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      const response = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credential.clientSecret}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Speech connection failed");
      const sdp = await response.text();
      if (current())
        await connection.setRemoteDescription({ type: "answer", sdp });
    })().catch((error) => {
      if (current()) fail(error);
    });
  }
  return {
    start,
    stop,
    listening: () => wanted,
    setLanguage(next) {
      if (next === language) return;
      language = next;
      if (wanted) {
        stop();
        start();
      }
    },
  };
}
