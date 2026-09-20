"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LivingLogo } from "./LivingLogo";
import type { CallerMood } from "@/packages/core/src/domain/voiceControls";

type Activity = "idle" | "listening" | "thinking" | "speaking" | "motion";

type Stage = {
  activity: Activity;
  mood: CallerMood;
  depth: number;
  caption: string;
  detail: string;
  holdMs: number;
};

const STAGES: Stage[] = [
  {
    activity: "idle",
    mood: "calm",
    depth: 0,
    caption: "This logo is alive.",
    detail: "It breathes. It responds. It remembers.",
    holdMs: 3500,
  },
  {
    activity: "idle",
    mood: "joyful",
    depth: 0,
    caption: "Colour is emotion.",
    detail: "Green for joy. Each feeling has its own palette.",
    holdMs: 4000,
  },
  {
    activity: "thinking",
    mood: "curious",
    depth: 0,
    caption: "Size is thought.",
    detail: "It grows when thinking deeply. Expands with curiosity.",
    holdMs: 4000,
  },
  {
    activity: "listening",
    mood: "calm",
    depth: 0,
    caption: "Pulse is listening.",
    detail: "When it pulses, it is hearing you.",
    holdMs: 3500,
  },
  {
    activity: "speaking",
    mood: "urgent",
    depth: 0,
    caption: "Energy is urgency.",
    detail: "Fast waves mean it has something important to say.",
    holdMs: 3500,
  },
  {
    activity: "idle",
    mood: "calm",
    depth: 8,
    caption: "Every conversation shapes it.",
    detail: "Over time, it grows with you. A living record of your dialogue.",
    holdMs: 4500,
  },
];

const STORAGE_KEY = "ursly-logo-onboarding-v2";

export function LogoOnboarding({
  replay = false,
  onReplayDone,
}: {
  replay?: boolean;
  onReplayDone?: () => void;
}) {
  const [stage, setStage] = useState(0);
  const [visible, setVisible] = useState(false);
  const [fadingCaption, setFadingCaption] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const shouldShow = useCallback(() => {
    if (replay) return true;
    try {
      return !sessionStorage.getItem(STORAGE_KEY);
    } catch {
      return true;
    }
  }, [replay]);

  useEffect(() => {
    if (!shouldShow()) return;

    const enterTimer = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(enterTimer);
  }, [shouldShow]);

  const advanceStage = useCallback(() => {
    setFadingCaption(true);
    timerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setStage((prev) => {
        const next = prev + 1;
        if (next >= STAGES.length) {
          setVisible(false);
          if (!replay) {
            try {
              sessionStorage.setItem(STORAGE_KEY, "1");
            } catch {
              // Storage may be blocked
            }
          }
          if (onReplayDone) onReplayDone();
          return prev;
        }
        setFadingCaption(false);
        return next;
      });
    }, 400);
  }, [replay, onReplayDone]);

  useEffect(() => {
    if (!visible) return;
    const current = STAGES[stage];
    if (!current) return;

    timerRef.current = setTimeout(advanceStage, current.holdMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, stage, advanceStage]);

  const skip = useCallback(() => {
    setVisible(false);
    if (!replay) {
      try {
        sessionStorage.setItem(STORAGE_KEY, "1");
      } catch {
        // Storage may be blocked
      }
    }
    if (onReplayDone) onReplayDone();
  }, [replay, onReplayDone]);

  const goToStage = useCallback(
    (index: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setFadingCaption(false);
      setStage(index);
    },
    [],
  );

  if (!visible && stage === 0) return null;
  if (!visible && stage >= STAGES.length - 1) return null;

  const current = STAGES[stage];
  if (!current) return null;

  return (
    <div
      className="onboarding-overlay"
      data-visible={visible}
      role="dialog"
      aria-label="Logo onboarding"
    >
      <div className="onboarding-backdrop" />
      <div className="onboarding-content">
        <div className="onboarding-logo-stage">
          <LivingLogo
            activity={current.activity}
            mood={current.mood}
            conversationDepth={current.depth}
          />
        </div>

        <div className="onboarding-text" data-fading={fadingCaption}>
          <p className="onboarding-caption">{current.caption}</p>
          <p className="onboarding-detail">{current.detail}</p>
        </div>

        <div className="onboarding-dots">
          {STAGES.map((_, i) => (
            <button
              key={i}
              className={`onboarding-dot${i === stage ? " active" : ""}`}
              onClick={() => goToStage(i)}
              aria-label={`Stage ${i + 1}`}
            />
          ))}
        </div>

        <button className="onboarding-skip" onClick={skip} type="button">
          {replay ? "Close" : "Skip"}
        </button>
      </div>
    </div>
  );
}
