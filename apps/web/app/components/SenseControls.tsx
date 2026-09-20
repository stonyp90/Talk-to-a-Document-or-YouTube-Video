"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { VoiceActions, type VoiceActionsProps } from "./VoiceActions";
import { MotionActions, type MotionActionsProps } from "./MotionActions";
import { useLanguage } from "../i18n/LanguageProvider";
import type {
  SenseActivity,
  SenseChannelActivity,
  SenseChannelControl,
} from "./senseControlTypes";
import styles from "./SenseControls.module.css";

export type { SenseActivity } from "./senseControlTypes";

type ManagedChannelProps =
  "presentation" | "controlRef" | "onActivityChange" | "feedbackTarget";

export type SenseControlsProps = {
  voice: Omit<VoiceActionsProps, ManagedChannelProps>;
  motion: Omit<MotionActionsProps, ManagedChannelProps>;
  onActivityChange?: (activity: SenseActivity) => void;
  /** Releases any live conversation owned by the workspace. */
  onStop?: () => void;
};

const IDLE: SenseChannelActivity = { active: false, connecting: false };

/** One user gesture activates the available inputs into the same action bus. */
export function SenseControls({
  voice,
  motion,
  onActivityChange,
  onStop,
}: SenseControlsProps) {
  const { t } = useLanguage();
  const voiceControl = useRef<SenseChannelControl>(null);
  const motionControl = useRef<SenseChannelControl>(null);
  const [feedbackTarget, setFeedbackTarget] = useState<HTMLDivElement | null>(
    null,
  );
  const [speech, setSpeech] = useState(IDLE);
  const [camera, setCamera] = useState(IDLE);
  const connecting = speech.connecting || camera.connecting;
  const active =
    speech.active || camera.active || connecting || voice.voiceBusy;

  useEffect(() => {
    onActivityChange?.({
      listening: speech.active,
      motion: camera.active,
      connecting,
    });
  }, [speech.active, camera.active, connecting, onActivityChange]);

  function toggleExperience() {
    if (active) {
      voiceControl.current?.stop();
      motionControl.current?.stop();
      onStop?.();
      return;
    }
    // Both calls remain inside the explicit click, preserving browser permission
    // requirements. Each channel reports its own failure without gating the other.
    voiceControl.current?.start();
    motionControl.current?.start();
  }

  return (
    <div className={styles.experience}>
      <button
        type="button"
        className={styles.experienceControl}
        onClick={toggleExperience}
        aria-pressed={active}
        data-connecting={connecting || undefined}
      >
        <Icon name={active ? "close" : "voice"} />
        <span>{active ? t("Stop experience") : t("Start experience")}</span>
        <span className={styles.experienceSignal} aria-hidden="true" />
      </button>
      <VoiceActions
        {...voice}
        presentation="merged"
        controlRef={voiceControl}
        feedbackTarget={feedbackTarget}
        onActivityChange={setSpeech}
      />
      <MotionActions
        {...motion}
        presentation="merged"
        controlRef={motionControl}
        feedbackTarget={feedbackTarget}
        onActivityChange={setCamera}
      />
      <div className={styles.experienceFeedback} ref={setFeedbackTarget} />
    </div>
  );
}
