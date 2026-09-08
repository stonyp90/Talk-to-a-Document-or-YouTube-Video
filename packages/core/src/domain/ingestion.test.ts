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
    ).toThrowError("Enter a valid YouTube URL.");
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
});
