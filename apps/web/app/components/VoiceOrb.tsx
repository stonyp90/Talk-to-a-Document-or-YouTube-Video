"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The three states the orb can be in.
 *
 * - idle:    the session is not running; a gentle breathing pulse.
 * - listening: the microphone is live; the orb reacts to audio amplitude.
 * - speaking: the assistant is talking; a different glow and colour.
 */
export type OrbState = "idle" | "listening" | "speaking";

type VoiceOrbProps = {
  /** Whether the voice session is running at all. */
  active: boolean;
  /** The microphone stream to analyse. Without one the orb stays in idle. */
  stream?: MediaStream;
  /** Override the activity reported by the realtime channel. */
  activity?: OrbState;
};

/**
 * A circular orb that visually reacts to audio.
 *
 * It reads the microphone stream through a Web Audio AnalyserNode and maps
 * the frequency amplitude to three visual channels: scale, glow intensity,
 * and a colour interpolation between the orb-primary and orb-secondary
 * design tokens. When no audio is available (or the session is not active)
 * the orb falls back to a gentle CSS breathing animation.
 *
 * The component never imports globals.css — it reads the design tokens from
 * `getComputedStyle` at run time so the same code works regardless of which
 * theme is active.
 */
export function VoiceOrb({ active, stream, activity }: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const orbRef = useRef<HTMLDivElement | null>(null);
  const rafId = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [orbState, setOrbState] = useState<OrbState>("idle");

  /* ------------------------------------------------------------------ */
  /*  Derive the visible state from the props.                          */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (!active) {
      setOrbState("idle");
      return;
    }
    if (activity && activity !== "idle") {
      setOrbState(activity);
      return;
    }
    // When active and no external activity override, default to listening.
    setOrbState(stream ? "listening" : "idle");
  }, [active, stream, activity]);

  /* ------------------------------------------------------------------ */
  /*  Web Audio wiring — connect the mic stream to an analyser.         */
  /* ------------------------------------------------------------------ */

  const teardown = useCallback(() => {
    if (rafId.current) {
      cancelAnimationFrame(rafId.current);
      rafId.current = 0;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  useEffect(() => {
    if (!active || !stream) {
      teardown();
      return;
    }

    const AudioCtx =
      globalThis.AudioContext ??
      (globalThis as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);

    audioCtxRef.current = ctx;
    analyserRef.current = analyser;

    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    const canvas = canvasRef.current;
    const orbEl = orbRef.current;

    const readToken = (name: string, fallback: string): string => {
      const root = globalThis.document?.documentElement;
      if (!root) return fallback;
      return getComputedStyle(root).getPropertyValue(name).trim() || fallback;
    };

    /**
     * Parse a hex colour string (#rrggbb) into [r, g, b].
     */
    const parseHex = (hex: string): [number, number, number] => {
      const clean = hex.replace("#", "");
      return [
        parseInt(clean.slice(0, 2), 16),
        parseInt(clean.slice(2, 4), 16),
        parseInt(clean.slice(4, 6), 16),
      ];
    };

    const draw = () => {
      analyser.getByteFrequencyData(frequencyData);

      // Average amplitude, normalised to 0-1.
      let sum = 0;
      for (let i = 0; i < frequencyData.length; i++) sum += frequencyData[i];
      const amplitude = sum / frequencyData.length / 255;

      // Visual channels driven by the amplitude.
      const scale = 1 + amplitude * 0.35;
      const glowIntensity = Math.round(amplitude * 48);

      // Interpolate between orb-primary and orb-secondary by amplitude.
      const primary = parseHex(readToken("--orb-primary", "#f47762"));
      const secondary = parseHex(readToken("--orb-secondary", "#a84332"));
      const r = Math.round(primary[0] + (secondary[0] - primary[0]) * amplitude);
      const g = Math.round(primary[1] + (secondary[1] - primary[1]) * amplitude);
      const b = Math.round(primary[2] + (secondary[2] - primary[2]) * amplitude);

      if (orbEl) {
        orbEl.style.setProperty("--orb-scale", String(scale));
        orbEl.style.setProperty("--orb-glow", `${glowIntensity}px`);
        orbEl.style.setProperty(
          "--orb-color",
          `rgb(${r}, ${g}, ${b})`,
        );
      }

      // Draw the waveform on the canvas for a richer visual.
      if (canvas) {
        const ctx2d = canvas.getContext("2d");
        if (ctx2d) {
          const { width, height } = canvas;
          ctx2d.clearRect(0, 0, width, height);

          const barCount = 48;
          const step = Math.floor(frequencyData.length / barCount);
          const barWidth = width / barCount;

          for (let i = 0; i < barCount; i++) {
            const value = frequencyData[i * step] / 255;
            const barHeight = value * height * 0.8;
            const x = i * barWidth;
            const y = (height - barHeight) / 2;

            // Gradient per bar: primary at the bottom, secondary at the top.
            const grad = ctx2d.createLinearGradient(x, y + barHeight, x, y);
            grad.addColorStop(0, `rgba(${primary[0]}, ${primary[1]}, ${primary[2]}, 0.6)`);
            grad.addColorStop(1, `rgba(${secondary[0]}, ${secondary[1]}, ${secondary[2]}, 0.9)`);
            ctx2d.fillStyle = grad;
            ctx2d.beginPath();
            ctx2d.roundRect(x + 1, y, barWidth - 2, barHeight, 2);
            ctx2d.fill();
          }
        }
      }

      rafId.current = requestAnimationFrame(draw);
    };

    rafId.current = requestAnimationFrame(draw);

    return () => {
      teardown();
    };
  }, [active, stream, teardown]);

  /* ------------------------------------------------------------------ */
  /*  Render.                                                           */
  /* ------------------------------------------------------------------ */

  const stateLabel: Record<OrbState, string> = {
    idle: "Voice idle",
    listening: "Listening",
    speaking: "Speaking",
  };

  return (
    <div
      ref={orbRef}
      className={`voice-orb voice-orb--${orbState}`}
      role="status"
      aria-label={stateLabel[orbState]}
      data-testid="voice-orb"
      style={
        {
          "--orb-scale": "1",
          "--orb-glow": "0px",
          "--orb-color": "var(--orb-primary, #f47762)",
        } as React.CSSProperties
      }
    >
      <div className="voice-orb__ring" />
      <div className="voice-orb__core" />
      <canvas
        ref={canvasRef}
        className="voice-orb__canvas"
        width={120}
        height={120}
        aria-hidden="true"
      />
      <style>{orbStyles}</style>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Styles — injected once per mount, co-located with the component.       */
/* ---------------------------------------------------------------------- */

const orbStyles = `
.voice-orb {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: scale(var(--orb-scale, 1));
  transition: transform 60ms linear;
}

.voice-orb__ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid var(--orb-color, var(--orb-primary, #f47762));
  box-shadow:
    0 0 var(--orb-glow, 0px) var(--orb-color, var(--orb-primary, #f47762)),
    0 0 calc(var(--orb-glow, 0px) * 2) color-mix(in srgb, var(--orb-color, var(--orb-primary, #f47762)) 40%, transparent),
    inset 0 0 calc(var(--orb-glow, 0px) * 0.5) color-mix(in srgb, var(--orb-color, var(--orb-primary, #f47762)) 20%, transparent);
  transition: border-color 120ms linear, box-shadow 60ms linear;
}

.voice-orb__core {
  width: 60%;
  height: 60%;
  border-radius: 50%;
  background: radial-gradient(
    circle at 40% 35%,
    color-mix(in srgb, var(--orb-color, var(--orb-primary, #f47762)) 70%, transparent),
    var(--void-deep)
  );
  transition: background 120ms linear;
}

.voice-orb__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  pointer-events: none;
  opacity: 0.6;
}

/* ---- Idle: gentle breathing pulse ---- */
.voice-orb--idle .voice-orb__ring {
  animation: voice-orb-breathe 3.2s ease-in-out infinite;
  box-shadow:
    0 0 12px color-mix(in srgb, var(--orb-primary, #f47762) 20%, transparent),
    inset 0 0 6px color-mix(in srgb, var(--orb-primary, #f47762) 10%, transparent);
}

.voice-orb--idle .voice-orb__core {
  animation: voice-orb-core-breathe 3.2s ease-in-out infinite;
}

@keyframes voice-orb-breathe {
  0%, 100% {
    transform: scale(1);
    opacity: 0.7;
  }
  50% {
    transform: scale(1.06);
    opacity: 1;
  }
}

@keyframes voice-orb-core-breathe {
  0%, 100% {
    opacity: 0.5;
  }
  50% {
    opacity: 0.8;
  }
}

/* ---- Listening: brighter, reactive ---- */
.voice-orb--listening .voice-orb__ring {
  border-color: var(--orb-color, var(--orb-primary, #f47762));
}

.voice-orb--listening .voice-orb__core {
  background: radial-gradient(
    circle at 40% 35%,
    color-mix(in srgb, var(--orb-color, var(--orb-primary, #f47762)) 85%, transparent),
    color-mix(in srgb, var(--orb-secondary, #a84332) 30%, var(--void-deep))
  );
}

/* ---- Speaking: orb-speaking glow ---- */
.voice-orb--speaking .voice-orb__ring {
  border-color: var(--orb-speaking, #ec4899);
  box-shadow:
    0 0 24px color-mix(in srgb, var(--orb-speaking, #ec4899) 40%, transparent),
    0 0 48px color-mix(in srgb, var(--orb-secondary, #a84332) 20%, transparent),
    inset 0 0 12px color-mix(in srgb, var(--orb-speaking, #ec4899) 15%, transparent);
}

.voice-orb--speaking .voice-orb__core {
  background: radial-gradient(
    circle at 40% 35%,
    color-mix(in srgb, var(--orb-speaking, #ec4899) 60%, transparent),
    color-mix(in srgb, var(--orb-secondary, #a84332) 40%, var(--void-deep))
  );
}
`;
