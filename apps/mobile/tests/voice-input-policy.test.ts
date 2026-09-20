import assert from "node:assert/strict";
import test from "node:test";
import { voiceSilenceTimeoutMs } from "../src/voiceInputPolicy";

test("explicit merged QA input stays armed across long simulator setup", () => {
  assert.equal(
    voiceSilenceTimeoutMs({ merged: true, testMode: true }),
    undefined,
  );
});

test("real microphone input retains its silence deadline", () => {
  assert.equal(
    voiceSilenceTimeoutMs({ merged: true, testMode: false }),
    120_000,
  );
  assert.equal(
    voiceSilenceTimeoutMs({ merged: false, testMode: false }),
    8_000,
  );
});

test("the QA flag does not remove the old panel's physical microphone deadline", () => {
  assert.equal(voiceSilenceTimeoutMs({ merged: false, testMode: true }), 8_000);
});
