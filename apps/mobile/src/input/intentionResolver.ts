export type VoiceCommand =
  | { type: "fly-to"; planetId: string }
  | { type: "open" }
  | { type: "fly-back" }
  | { type: "toggle-reality" }
  | { type: "next" }
  | { type: "previous" }
  | { type: "summarize" };

export type GestureSignal =
  | { type: "tap-planet"; planetId: string }
  | { type: "tap-empty" }
  | { type: "orbit"; delta: number }
  | { type: "zoom"; factor: number };

export type GazeSignal =
  | { type: "looking-at"; planetId: string }
  | { type: "dwell-select"; planetId: string };

export type InputSignals = {
  voiceCommand?: VoiceCommand;
  gesture?: GestureSignal;
  gaze?: GazeSignal;
};

export type SceneAction =
  | { type: "fly-to"; planetId: string }
  | { type: "fly-back" }
  | { type: "toggle-reality" }
  | { type: "orbit"; delta: number }
  | { type: "zoom"; factor: number }
  | { type: "tap-planet"; planetId: string }
  | { type: "dwell-select"; planetId: string }
  | { type: "summarize" }
  | { type: "open" }
  | { type: "next" }
  | { type: "previous" };

export function resolveIntention(signals: InputSignals): SceneAction | null {
  if (signals.voiceCommand) {
    if (signals.voiceCommand.type === "open" && signals.gaze?.type === "looking-at") {
      return { type: "fly-to", planetId: signals.gaze.planetId };
    }
    if (signals.voiceCommand.type === "fly-to") return signals.voiceCommand;
    if (signals.voiceCommand.type === "fly-back") return { type: "fly-back" };
    if (signals.voiceCommand.type === "toggle-reality") return { type: "toggle-reality" };
    if (signals.voiceCommand.type === "summarize") return { type: "summarize" };
    return signals.voiceCommand;
  }

  if (signals.gesture) {
    if (signals.gesture.type === "tap-planet") return signals.gesture;
    if (signals.gesture.type === "tap-empty") return { type: "fly-back" };
    if (signals.gesture.type === "orbit") return signals.gesture;
    if (signals.gesture.type === "zoom") return signals.gesture;
  }

  if (signals.gaze?.type === "dwell-select") return signals.gaze;

  return null;
}
