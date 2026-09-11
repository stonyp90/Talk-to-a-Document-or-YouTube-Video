import { describe, expect, it } from "vitest";
import { SPOKEN_DELIVERY_GUIDANCE } from "./speech";
import { buildContextInstructions } from "./ingestion";

const source = {
  kind: "pdf" as const,
  sourceName: "guide.pdf",
  text: "The demo answer is forty-two.",
  characters: 29,
};

describe("spoken delivery", () => {
  it("tells the model how to sound when the answer is heard, not read", () => {
    const instructions = buildContextInstructions(source, undefined, "voice");
    for (const line of SPOKEN_DELIVERY_GUIDANCE)
      expect(instructions).toContain(line);
  });

  it("leaves written answers alone", () => {
    const instructions = buildContextInstructions(source);
    for (const line of SPOKEN_DELIVERY_GUIDANCE)
      expect(instructions).not.toContain(line);
  });

  it("still ends with the source text, so the untrusted material stays last", () => {
    expect(
      buildContextInstructions(source, undefined, "voice").endsWith(
        source.text,
      ),
    ).toBe(true);
  });

  it("asks for short spoken turns and no markup a listener cannot hear", () => {
    const guidance = SPOKEN_DELIVERY_GUIDANCE.join(" ");
    expect(guidance).toMatch(/markdown|bullet|heading/i);
    expect(guidance).toMatch(/sentence|short/i);
    expect(guidance).toMatch(/interrupt/i);
  });
});
