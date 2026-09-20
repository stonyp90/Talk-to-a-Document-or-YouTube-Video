const SILENCE_TIMEOUT_MS = { merged: 120_000, panel: 8_000 } as const;

/** Deterministic injected speech has no wall-clock deadline; physical input does. */
export function voiceSilenceTimeoutMs({
  merged,
  testMode,
}: {
  merged: boolean;
  testMode: boolean;
}): number | undefined {
  if (merged && testMode) return undefined;
  return merged ? SILENCE_TIMEOUT_MS.merged : SILENCE_TIMEOUT_MS.panel;
}
