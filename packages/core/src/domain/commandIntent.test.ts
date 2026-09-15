import { describe, expect, it } from "vitest";
import {
  createIntentBus,
  describeIntent,
  previewLine,
  type IntentProposal,
  type IntentTarget,
} from "./commandIntent";

const report: IntentTarget = {
  kind: "source",
  id: "pdf-1",
  label: "Annual report.pdf",
};
const brief: IntentTarget = { kind: "source", id: "pdf-2", label: "Brief.pdf" };

const heard = (
  action: IntentProposal["action"],
  extra: Partial<IntentProposal> = {},
): IntentProposal => ({
  action,
  source: "voice",
  heardAt: 1000,
  ...extra,
});

describe("the intent bus", () => {
  it("starts empty", () => {
    expect(createIntentBus().snapshot()).toBeNull();
  });

  it("never executes a hypothesis", () => {
    const bus = createIntentBus();
    expect(bus.propose(heard("next")).state).toBe("provisional");
    expect(bus.execute(1200)).toBeNull();
    expect(bus.snapshot()?.state).toBe("provisional");
  });

  it("executes once the words have settled, and only once", () => {
    const bus = createIntentBus();
    bus.propose(heard("next"));
    expect(bus.settle(heard("next")).state).toBe("ready");
    const done = bus.execute(1400);
    expect(done).toMatchObject({
      action: "next",
      state: "executed",
      executedAt: 1400,
    });
    expect(bus.execute(1500)).toBeNull();
    expect(bus.snapshot()?.state).toBe("executed");
  });

  it("lets a settled intent skip the hypothesis stage", () => {
    const bus = createIntentBus();
    bus.settle(heard("back", { source: "keyboard" }));
    expect(bus.execute(1)).toMatchObject({ action: "back", source: "keyboard" });
  });

  it("replaces one hypothesis with the next as the recognizer revises", () => {
    const bus = createIntentBus();
    bus.propose(heard("back"));
    bus.propose(heard("cancel"));
    expect(bus.snapshot()?.action).toBe("cancel");
  });

  it("does not let a hypothesis overwrite a settled intent", () => {
    const bus = createIntentBus();
    bus.settle(heard("summarize", { target: report }));
    const kept = bus.propose(heard("next", { source: "motion" }));
    expect(kept).toMatchObject({ action: "summarize", state: "ready" });
    expect(bus.execute(2)?.action).toBe("summarize");
  });

  it("freezes the target once the intent is settled", () => {
    const bus = createIntentBus();
    bus.propose(heard("summarize", { target: report }));
    bus.retarget(brief);
    expect(bus.snapshot()?.target).toEqual(brief);
    bus.settle(heard("summarize", { target: brief }));
    bus.retarget(report);
    expect(bus.snapshot()?.target).toEqual(brief);
    expect(bus.execute(3)?.target).toEqual(brief);
  });

  it("cancels whatever is pending and refuses to run it afterwards", () => {
    const bus = createIntentBus();
    bus.settle(heard("stop"));
    expect(bus.cancel()?.state).toBe("cancelled");
    expect(bus.execute(4)).toBeNull();
  });

  it("leaves an executed intent alone when cancelled too late", () => {
    const bus = createIntentBus();
    bus.settle(heard("next"));
    bus.execute(5);
    expect(bus.cancel()?.state).toBe("executed");
  });

  it("accepts a new proposal after a cancellation or an execution", () => {
    const bus = createIntentBus();
    bus.settle(heard("next"));
    bus.execute(6);
    expect(bus.propose(heard("back")).state).toBe("provisional");
    bus.cancel();
    expect(bus.propose(heard("upload")).state).toBe("provisional");
  });

  it("hands out intents nobody can rewrite", () => {
    const bus = createIntentBus();
    const intent = bus.settle(heard("summarize", { target: report }));
    expect(Object.isFrozen(intent)).toBe(true);
    expect(Object.isFrozen(intent.target)).toBe(true);
    expect(() => {
      (intent as { action: string }).action = "cancel";
    }).toThrow();
  });
});

describe("describing an intent", () => {
  it("separates what was said from what the interface filled in", () => {
    const preview = describeIntent({ action: "summarize", target: report });
    expect(preview).toEqual({
      said: ["Summarize"],
      inferred: ["Annual report.pdf", "Key points"],
      unresolved: [],
    });
    expect(previewLine(preview)).toBe(
      "Summarize → Annual report.pdf → Key points",
    );
  });

  it("names what is still missing", () => {
    expect(describeIntent({ action: "summarize" })).toEqual({
      said: ["Summarize"],
      inferred: ["Key points"],
      unresolved: ["A source"],
    });
    expect(describeIntent({ action: "ask", target: report }).unresolved).toEqual(
      ["Your question"],
    );
    expect(previewLine(describeIntent({ action: "ask" }))).toBe(
      "Ask → A source? → Your question?",
    );
  });

  it("keeps the argument with what was said", () => {
    expect(
      describeIntent({ action: "youtube", argument: "Miles Davis" }),
    ).toEqual({ said: ["YouTube", "Miles Davis"], inferred: [], unresolved: [] });
  });

  it("asks for nothing more from a verb that stands alone", () => {
    expect(describeIntent({ action: "next" })).toEqual({
      said: ["Next"],
      inferred: [],
      unresolved: [],
    });
  });

  it("translates through the caller's dictionary, with English keys", () => {
    const french: Record<string, string> = {
      Summarize: "Résumer",
      "Key points": "Points clés",
      "A source": "Une source",
    };
    const preview = describeIntent(
      { action: "summarize" },
      (key) => french[key] ?? key,
    );
    expect(previewLine(preview)).toBe("Résumer → Points clés → Une source?");
  });
});
