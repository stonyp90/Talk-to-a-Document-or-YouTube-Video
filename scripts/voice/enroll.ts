/**
 * Lends a real person's voice to the assistant.
 *
 * Run it with no recordings to be told exactly what to say, then run it again
 * with the two files. It prints the voice identifier to put in
 * OPENAI_REALTIME_VOICE, which is the only way the realtime session can answer
 * in that voice.
 */
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import {
  VOICE_CONSENT_PHRASES,
  VOICE_SAMPLE_LIMITS,
  consentLanguage,
  consentPhrase,
  createVoiceEnrollment,
} from "../../packages/adapters/src/voiceEnrollment";
import { getOpenAiKey } from "../../packages/adapters/src/secrets";

type Options = Record<string, string>;

function parse(argv: string[]): Options {
  const options: Options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) continue;
    const [name, inline] = argument.slice(2).split("=");
    options[name] = inline ?? argv[++index] ?? "";
  }
  return options;
}

function instructions(language: string): string {
  const limits = VOICE_SAMPLE_LIMITS;
  return [
    "",
    `Two recordings are needed, both of the same speaker, in ${language}.`,
    "",
    "1. The consent recording. Say exactly these words, and nothing else:",
    "",
    `   ${consentPhrase(language)}`,
    "",
    `2. The sample recording: ${limits.idealSeconds.from} to ${limits.idealSeconds.to} seconds of ordinary speech,`,
    "   several complete sentences, in the voice the assistant should use.",
    "   Say anything you like. Read a paragraph of the document you talk to.",
    "",
    `Limits: at least ${limits.minimumSpeechSeconds} seconds of speech, at most ${limits.maximumSeconds} seconds`,
    `and ${limits.maximumBytes / 1024 / 1024} MB per file, in one of: ${limits.formats.join(", ")}.`,
    "",
    "Then run:",
    "",
    `   npm run voice:enroll -- --name my-voice --language ${language} \\`,
    "       --consent consent.wav --sample sample.wav",
    "",
  ].join("\n");
}

async function recording(path: string) {
  return {
    bytes: new Uint8Array(await readFile(path)),
    filename: basename(path),
  };
}

async function main(): Promise<void> {
  const options = parse(process.argv.slice(2));
  const language = consentLanguage(options.language ?? "en");
  if (!language) {
    console.error(
      `Choose a language with an approved consent phrase: ${Object.keys(VOICE_CONSENT_PHRASES).join(", ")}.`,
    );
    process.exitCode = 1;
    return;
  }
  if (!options.consent || !options.sample) {
    console.log(instructions(language));
    return;
  }
  const enrollment = createVoiceEnrollment({ getKey: getOpenAiKey });
  const voice = await enrollment.enroll({
    name: options.name ?? "ursly-voice",
    language,
    consentRecording: await recording(options.consent),
    sample: await recording(options.sample),
  });
  console.log(
    [
      "",
      "The voice is ready. Put it in the environment and restart the app:",
      "",
      `   OPENAI_REALTIME_VOICE=${voice.id}`,
      "",
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
