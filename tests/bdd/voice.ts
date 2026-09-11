import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildContextInstructions } from "../../packages/core/src/domain/ingestion";
import {
  BUILT_IN_VOICES,
  realtimeAudioConfig,
} from "../../packages/adapters/src/realtimeAudio";
import {
  VOICE_SAMPLE_LIMITS,
  consentPhrase,
} from "../../packages/adapters/src/voiceEnrollment";
import {
  defaultTriggers,
  matchTriggers,
  spokenExamples,
  type VoiceActionId,
  type VoiceTrigger,
} from "../../apps/web/src/lib/voiceCommands";
import type { Step, World } from "./steps";

const source = {
  kind: "pdf" as const,
  sourceName: "guide.pdf",
  text: "The demo answer is forty-two.",
  characters: 29,
};

type State = {
  audio?: ReturnType<typeof realtimeAudioConfig>;
  spoken?: string;
  written?: string;
  environment: Record<string, string | undefined>;
  triggers: VoiceTrigger[];
  matched: VoiceTrigger[];
  guidance?: string;
};

export function registerVoiceChecks(step: Step) {
  const states = new WeakMap<World, State>();
  const state = (world: World): State => {
    const existing = states.get(world);
    if (existing) return existing;
    const created: State = { environment: {}, triggers: [], matched: [] };
    states.set(world, created);
    return created;
  };
  const triggered = (world: World, action: VoiceActionId) =>
    state(world).matched.some((match) => match.action === action);

  step("a custom voice has been provisioned", function () {
    state(this).environment.OPENAI_REALTIME_VOICE = "voice_enrolled123";
  });

  step("a realtime voice session is configured", function () {
    const current = state(this);
    current.audio = realtimeAudioConfig(current.environment);
    current.spoken = buildContextInstructions(source, undefined, "voice");
    current.written = buildContextInstructions(source);
  });

  step(
    "the assistant is told to answer in short spoken sentences without markup",
    function () {
      const spoken = state(this).spoken ?? "";
      assert.match(spoken, /short sentences/i);
      assert.match(spoken, /no markdown/i);
      assert.match(spoken, /two or three sentences/i);
    },
  );

  step("the assistant is told to expect interruptions", function () {
    assert.match(state(this).spoken ?? "", /interrupted/i);
  });

  step("the written fallback keeps its own instructions", function () {
    const current = state(this);
    assert.ok(current.written);
    assert.doesNotMatch(current.written, /no markdown/i);
    assert.ok(current.written.includes(source.text));
  });

  step("turn detection waits for a finished thought", function () {
    assert.equal(
      (state(this).audio?.input.turn_detection as { type?: string })?.type,
      "semantic_vad",
    );
  });

  step("the caller can interrupt the spoken answer", function () {
    assert.equal(
      (
        state(this).audio?.input.turn_detection as {
          interrupt_response?: boolean;
        }
      )?.interrupt_response,
      true,
    );
  });

  step("microphone noise reduction is applied", function () {
    assert.ok(state(this).audio?.input.noise_reduction?.type);
  });

  step("a built-in voice is selected", function () {
    assert.ok(
      (BUILT_IN_VOICES as readonly string[]).includes(
        String(state(this).audio?.output.voice),
      ),
    );
  });

  step("the speaking speed is one the provider accepts", function () {
    const speed = state(this).audio?.output.speed ?? 0;
    assert.ok(speed >= 0.25 && speed <= 1.5);
  });

  step("the session selects that voice by its identifier", function () {
    assert.deepEqual(state(this).audio?.output.voice, {
      id: "voice_enrolled123",
    });
  });

  step("I ask how to lend my voice in French", function () {
    state(this).guidance = consentPhrase("fr");
  });

  step("I am given the approved consent sentence word for word", function () {
    assert.equal(
      state(this).guidance,
      "Je suis le propriétaire de cette voix et j'autorise OpenAI à utiliser cette voix pour créer un modèle de voix synthétique.",
    );
  });

  step("I am told how long the speech sample must be", function () {
    assert.ok(VOICE_SAMPLE_LIMITS.minimumSpeechSeconds > 0);
    assert.ok(
      VOICE_SAMPLE_LIMITS.maximumSeconds >= VOICE_SAMPLE_LIMITS.idealSeconds.to,
    );
  });

  step(
    "no phrase spoken in the application can enrol a voice",
    async function () {
      // Enrolment lives in an operator script that needs two files and the
      // server key: nothing the browser can reach creates a voice.
      const client = await readFile(
        "apps/web/src/lib/voiceCommands.ts",
        "utf8",
      );
      assert.doesNotMatch(client, /voice_consents|audio\/voices/);
      const script = await readFile("scripts/voice/enroll.ts", "utf8");
      assert.match(script, /createVoiceEnrollment/);
    },
  );

  step("the interface is in French", function () {
    const current = state(this);
    current.triggers = [
      ...defaultTriggers("fr"),
      ...spokenExamples("fr")
        .filter((example) => example.action === "summarize")
        .map((example) => ({
          id: `example-${example.action}`,
          phrase: example.phrase,
          action: example.action,
          aliases: example.aliases,
        })),
    ];
  });

  const heard = (phrase: string) =>
    function (this: World) {
      const current = state(this);
      current.matched = matchTriggers(phrase, current.triggers);
    };
  step(
    'I say "résume ceci s\'il te plaît"',
    heard("résume ceci s'il te plaît"),
  );
  step('I say "resume ceci"', heard("resume ceci"));
  step('I say "go back please"', heard("go back please"));
  step('I say "je lisais le backlog hier"', heard("je lisais le backlog hier"));

  step("the summary action is triggered", function () {
    assert.ok(triggered(this, "summarize"));
  });
  step("the back action is triggered", function () {
    assert.ok(triggered(this, "back"));
  });
  step("no action is triggered", function () {
    assert.deepEqual(state(this).matched, []);
  });
}
