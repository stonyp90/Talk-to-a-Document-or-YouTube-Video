"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  MINIMUM_SAMPLE_SECONDS,
  PRESET_VOICE,
  canApprove,
  decideVoiceConsent,
  isDecisionPending,
  type VoiceConsent,
} from "@/packages/core/src/domain/voiceConsent";
import { Icon } from "./Icon";
import styles from "./VoiceLending.module.css";
import { useLanguage } from "../i18n/LanguageProvider";

/**
 * The microphone, reduced to the three moments the consent rules care about:
 * opening it, taking what it captured, and walking away from what it captured.
 * The component talks to this and never to a browser API, so the rules can be
 * driven by a test that has no microphone and no permission prompt.
 */
export type VoiceCapture = {
  /** Opens the microphone. Rejects when the person or the browser refuses. */
  open(): Promise<void>;
  /** Closes the microphone and hands back what it captured. */
  close(): Promise<Blob | null>;
  /** Closes the microphone and drops what it captured, unread. */
  abandon(): void;
};

/** How often the counter catches up with the microphone, in milliseconds. */
const TICK_MS = 250;

function browserVoiceCapture(): VoiceCapture {
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];

  function release() {
    for (const track of stream?.getTracks() ?? []) track.stop();
    stream = null;
    recorder = null;
  }

  return {
    async open() {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("This browser exposes no microphone.");
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.start();
    },
    async close() {
      const current = recorder;
      if (!current || current.state === "inactive") {
        release();
        return null;
      }
      const captured = await new Promise<Blob>((resolve) => {
        current.onstop = () =>
          resolve(new Blob(chunks, { type: current.mimeType || "audio/webm" }));
        current.stop();
      });
      release();
      return captured;
    },
    abandon() {
      try {
        recorder?.stop();
      } catch {
        /* The recorder may already have stopped; abandoning is idempotent. */
      }
      // The captured chunks lose their last reference here, before any of them
      // is read. Declining has to cost the speaker nothing but a press.
      chunks = [];
      release();
    },
  };
}

/**
 * Ursly answers in its own voice unless someone hands it theirs, and handing it
 * over takes two deliberate presses: one to start recording, one to keep the
 * recording. Between them a toast stays on screen saying what is happening, and
 * it stays there until it is answered — no timer decides this on anyone's
 * behalf, and nothing said out loud reaches this component.
 */
