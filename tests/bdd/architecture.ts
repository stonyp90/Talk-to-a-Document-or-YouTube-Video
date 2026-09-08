import assert from "node:assert/strict";
import { createIngestion } from "../../packages/core/src/application/ingestion";
import type { IngestedSource } from "../../packages/core/src/domain/ingestion";
import type { TranscriptPort } from "../../packages/core/src/application/ports";
import type { Step, World } from "./steps";

export function registerArchitectureChecks(step: Step) {
  const states = new WeakMap<
    World,
    { adapters: TranscriptPort[]; results: IngestedSource[] }
  >();
  step("two interchangeable transcript adapters", function () {
    states.set(this, {
      adapters: [
        {
          getTranscript: async () => ({
            title: "Source",
            text: " text from adapter A ",
          }),
        },
        {
          getTranscript: async () => ({
            title: "Source",
            text: " text from adapter B ",
          }),
        },
      ],
      results: [],
    });
  });
  step(
    "the same YouTube source is ingested through each adapter",
    async function () {
      const state = states.get(this)!;
      const unused = async (): Promise<never> => {
        throw new Error("Unrelated port must not be called");
      };
      for (const transcripts of state.adapters) {
        const app = createIngestion({
          transcripts,
          pdf: { extract: unused },
          uploads: { prepare: unused, read: unused, delete: unused },
        });
        state.results.push(await app.youtube("https://youtu.be/abcdefghijk"));
      }
    },
  );
  step(
    "both return the shared source model without changing the use case",
    function () {
      const results = states.get(this)!.results;
      assert.equal(results.length, 2);
      for (const [index, result] of results.entries()) {
        assert.deepEqual(result, {
          kind: "youtube",
          sourceName: "Source",
          text: `text from adapter ${index === 0 ? "A" : "B"}`,
          characters: 19,
        });
      }
    },
  );
}
