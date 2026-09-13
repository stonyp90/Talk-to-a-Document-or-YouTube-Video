import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROCESS_LOCALE,
  INNER_LOOP_STEP,
  PROCESS_STEP_IDS,
  processCopy,
  resolveProcessCopy,
  type ProcessCopy,
} from "./process";

const locales = Object.keys(processCopy) as Array<keyof typeof processCopy>;

function strings(value: unknown, path: string[] = []): Array<[string, string]> {
  if (typeof value === "string") return [[path.join("."), value]];
  if (Array.isArray(value))
    return value.flatMap((item, index) =>
      strings(item, [...path, String(index)]),
    );
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([key, item]) =>
      strings(item, [...path, key]),
    );
  return [];
}

describe("process copy", () => {
  it("walks the loop in one canonical order for every locale", () => {
    expect(PROCESS_STEP_IDS).toEqual([
      "concept",
      "plan",
      "tools",
      "local",
      "test",
      "secure",
      "deliver",
      "production",
      "sustain",
      "listen",
      "train",
    ]);
    expect(PROCESS_STEP_IDS).toContain(INNER_LOOP_STEP);
    for (const locale of locales)
      expect(processCopy[locale].steps.map((step) => step.id)).toEqual(
        PROCESS_STEP_IDS,
      );
  });

  it("translates every English key, leaving nothing blank", () => {
    const source = strings(processCopy.en);
    for (const locale of locales) {
      const translated = strings(processCopy[locale]);
      expect(translated.map(([key]) => key)).toEqual(
        source.map(([key]) => key),
      );
      for (const [key, text] of translated)
        expect(text.trim(), `${locale}: ${key}`).not.toBe("");
    }
  });

  it("falls back to English for unsupported locales", () => {
    expect(DEFAULT_PROCESS_LOCALE).toBe("en");
    expect(resolveProcessCopy()).toBe(processCopy.en);
    expect(resolveProcessCopy("de-CH")).toBe(processCopy.en);
    expect(resolveProcessCopy("fr")).toBe(processCopy.fr);
    expect(resolveProcessCopy("fr-CA")).toBe(processCopy.fr);
    expect(resolveProcessCopy("EN-GB")).toBe(processCopy.en);
  });

  it("makes design, build, release, operation and continuous security explicit", () => {
    const step = (copy: ProcessCopy, id: string) =>
      copy.steps.find((candidate) => candidate.id === id)!.summary;
    expect(processCopy.en.steps.map((item) => item.title)).toEqual([
      "Concept",
      "Plan",
      "Design",
      "Build",
      "Integrate",
      "Validate",
      "Release",
      "Operate",
      "Measure",
      "Listen",
      "Improve",
    ]);
    expect(step(processCopy.en, "secure")).toMatch(
      /quality, privacy, and security and compliance throughout/i,
    );
    expect(step(processCopy.en, "deliver")).toMatch(/reversible/i);
    expect(step(processCopy.fr, "secure")).toMatch(
      /qualité, la confidentialité et la sécurité/i,
    );
    expect(step(processCopy.fr, "deliver")).toMatch(/réversible/i);
  });

  it("keeps pricing and data-use policy out of the development stages", () => {
    const summaries = processCopy.en.steps.map((step) => step.summary).join(" ");
    expect(summaries).not.toMatch(/free|paid|train the models/i);
    expect(processCopy.en.innerLoop).toMatch(/measure/i);
    expect(processCopy.en.innerLoop).toMatch(/return directly/i);
  });

  it("states the mission as a bridge between today's and tomorrow's internet", () => {
    expect(processCopy.en.mission.heading).toMatch(/internet/i);
    expect(processCopy.en.mission.body).toMatch(/voice/i);
    expect(processCopy.en.mission.body).toMatch(/gesture/i);
    expect(processCopy.fr.mission.body).toMatch(/voix/i);
  });

  it("describes improvement as a return path rather than mandatory model training", () => {
    const train = (copy: ProcessCopy) =>
      copy.steps.find((step) => step.id === INNER_LOOP_STEP)!;
    expect(train(processCopy.en).summary).toMatch(/return the work to the stage/i);
    expect(processCopy.en.innerLoop).toMatch(/evaluate/i);
    expect(processCopy.fr.innerLoop).toMatch(/revenir directement/i);
  });
});
