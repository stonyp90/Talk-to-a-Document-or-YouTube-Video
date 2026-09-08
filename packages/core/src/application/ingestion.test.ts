import { expect, it, vi } from "vitest";
import { createIngestion } from "./ingestion";

const bytes = new TextEncoder().encode("%PDF-fixture");
const key = "uploads/12345678-1234-1234-1234-123456789abc.pdf";
function fixture() {
  const pdf = { extract: vi.fn().mockResolvedValue("  source text  ") };
  const transcripts = {
    getTranscript: vi
      .fn()
      .mockResolvedValue({ title: "Video", text: " captions " }),
  };
  const uploads = {
    prepare: vi.fn(),
    read: vi.fn().mockResolvedValue(bytes),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  return {
    pdf,
    transcripts,
    uploads,
    app: createIngestion({ pdf, transcripts, uploads }),
  };
}
it("extracts and normalizes a PDF using an injected parser", async () => {
  const { app, pdf } = fixture();
  expect(
    await app.pdf({ name: "file.pdf", size: bytes.length }, bytes),
  ).toEqual({
    kind: "pdf",
    sourceName: "file.pdf",
    text: "source text",
    characters: 11,
  });
  expect(pdf.extract).toHaveBeenCalledWith(bytes);
});
it("rejects invalid PDF content before calling the parser", async () => {
  const { app, pdf } = fixture();
  await expect(
    app.pdf({ name: "file.pdf", size: 5 }, new TextEncoder().encode("hello")),
  ).rejects.toThrow("not a valid PDF");
  expect(pdf.extract).not.toHaveBeenCalled();
});
it("validates YouTube identifiers before using the transcript port", async () => {
  const { app, transcripts } = fixture();
  await expect(
    app.youtube("https://example.com/watch?v=abcdefghijk"),
  ).rejects.toThrow();
  expect(transcripts.getTranscript).not.toHaveBeenCalled();
  expect(await app.youtube("https://youtu.be/abcdefghijk")).toMatchObject({
    text: "captions",
    characters: 8,
  });
});
it.each([false, true])(
  "removes temporary uploads even when extraction fails: %s",
  async (fail) => {
    const { app, pdf, uploads } = fixture();
    if (fail) pdf.extract.mockRejectedValue(new Error("parser unavailable"));
    if (fail)
      await expect(app.upload(key, "file.pdf")).rejects.toThrow(
        "parser unavailable",
      );
    else
      await expect(app.upload(key, "file.pdf")).resolves.toMatchObject({
        text: "source text",
      });
    expect(uploads.delete).toHaveBeenCalledWith(key);
  },
);
it("rejects arbitrary object references without reading or deleting storage", async () => {
  const { app, uploads } = fixture();
  await expect(app.upload("private/key", "file.pdf")).rejects.toThrow(
    "Invalid upload reference",
  );
  expect(uploads.read).not.toHaveBeenCalled();
  expect(uploads.delete).not.toHaveBeenCalled();
});
