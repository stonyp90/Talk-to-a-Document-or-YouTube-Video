import { describe, it, expect } from "vitest";
import { ingestText } from "./textAdapter";

describe("ingestText", () => {
  it("ingests plain text", () => {
    const result = ingestText(
      new TextEncoder().encode("Hello world"),
      "hello.txt",
    );
    expect(result.kind).toBe("text");
    expect(result.text).toBe("Hello world");
    expect(result.sourceName).toBe("hello.txt");
  });

  it("ingests markdown", () => {
    const result = ingestText(
      new TextEncoder().encode("# Title\n\nBody"),
      "doc.md",
    );
    expect(result.kind).toBe("text");
    expect(result.text).toContain("# Title");
  });

  it("ingests CSV", () => {
    const csv = "name,age\nAlice,30\nBob,25";
    const result = ingestText(new TextEncoder().encode(csv), "data.csv");
    expect(result.kind).toBe("text");
    expect(result.characters).toBe(csv.length);
  });

  it("ingests JSON", () => {
    const json = '{"key": "value"}';
    const result = ingestText(new TextEncoder().encode(json), "data.json");
    expect(result.kind).toBe("text");
  });
});
