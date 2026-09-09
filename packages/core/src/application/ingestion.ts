import {
  InputValidationError,
  normalizeExtractedText,
  parseYouTubeVideoId,
  validatePdf,
  type IngestedSource,
} from "../domain/ingestion";
import type {
  PdfMetadata,
  PdfTextPort,
  TemporaryUploadPort,
  TranscriptPort,
} from "./ports";

export function createIngestion(ports: {
  pdf: PdfTextPort;
  transcripts: TranscriptPort;
  uploads: TemporaryUploadPort;
}) {
  async function pdf(
    file: PdfMetadata,
    bytes: Uint8Array,
  ): Promise<IngestedSource> {
    validatePdf({ name: file.name, type: file.type, size: bytes.length });
    if (file.size !== bytes.length)
      throw new InputValidationError(
        "PDF size does not match its contents.",
        "INVALID_FILE_SIZE",
      );
    if (String.fromCharCode(...bytes.subarray(0, 5)) !== "%PDF-")
      throw new InputValidationError(
        "This file is not a valid PDF.",
        "INVALID_FILE_TYPE",
      );
    const text = normalizeExtractedText(await ports.pdf.extract(bytes));
    if (!text)
      throw new InputValidationError(
        "This PDF does not contain extractable text.",
        "EMPTY_PDF",
      );
    return {
      kind: "pdf",
      sourceName: file.name,
      text,
      characters: text.length,
    };
  }
  return {
    pdf,
    async youtube(url: string): Promise<IngestedSource> {
      const transcript = await ports.transcripts.getTranscript(
        parseYouTubeVideoId(url),
      );
      const text = normalizeExtractedText(transcript.text);
      if (!text)
        throw new InputValidationError(
          "No captions are available for this video.",
          "TRANSCRIPT_UNAVAILABLE",
        );
      return {
        kind: "youtube",
        sourceName: transcript.title,
        text,
        characters: text.length,
      };
    },
    async prepareUpload(file: PdfMetadata) {
      validatePdf(file);
      return ports.uploads.prepare(file);
    },
    async upload(key: string, name: string) {
      if (!/^uploads\/[a-f0-9-]{36}\.pdf$/.test(key))
        throw new InputValidationError(
          "Invalid upload reference.",
          "INVALID_UPLOAD_REFERENCE",
        );
      try {
        let bytes: Uint8Array;
        try {
          bytes = await ports.uploads.read(key);
        } catch {
          // The object is gone: expired, or this key was already consumed.
          // That is the caller's situation to fix, not a server fault, and the
          // storage error must not reach them.
          throw new InputValidationError(
            "This upload is no longer available. Please upload the PDF again.",
            "UPLOAD_UNAVAILABLE",
          );
        }
        return await pdf(
          { name, type: "application/pdf", size: bytes.length },
          bytes,
        );
      } finally {
        await ports.uploads.delete(key);
      }
    },
  };
}
