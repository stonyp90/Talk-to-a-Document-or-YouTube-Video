import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findVoiceTriggerMatches,
  normalizeVoiceText,
} from "../src/voiceCommandMatcher";

const triggers = [
  { id: "youtube", phrase: "YouTube", action: "youtube" },
  { id: "cancel", phrase: "cancel", action: "cancel" },
  { id: "next", phrase: "next", action: "next" },
];

test("normalizes natural speech without changing its words", () => {
  assert.equal(normalizeVoiceText("  Hey, YouTube!  "), "hey youtube");
});

test("finds trigger words inside a sentence in the order spoken", () => {
  assert.deepEqual(
    findVoiceTriggerMatches(
      "Hey YouTube, switch to YouTube, cancel that, then next",
      triggers,
    ).map((trigger) => trigger.id),
    ["youtube", "cancel", "next"],
  );
});

test("does not trigger on a word fragment", () => {
  assert.deepEqual(
    findVoiceTriggerMatches("the next-generation video", triggers),
    [],
  );
});
