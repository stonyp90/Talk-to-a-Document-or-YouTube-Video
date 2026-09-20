/**
 * What a person is about to make the interface do, before it does it.
 *
 * A verb on its own is often not enough: "summarize" applies to a source,
 * "ask" to a question, and speech arrives in two stages — a hypothesis the
 * recognizer is still revising, then the text it settles on. A gesture works
 * the same way, highlighting first and confirming second. The intent bus holds
 * that one pending thing for voice and motion alike, with a single rule that
 * both must obey: nothing provisional ever runs. Only a settled intent can be
 * executed, and once settled its target is frozen, so a source that changes
 * under the reader between "next" and the action does not retarget the word
 * they already said.
 *
 * Usage: `propose` on interim speech or a highlighting gesture; `settle` on
 * final speech or a confirming gesture; then `execute(now)` returns the intent
 * to act on, or null if nothing was ready. `cancel` withdraws whatever is
 * pending; `retarget` moves a provisional intent and is ignored once settled;
 * `snapshot` reads the current intent for a preview. Pure and framework-free.
 */

import type { VoiceActionId } from "./voiceCommands";

export type IntentSource = "voice" | "motion" | "keyboard";
export type IntentState = "provisional" | "ready" | "executed" | "cancelled";

export type IntentTarget = {
  kind: "source" | "prompt";
  id: string;
  label: string;
};

export type CommandIntent = {
  action: VoiceActionId;
  argument?: string;
  source: IntentSource;
  state: IntentState;
  /** When the words or the gesture were first heard, on the caller's clock. */
  heardAt: number;
  target?: IntentTarget;
  /** Set by `execute`, on the same clock as `heardAt`. */
  executedAt?: number;
};

/** An intent as the caller knows it, before the bus assigns it a state. */
export type IntentProposal = Omit<CommandIntent, "state" | "executedAt">;

export type IntentBus = {
  propose: (intent: IntentProposal) => CommandIntent;
  settle: (intent: IntentProposal) => CommandIntent;
  retarget: (target: IntentTarget | undefined) => CommandIntent | null;
  execute: (now: number) => CommandIntent | null;
  cancel: () => CommandIntent | null;
  snapshot: () => CommandIntent | null;
};

function freeze(intent: CommandIntent): CommandIntent {
  return Object.freeze({
    ...intent,
    target: intent.target ? Object.freeze({ ...intent.target }) : undefined,
  });
}

export function createIntentBus(): IntentBus {
  let current: CommandIntent | null = null;

  return {
    propose(intent) {
      // A settled intent is a promise already made to the reader; a new
      // hypothesis arriving underneath it must not take its place.
      if (current?.state === "ready") return current;
      current = freeze({ ...intent, state: "provisional" });
      return current;
    },
    settle(intent) {
      current = freeze({ ...intent, state: "ready" });
      return current;
    },
    retarget(target) {
      if (!current || current.state !== "provisional") return current;
      current = freeze({ ...current, target });
      return current;
    },
    execute(now) {
      if (current?.state !== "ready") return null;
      current = freeze({ ...current, state: "executed", executedAt: now });
      return current;
    },
    cancel() {
      if (!current || current.state === "executed") return current;
      current = freeze({ ...current, state: "cancelled" });
      return current;
    },
    snapshot() {
      return current;
    },
  };
}

/** Actions that mean nothing until a source is there to apply them to. */
const TARGETED_ACTIONS: readonly VoiceActionId[] = ["summarize", "ask", "voice"];

/**
 * The name of each action as a preview chip, short enough to sit in a row of
 * arrows. English keys; the caller's translator turns them into French.
 */
const ACTION_NAMES: Record<VoiceActionId, string> = {
  youtube: "YouTube",
  upload: "Upload",
  voice: "Voice chat",
  summarize: "Summarize",
  ask: "Ask",
  stop: "Stop",
  back: "Back",
  next: "Next",
  cancel: "Cancel",
  open: "Open",
  select: "Select",
  search: "Search",
};

/**
 * What the interface fills in when the speaker only said the verb. The
 * built-in summary asks for key points, so that is what the preview shows.
 */
const INFERRED_REQUESTS: Partial<Record<VoiceActionId, string>> = {
  summarize: "Key points",
};

export type IntentPreview = {
  /** What the person actually said or gestured: the action, then its argument. */
  said: string[];
  /** What the interface supplied on their behalf: the target, a default request. */
  inferred: string[];
  /** What is still missing before the action means anything. */
  unresolved: string[];
};

/**
 * The parts of "Summarize → Annual report.pdf → Key points", kept apart so a
 * view can show what was said, what was assumed, and what is still missing.
 */
export function describeIntent(
  intent: Pick<CommandIntent, "action" | "argument" | "target">,
  t: (key: string) => string = (key) => key,
): IntentPreview {
  const said = [t(ACTION_NAMES[intent.action])];
  if (intent.argument) said.push(intent.argument);

  const inferred: string[] = [];
  const unresolved: string[] = [];
  if (TARGETED_ACTIONS.includes(intent.action)) {
    if (intent.target) inferred.push(intent.target.label);
    else unresolved.push(t("A source"));
  }
  if (intent.action === "ask" && !intent.argument)
    unresolved.push(t("Your question"));
  const request = INFERRED_REQUESTS[intent.action];
  if (request && !intent.argument) inferred.push(t(request));

  return { said, inferred, unresolved };
}

/** One line for a status region, with the missing parts marked as questions. */
export function previewLine(preview: IntentPreview): string {
  return [
    ...preview.said,
    ...preview.inferred,
    ...preview.unresolved.map((part) => `${part}?`),
  ].join(" → ");
}