export function VoiceLending({
  capture = browserVoiceCapture,
  embedded = false,
  active = true,
}: {
  capture?: () => VoiceCapture;
  /** Keep consent inside a containing native modal instead of the body portal. */
  embedded?: boolean;
  /** Closing settings stops pending capture while preserving an approved sample. */
  active?: boolean;
}) {
  const { t } = useLanguage();
  const headingId = useId();
  const toastTitleId = useId();
  const toastBodyId = useId();
  const toastCountId = useId();
  const [consent, setConsent] = useState<VoiceConsent>(PRESET_VOICE);
  const [wasActive, setWasActive] = useState(active);
  const [notice, setNotice] = useState("");
  const recorder = useRef<VoiceCapture | null>(null);
  const captureEpoch = useRef(0);
  const activeCapture = useRef(active);
  // The approved recording itself. It is held here, in this browser, and the
  // delete control below is the only thing that lets go of it.
  const sample = useRef<Blob | null>(null);
  const toast = useRef<HTMLDivElement | null>(null);
  const listening = isDecisionPending(consent);

  // Reset the pending decision with the visibility change, before effects run.
  // A kept sample is unaffected by the domain's decline transition.
  if (wasActive !== active) {
    setWasActive(active);
    if (!active)
      setConsent((current) => decideVoiceConsent(current, { type: "decline" }));
  }

  useEffect(() => {
    if (!listening) return;
    const startedAt = Date.now();
    const tick = setInterval(
      () =>
        setConsent((current) =>
          decideVoiceConsent(current, {
            type: "recorded",
            seconds: Math.floor((Date.now() - startedAt) / 1000),
          }),
        ),
      TICK_MS,
    );
    return () => clearInterval(tick);
  }, [listening]);

  // A decision nobody can see is a decision nobody makes, so the toast takes
  // focus as it appears. It gives focus back to no one in particular: the two
  // buttons inside it are the only way out.
  useEffect(() => {
    if (listening) toast.current?.focus();
  }, [listening]);

  useEffect(() => {
    activeCapture.current = active;
    if (!active) {
      captureEpoch.current += 1;
      recorder.current?.abandon();
      recorder.current = null;
    }
    return () => {
      activeCapture.current = false;
      captureEpoch.current += 1;
      recorder.current?.abandon();
      recorder.current = null;
    };
  }, [active]);

  const lend = useCallback(async () => {
    if (!activeCapture.current) return;
    const epoch = ++captureEpoch.current;
    setNotice("");
    const opened = capture();
    try {
      await opened.open();
    } catch {
      if (!activeCapture.current || captureEpoch.current !== epoch) return;
      // The browser tells us nothing useful about a refusal, and guessing on
      // its behalf would put words in the speaker's mouth.
      setNotice(
        embedded
          ? "The microphone could not be opened. Check your browser permission and try again."
          : "Ursly could not open the microphone. Check the microphone permission in your browser and try again.",
      );
      return;
    }
    if (!activeCapture.current || captureEpoch.current !== epoch) {
      opened.abandon();
      return;
    }
    recorder.current?.abandon();
    recorder.current = opened;
    sample.current = null;
    setConsent((current) => decideVoiceConsent(current, { type: "lend" }));
  }, [capture, embedded]);

  const approve = useCallback(async () => {
    if (!activeCapture.current || !canApprove(consent)) return;
    const epoch = captureEpoch.current;
    const captured = await recorder.current?.close();
    if (!activeCapture.current || captureEpoch.current !== epoch) return;
    recorder.current = null;
    // A counter that ran for twelve seconds is not proof that twelve seconds
    // of audio exist. Saying a recording was kept when none came back would be
    // the one lie this whole feature is built to avoid.
    if (!captured) {
      sample.current = null;
      setNotice(
        embedded
          ? "No audio was captured. Nothing was kept. Record a new sample to try again."
          : "The microphone handed back no audio, so nothing was kept. Lend your voice again to try once more.",
      );
      setConsent((current) => decideVoiceConsent(current, { type: "decline" }));
      return;
    }
    sample.current = captured;
    setNotice("");
    setConsent((current) =>
      decideVoiceConsent(current, { type: "approve", sampleId: "lent-voice" }),
    );
  }, [consent, embedded]);

  const decline = useCallback(() => {
    captureEpoch.current += 1;
    recorder.current?.abandon();
    recorder.current = null;
    sample.current = null;
    setNotice("Recording discarded. Nothing was kept.");
    setConsent((current) => decideVoiceConsent(current, { type: "decline" }));
  }, []);

  const forget = useCallback(() => {
    sample.current = null;
    setNotice(
      embedded
        ? "Voice sample deleted. Answers still use the preset voice."
        : "Voice sample deleted. Ursly answers in its preset voice again.",
    );
    setConsent((current) => decideVoiceConsent(current, { type: "forget" }));
  }, [embedded]);

  const seconds = consent.stage === "preset" ? 0 : consent.seconds;
  const enough = canApprove(consent);

  const consentToast = (
    <div
      className={`voice-consent-toast${embedded ? ` ${styles.embedded}` : ""}`}
      role="alertdialog"
      ref={toast}
      tabIndex={-1}
      aria-labelledby={toastTitleId}
      aria-describedby={`${toastBodyId} ${toastCountId}`}
      onKeyDown={(event) => {
        // Escape is the one key people press to make something go away.
        // Here it can only mean the safe thing, never the keeping one.
        if (event.key === "Escape") {
          event.preventDefault();
          decline();
        }
      }}
    >
      <p className="voice-consent-title" id={toastTitleId}>
        <span className="voice-consent-dot" aria-hidden="true" />
        {t(embedded ? "Recording your voice" : "Ursly is recording your voice")}
      </p>
      <p id={toastBodyId}>
        {t(
          embedded
            ? "This recording stays in this browser and is kept only if you approve it. It is not uploaded or used to change the response voice."
            : "Ursly keeps this recording only if you approve it, so it can learn your voice. It has not been sent anywhere.",
        )}
      </p>
      {/* Counted in the unit rather than the word: at one second, every
                plural rule in every language we ship would be wrong. */}
      <p className="voice-consent-count" id={toastCountId}>
        {enough
          ? t("Recorded so far: {seconds} s. That is enough to keep.", {
              seconds,
            })
          : t(
              embedded
                ? "Recorded so far: {seconds} s. Keep talking for at least {minimum} s."
                : "Recorded so far: {seconds} s. Keep talking — Ursly needs at least {minimum} s.",
              { seconds, minimum: MINIMUM_SAMPLE_SECONDS },
            )}
      </p>
      <div className="voice-consent-actions">
        {/* A sample still too short leaves this button in the tab order
                  rather than out of it: an action nobody can reach is an
                  action nobody can be told the reason for. */}
        <button
          type="button"
          className="primary"
          aria-disabled={enough ? undefined : true}
          onClick={approve}
        >
          {t("Keep the recording")}
        </button>
        <button type="button" className="secondary" onClick={decline}>
          {t("Discard it")}
        </button>
      </div>
    </div>
  );

  return (
    <section
      id="voice-lending"
      className="voice-lending"
      aria-labelledby={headingId}
      data-listening={listening}
    >
      <h3 id={headingId}>
        {t(embedded ? "Response voice" : "How Ursly answers")}
      </h3>

      {consent.stage === "kept" ? (
        <div className="voice-lending-sample">
          <p>
            {t(
              embedded
                ? "Kept {seconds} seconds in this browser while this page is open. Nothing was uploaded. Answers still use the preset voice."
                : "Ursly kept {seconds} seconds of your voice, in this browser and for as long as this page is open. Nothing was sent anywhere, and Ursly still answers in its preset voice: lending it a voice for real is a separate, deliberate step.",
              { seconds: consent.seconds },
            )}
          </p>
          <button type="button" className="danger" onClick={forget}>
            {t("Delete the recording")}
          </button>
        </div>
      ) : (
        <>
          <p>
            {t(
              embedded
                ? "Answers use a preset voice. A local sample does not change it."
                : "Ursly answers in a preset voice, and that asks nothing of you. You can lend it yours instead.",
            )}
          </p>
          <button type="button" className="primary" onClick={lend}>
            <Icon name="voice" />
            {t(embedded ? "Record a voice sample" : "Lend Ursly your voice")}
          </button>
          <p className="hint">
            {t(
              embedded
                ? "Recording starts when you press Record. You choose whether to keep it."
                : "Ursly starts recording only after you press this, and keeps the recording only if you approve it.",
            )}
          </p>
        </>
      )}

      {notice && (
        <p className="voice-lending-notice" role="status" aria-live="polite">
          {t(notice)}
        </p>
      )}

      {active &&
        listening &&
        (embedded ? consentToast : createPortal(consentToast, document.body))}
    </section>
  );
}
