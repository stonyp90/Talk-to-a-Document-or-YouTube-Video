"use client";

import { useEffect, useRef, useMemo } from "react";
import type { CallerMood } from "@/packages/core/src/domain/voiceControls";

type Activity = "idle" | "listening" | "thinking" | "speaking" | "motion";

const MOOD_PALETTE: Record<CallerMood, string[]> = {
  calm: ["#a84332", "#c25a45", "#d6725c", "#c25a45", "#a84332"],
  joyful: ["#38614b", "#4a8c62", "#5cb87a", "#4a8c62", "#38614b"],
  curious: ["#ec4899", "#f472b6", "#f9a8d4", "#f472b6", "#ec4899"],
  hesitant: ["#d6d0c7", "#c7c0b5", "#b8b0a3", "#c7c0b5", "#d6d0c7"],
  frustrated: ["#705d1b", "#8a7225", "#a4882f", "#8a7225", "#705d1b"],
  angry: ["#a23f3f", "#c44b4b", "#e05555", "#c44b4b", "#a23f3f"],
  urgent: ["#f47762", "#f8947a", "#fcb192", "#f8947a", "#f47762"],
};

const BAR_X = [22, 34, 46, 58, 70];
const BAR_W = 7;
const BAR_H = [38, 52, 44, 50, 36];
const BAR_Y = [30, 22, 26, 23, 31];
const CAP = 3.5;

export function LivingLogo({
  activity = "idle",
  mood = "calm",
  conversationDepth = 0,
  onClick,
}: {
  activity?: Activity;
  mood?: CallerMood;
  conversationDepth?: number;
  onClick?: () => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rafRef = useRef<number>(0);
  const phaseRef = useRef(0);

  const colors = MOOD_PALETTE[mood];
  const baseScale = 1 + Math.min(conversationDepth, 10) * 0.03;

  const activityConfig = useMemo(() => {
    switch (activity) {
      case "listening":
        return { pulseAmp: 0.18, pulseSpeed: 0.045, barWave: 0.7, scale: 1.06, corePulse: 0.12 };
      case "thinking":
        return { pulseAmp: 0.1, pulseSpeed: 0.018, barWave: 0.35, scale: 1.2, corePulse: 0.08 };
      case "speaking":
        return { pulseAmp: 0.28, pulseSpeed: 0.07, barWave: 1.1, scale: 1.02, corePulse: 0.15 };
      case "motion":
        return { pulseAmp: 0.12, pulseSpeed: 0.035, barWave: 0.45, scale: 1.03, corePulse: 0.1 };
      default:
        return { pulseAmp: 0.05, pulseSpeed: 0.012, barWave: 0.18, scale: 1.0, corePulse: 0.06 };
    }
  }, [activity]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const bars = svg.querySelectorAll<SVGRectElement>(".living-bar");
    const core = svg.querySelector<SVGCircleElement>(".living-core");
    const coreGlow = svg.querySelector<SVGCircleElement>(".core-glow");
    const energyLines = svg.querySelectorAll<SVGPathElement>(".energy-line");
    const particles = svg.querySelectorAll<SVGCircleElement>(".particle");

    function tick() {
      phaseRef.current += activityConfig.pulseSpeed;
      const phase = phaseRef.current;

      bars.forEach((bar, i) => {
        const wave =
          Math.sin(phase + i * activityConfig.barWave) *
          activityConfig.pulseAmp;
        const h = BAR_H[i] * (1 + wave);
        const y = BAR_Y[i] + (BAR_H[i] - h) / 2;
        bar.setAttribute("height", String(h));
        bar.setAttribute("y", String(y));
        bar.setAttribute("fill", colors[i]);
      });

      if (core) {
        const coreScale = 1 + Math.sin(phase * 2) * activityConfig.corePulse;
        core.setAttribute("r", String(4 * coreScale));
        core.setAttribute("fill", colors[2]);
      }

      if (coreGlow) {
        const glowScale = 1 + Math.sin(phase * 2) * activityConfig.corePulse * 1.5;
        coreGlow.setAttribute("r", String(8 * glowScale));
        coreGlow.setAttribute("opacity", String(0.3 + Math.sin(phase * 2) * 0.1));
      }

      energyLines.forEach((line, i) => {
        const opacity = 0.2 + Math.sin(phase * 1.5 + i * 0.8) * 0.15;
        line.setAttribute("opacity", String(opacity));
        line.setAttribute("stroke", colors[i % colors.length]);
      });

      particles.forEach((particle, i) => {
        const drift = Math.sin(phase * 0.8 + i * 2.1) * 3;
        const baseX = 30 + (i % 3) * 15;
        const baseY = 75 + Math.floor(i / 3) * 4;
        particle.setAttribute("cx", String(baseX + drift));
        particle.setAttribute("cy", String(baseY + Math.cos(phase + i) * 2));
        particle.setAttribute("opacity", String(0.4 + Math.sin(phase + i * 1.5) * 0.3));
        particle.setAttribute("fill", colors[i % colors.length]);
      });

      const groupScale = activityConfig.scale * baseScale;
      const group = svg!.querySelector<SVGGElement>(".living-bars");
      if (group) {
        group.setAttribute(
          "transform",
          `translate(46, 50) scale(${groupScale}) translate(-46, -50)`,
        );
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [activityConfig, colors, baseScale]);

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 92 92"
      className="living-logo"
      data-activity={activity}
      data-mood={mood}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? "Open source picker" : undefined}
    >
      <defs>
        <filter id="logo-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="core-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g className="living-bars" filter="url(#logo-glow)">
        {BAR_X.map((x, i) => (
          <rect
            key={i}
            className="living-bar"
            x={x}
            y={BAR_Y[i]}
            width={BAR_W}
            height={BAR_H[i]}
            rx={CAP}
            fill={colors[i]}
          />
        ))}
        <circle
          className="living-core"
          cx="46"
          cy="50"
          r="4"
          fill={colors[2]}
          filter="url(#core-glow)"
        />
        <circle
          className="core-glow"
          cx="46"
          cy="50"
          r="8"
          fill={colors[2]}
          opacity="0.3"
        />
        <path
          className="energy-line"
          d="M 22 68 Q 34 74 46 70 Q 58 74 70 68"
          stroke={colors[1]}
          strokeWidth="1.2"
          fill="none"
          opacity="0.25"
          strokeLinecap="round"
        />
        <path
          className="energy-line"
          d="M 28 72 Q 37 78 46 75 Q 55 78 64 72"
          stroke={colors[3]}
          strokeWidth="1"
          fill="none"
          opacity="0.2"
          strokeLinecap="round"
        />
        <path
          className="energy-line"
          d="M 34 76 Q 40 80 46 78 Q 52 80 58 76"
          stroke={colors[0]}
          strokeWidth="0.8"
          fill="none"
          opacity="0.15"
          strokeLinecap="round"
        />
        {[
          { x: 30, y: 75 },
          { x: 46, y: 78 },
          { x: 62, y: 75 },
          { x: 38, y: 80 },
          { x: 54, y: 80 },
          { x: 46, y: 83 },
        ].map((pos, i) => (
          <circle
            key={i}
            className="particle"
            cx={pos.x}
            cy={pos.y}
            r="1.5"
            fill={colors[i % colors.length]}
            opacity="0.5"
          />
        ))}
      </g>
    </svg>
  );
}
