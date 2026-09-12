// @vitest-environment jsdom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../i18n/LanguageProvider";
import { french } from "../i18n/fr";
import { VoiceActions } from "./VoiceActions";
import type { VoiceActionId } from "@/packages/core/src/domain/voiceCommands";

/** The browser engine, driven by the test instead of by a voice. */
class FakeRecognition {
  static instances: FakeRecognition[] = [];
  continuous = false;
  interimResults = false;
  lang = "";
  maxAlternatives = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onresult: ((event: unknown) => void) | null = null;
  constructor() {
    FakeRecognition.instances.push(this);
  }
  start() {
    this.onstart?.();
  }
  stop() {
    this.onend?.();
  }
}

/**
 * The engine hands back every result of the session on each event, with an
 * offset to the new ones, so the fake has to grow the same way.
 */
let heard: Array<{ 0: { transcript: string }; isFinal: boolean }> = [];

function hear(text: string, final = true) {
  const engine = FakeRecognition.instances.at(-1);
  const resultIndex = heard.length;
  heard = [...heard, { 0: { transcript: text }, isFinal: final }];
  const results = heard;
  act(() => {
    engine?.onresult?.({
      resultIndex,
      results: Object.assign([...results], { length: results.length }),
    });
  });
  // A revised hypothesis replaces itself rather than adding a result.
  if (!final) heard = heard.slice(0, resultIndex);
}

type Spies = {
  onAction: ReturnType<typeof vi.fn>;
  onDictate: ReturnType<typeof vi.fn>;
  onDraft: ReturnType<typeof vi.fn>;
};

function show(
  options: { language?: "en" | "fr"; canStartVoice?: boolean } = {},
): Spies {
  const spies: Spies = {
    onAction: vi.fn(),
    onDictate: vi.fn(),
    onDraft: vi.fn(),
  };
  render(
    <LanguageProvider
      language={options.language ?? "en"}
      dictionary={options.language === "fr" ? french : {}}
    >
      <VoiceActions
        {...spies}
        canStartVoice={options.canStartVoice ?? true}
        voiceBusy={false}
      />
    </LanguageProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: /Speak|Parler/ }));
  return spies;
}

const action = (spy: ReturnType<typeof vi.fn>): VoiceActionId[] =>
  spy.mock.calls.map((call) => call[0] as VoiceActionId);

beforeEach(() => {
  FakeRecognition.instances = [];
  heard = [];
  vi.stubGlobal("SpeechRecognition", FakeRecognition);
  Object.assign(window, { SpeechRecognition: FakeRecognition });
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete (window as unknown as { SpeechRecognition?: unknown })
    .SpeechRecognition;
  localStorage.clear();
});

describe("hearing a command", () => {
  it("runs a command spoken inside an ordinary sentence", () => {
    const spies = show();
    hear("can you go back please");
    expect(action(spies.onAction)).toEqual(["back"]);
  });

  it("ignores a hypothesis the engine has not settled on", () => {
    const spies = show();
    hear("back", false);
    expect(spies.onAction).not.toHaveBeenCalled();
    hear("backpack straps");
    expect(spies.onAction).not.toHaveBeenCalled();
  });

  it("hears a French command when the interface is French", () => {
    const spies = show({ language: "fr" });
    hear("peux-tu revenir en arrière");
    expect(spies.onAction).not.toHaveBeenCalledWith("youtube");
    hear("retour");
    expect(action(spies.onAction)).toContain("back");
  });

  it("carries the artist to the search rather than asking for a link", () => {
    const spies = show();
    hear("YouTube Daft Punk Around the World");
    expect(spies.onAction).toHaveBeenCalledWith(
      "youtube",
      "Daft Punk Around the World",
    );
  });

  it("opens the tab when YouTube is said with nothing after it", () => {
    const spies = show();
    hear("YouTube");
    expect(spies.onAction).toHaveBeenCalledWith("youtube", undefined);
  });
});

describe("speaking a question", () => {
  it("sends the words after a pause, with no button to press", () => {
    const spies = show();
    hear("what does this document actually argue");
    expect(spies.onDictate).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(2000));
    expect(spies.onDictate).toHaveBeenCalledWith(
      "what does this document actually argue",
    );
  });

  it("sends straight away when the speaker says so", () => {
    const spies = show();
    hear("what is the main claim here");
    hear("send it");
    expect(spies.onDictate).toHaveBeenCalledWith("what is the main claim here");
  });

  it("gathers a question said in two breaths", () => {
    const spies = show();
    hear("what does the author");
    hear("say about funding");
    act(() => vi.advanceTimersByTime(2000));
    expect(spies.onDictate).toHaveBeenCalledWith(
      "what does the author say about funding",
    );
  });

  it("sends the speaker's own wording instead of the canned summary", () => {
    const spies = show();
    hear("summarize this in three short points");
    expect(spies.onDictate).toHaveBeenCalledWith(
      "summarize this in three short points",
    );
    expect(action(spies.onAction)).not.toContain("summarize");
  });

  it("runs the shortcut when the command is said on its own", () => {
    const spies = show();
    hear("summarize this");
    expect(action(spies.onAction)).toEqual(["summarize"]);
    expect(spies.onDictate).not.toHaveBeenCalled();
  });

  it("throws nothing away when the speaker cancels", () => {
    const spies = show();
    hear("what does this say about the budget");
    hear("cancel");
    act(() => vi.advanceTimersByTime(3000));
    expect(spies.onDictate).not.toHaveBeenCalled();
    expect(action(spies.onAction)).toContain("cancel");
  });
});
