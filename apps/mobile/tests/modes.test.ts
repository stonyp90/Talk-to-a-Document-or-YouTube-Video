import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chooseMode,
  DEFAULT_MODE,
  MODES,
  MODE_STORAGE_KEY,
  parseSavedMode,
} from "../src/modes";
import { translate } from "../src/i18n";

test("Sense combines human inputs as the default, matching the web choices", () => {
  assert.equal(DEFAULT_MODE, "human");
  assert.deepEqual(
    MODES.map((mode) => mode.id),
    ["human", "text", "brain"],
  );
  assert.equal(MODES[0].label, "Sense");
  assert.equal(MODES[0].detail, undefined);
  assert.equal(MODES[1].label, "Keyboard to action");
  assert.equal(MODES[1].detail, "Legacy");
});

test("Brain stays visible with its Beta label and cannot change the active input", () => {
  const brain = MODES.find((mode) => mode.id === "brain");
  assert.equal(brain?.available, false);
  assert.equal(brain?.detail, "Beta");
  const chosen = chooseMode("text", "brain");
  assert.equal(chosen.mode, "text");
  assert.match(chosen.notice, /not available yet/);
});

test("choosing Sense or Keyboard keeps a usable active mode", () => {
  assert.deepEqual(chooseMode("human", "text"), {
    mode: "text",
    notice: "Keyboard to action: everything works by typing and clicking.",
  });
  assert.deepEqual(chooseMode("text", "human"), {
    mode: "human",
    notice: "Sense: speak, move, or type in one experience.",
  });
});

test("saved separate voice and motion choices migrate to Sense without changing the storage key", () => {
  assert.equal(MODE_STORAGE_KEY, "ursly-mode-v1");
  assert.equal(parseSavedMode("text"), "text");
  for (const saved of [
    "human",
    "voice",
    "motion",
    "brain",
    "gesture",
    null,
    undefined,
  ]) {
    assert.equal(parseSavedMode(saved), "human");
  }
});

test("every mode label has an explicit French translation", () => {
  for (const mode of MODES) {
    assert.notEqual(translate("fr", mode.label), mode.label);
    assert.notEqual(translate("fr", mode.short), mode.short);
    if (mode.detail) assert.notEqual(translate("fr", mode.detail), mode.detail);
  }
});
