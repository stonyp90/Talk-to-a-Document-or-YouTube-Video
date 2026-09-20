import { describe, it, expect } from "vitest";
import { validateFile, MAX_FILE_BYTES } from "./ingestion";

describe("validateFile", () => {
  it("accepts txt files", () => {
    expect(() =>
      validateFile({ name: "test.txt", type: "text/plain", size: 1000 }),
    ).not.toThrow();
  });

  it("accepts md files", () => {
    expect(() =>
      validateFile({
        name: "test.md",
        type: "text/markdown",
        size: 1000,
      }),
    ).not.toThrow();
  });

  it("accepts docx files", () => {
    expect(() =>
      validateFile({
        name: "test.docx",
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: 1000,
      }),
    ).not.toThrow();
  });

  it("accepts csv files", () => {
    expect(() =>
      validateFile({ name: "test.csv", type: "text/csv", size: 1000 }),
    ).not.toThrow();
  });

  it("accepts json files", () => {
    expect(() =>
      validateFile({
        name: "test.json",
        type: "application/json",
        size: 1000,
      }),
    ).not.toThrow();
  });

  it("rejects files over 100MB", () => {
    expect(() =>
      validateFile({
        name: "big.txt",
        type: "text/plain",
        size: 101 * 1024 * 1024,
      }),
    ).toThrow();
  });

  it("rejects unknown extensions", () => {
    expect(() =>
      validateFile({
        name: "test.exe",
        type: "application/octet-stream",
        size: 1000,
      }),
    ).toThrow();
  });
});
