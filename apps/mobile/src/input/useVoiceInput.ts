import { useRef } from "react";
import type { VoiceCommand } from "./intentionResolver";
import type { Planet } from "../scene/useGalaxyState";

export function useVoiceInput(
  transcript: string,
  planets?: Planet[],
): VoiceCommand | undefined {
  const lastProcessed = useRef(0);

  if (!transcript || transcript.length === lastProcessed.current) return undefined;
  lastProcessed.current = transcript.length;

  const lower = transcript.toLowerCase();
  if (lower.includes("go back") || lower.includes("fly back")) return { type: "fly-back" };
  if (lower.includes("ar mode") || lower.includes("augmented reality")) return { type: "toggle-reality" };
  if (lower.includes("3d mode")) return { type: "toggle-reality" };
  if (lower.includes("summarize") || lower.includes("summary")) return { type: "summarize" };

  if (planets) {
    for (const planet of planets) {
      if (lower.includes(planet.name.toLowerCase())) {
        return { type: "fly-to", planetId: planet.id };
      }
    }
  }

  if (lower.includes("open")) return { type: "open" };
  if (lower.includes("next")) return { type: "next" };
  if (lower.includes("previous")) return { type: "previous" };

  return undefined;
}
