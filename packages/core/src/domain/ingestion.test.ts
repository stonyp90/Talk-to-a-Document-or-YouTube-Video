import { describe, expect, it } from "vitest";
import {
  InputValidationError,
  MAX_PDF_BYTES,
  buildContextInstructions,
  normalizeExtractedText,
  parseYouTubeVideoId,
  validatePdf,
} from "./ingestion";

describe("ingestion domain", () => {
  it.each([0, -1, NaN, Infinity, 1.5])(
    "rejects invalid PDF size %s",
    (size) => {
      expect(() => validatePdf({ name: "source.pdf", size })).toThrowError(
        InputValidationError,
      );
    },
  );

  it.each([
    "ftp://youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=shortid",
    "https://youtube.com/watch?v=dQw4w9WgXcQextra",
  ])("rejects invalid video URL %s", (url) => {
    expect(() => parseYouTubeVideoId(url)).toThrowError(InputValidationError);
  });
  it("accepts a PDF at exactly 25 MB", () => {
    expect(() =>
      validatePdf({
        name: "source.pdf",
        type: "application/pdf",
        size: MAX_PDF_BYTES,
      }),
    ).not.toThrow();
  });

  it("rejects oversized PDFs", () => {
    expect(() =>
      validatePdf({
        name: "source.pdf",
        type: "application/pdf",
        size: MAX_PDF_BYTES + 1,
      }),
    ).toThrowError("PDF files must be 25 MB or smaller.");
  });

  it("rejects non-PDF inputs", () => {
    expect(() =>
      validatePdf({ name: "notes.txt", type: "text/plain", size: 10 }),
    ).toThrowError(InputValidationError);
  });

  it("extracts IDs from supported YouTube URLs", () => {
    expect(
      parseYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("rejects unrelated URLs", () => {
    expect(() =>
      parseYouTubeVideoId("https://example.com/watch?v=dQw4w9WgXcQ"),
    ).toThrowError("Enter a valid YouTube URL");
  });

  it("normalizes extracted text without changing content meaning", () => {
    expect(normalizeExtractedText(" Hello\t\n\n\nworld \u0000")).toBe(
      "Hello\n\nworld",
    );
  });

  it("builds context instructions from the source", () => {
    expect(
      buildContextInstructions({
        kind: "pdf",
        sourceName: "guide.pdf",
        text: "The answer is 42.",
        characters: 17,
      }),
    ).toContain("The answer is 42.");
  });

  it.each([
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/live/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/v/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://music.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?t=42", "dQw4w9WgXcQ"],
    [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1234567890&index=3",
      "dQw4w9WgXcQ",
    ],
    ["youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["  https://www.youtube.com/watch?v=dQw4w9WgXcQ  ", "dQw4w9WgXcQ"],
  ])("accepts the YouTube link shape %s", (url, id) => {
    expect(parseYouTubeVideoId(url)).toBe(id);
  });

  it.each([
    "https://www.youtube.com/playlist?list=PL1234567890",
    "https://www.youtube.com/@channel",
    "https://vimeo.com/watch?v=dQw4w9WgXcQ",
  ])("still rejects the non-video link %s", (url) => {
    expect(() => parseYouTubeVideoId(url)).toThrowError(InputValidationError);
  });

  it("windows an oversized source instead of refusing it", () => {
    const text = `START${"filler ".repeat(40000)}FINISH`;
    const instructions = buildContextInstructions(
      { kind: "pdf", sourceName: "long.pdf", text, characters: text.length },
      5000,
    );
    expect(instructions).toContain("START");
    expect(instructions).toContain("FINISH");
    expect(instructions).toContain("omitted middle");
  });

  it("still refuses an empty source", () => {
    expect(() =>
      buildContextInstructions({
        kind: "pdf",
        sourceName: "blank.pdf",
        text: "   ",
        characters: 3,
      }),
    ).toThrowError(InputValidationError);
  });
});
