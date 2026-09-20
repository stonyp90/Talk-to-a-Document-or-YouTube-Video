export type NativeSenseChannelControl = { start(): void; stop(): void };
export type NativeSenseChannelActivity = {
  active: boolean;
  connecting: boolean;
};
export type NativeSenseActivity = {
  listening: boolean;
  motion: boolean;
  connecting: boolean;
};

/** The same activation owns both adapters and never requests input on creation. */
export function createNativeSenseSession(options: {
  voice: () => NativeSenseChannelControl | null | undefined;
  motion: () => NativeSenseChannelControl | null | undefined;
  onStop?: () => void;
}) {
  let disposed = false;
  const each = (action: "start" | "stop") => {
    for (const channel of [options.voice(), options.motion()]) {
      try {
        channel?.[action]();
      } catch {
        /* A failed adapter does not prevent the other from working. */
      }
    }
  };
  return {
    start() {
      if (!disposed) each("start");
    },
    stop() {
      if (!disposed) {
        each("stop");
        options.onStop?.();
      }
    },
    dispose() {
      if (!disposed) {
        each("stop");
        disposed = true;
      }
    },
  };
}

/** Consent can finish after stop/background/unmount; stale grants never capture. */
export function createPermissionSession(options: {
  request: () => Promise<boolean>;
  open: () => void;
  close: () => void;
  pending: (value: boolean) => void;
  denied: () => void;
}) {
  let generation = 0;
  let started = false;
  let disposed = false;
  const stop = () => {
    generation++;
    started = false;
    options.close();
    options.pending(false);
  };
  return {
    start() {
      if (started || disposed) return;
      started = true;
      const current = ++generation;
      options.pending(true);
      const failed = () => {
        if (disposed || current !== generation) return;
        started = false;
        options.pending(false);
        options.denied();
      };
      try {
        void options
          .request()
          .then((granted) => {
            if (disposed || current !== generation) return;
            options.pending(false);
            if (granted) options.open();
            else failed();
          })
          .catch(failed);
      } catch {
        failed();
      }
    },
    stop,
    dispose() {
      if (!disposed) {
        stop();
        disposed = true;
      }
    },
  };
}

export type TiltAction = "next" | "prev" | "ask";
export type TiltSample = { x: number; y: number; z: number };
export type TiltSettings = {
  threshold: number;
  neutral: number;
  holdMs: number;
  cooldownMs: number;
};
export const DEFAULT_TILT_SETTINGS: TiltSettings = {
  threshold: 0.45,
  neutral: 0.18,
  holdMs: 350,
  cooldownMs: 1200,
};

/** Physical accelerometer samples only; no simulated face or body detections. */
export function createTiltReader(settings: Partial<TiltSettings> = {}) {
  const config = { ...DEFAULT_TILT_SETTINGS, ...settings };
  let baseline: TiltSample | undefined;
  let latched = false;
  let candidate: TiltAction | undefined;
  let since = 0;
  let last = -Infinity;
  return {
    read(sample: TiltSample, now: number): TiltAction | undefined {
      if (![sample.x, sample.y, sample.z].every(Number.isFinite)) return;
      if (!baseline) {
        baseline = sample;
        return;
      }
      const x = sample.x - baseline.x;
      const z = sample.z - baseline.z;
      if (Math.abs(x) < config.neutral && Math.abs(z) < config.neutral) {
        latched = false;
        candidate = undefined;
        return;
      }
      if (latched || now - last < config.cooldownMs) return;
      const next: TiltAction | undefined =
        Math.abs(x) >= Math.abs(z) && Math.abs(x) >= config.threshold
          ? x > 0
            ? "next"
            : "prev"
          : z >= config.threshold
            ? "ask"
            : undefined;
      if (!next) {
        candidate = undefined;
        return;
      }
      if (candidate !== next) {
        candidate = next;
        since = now;
        return;
      }
      if (now - since < config.holdMs) return;
      latched = true;
      last = now;
      return next;
    },
    reset() {
      baseline = undefined;
      candidate = undefined;
      latched = false;
      last = -Infinity;
    },
  };
}
