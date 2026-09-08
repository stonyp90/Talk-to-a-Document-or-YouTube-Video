import path from "node:path";
import { pathToFileURL } from "node:url";
import { DOMMatrix } from "@napi-rs/canvas";
import {
  InputValidationError,
  IngestedSource,
  normalizeExtractedText,
  validatePdf,
} from "@/src/domain/ingestion";
import { ingestYouTubeUrl } from "./providers";

export async function extractPdfText(file: { name: string; type?: string | null; size: number; arrayBuffer(): Promise<ArrayBuffer> }): Promise<IngestedSource> {
  validatePdf(file);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0,5).toString() !== "%PDF-") throw new InputValidationError("This file is not a valid PDF.", "INVALID_FILE_TYPE");
  globalThis.DOMMatrix = DOMMatrix as unknown as typeof globalThis.DOMMatrix;
  const { PDFParse } = await import("pdf-parse");
  PDFParse.setWorker(pathToFileURL(path.join(process.cwd(), "public", "pdf.worker.mjs")).href);
  const parser = new PDFParse({ data: bytes });
  let text: string;
  try { const parsed = await parser.getText(); text = normalizeExtractedText(parsed.pages.map(page => page.text).join("\n\n")); }
  finally { await parser.destroy(); }
  if (!text) throw new InputValidationError("This PDF does not contain extractable text.", "EMPTY_PDF");
  return { kind: "pdf", sourceName: file.name, text, characters: text.length };
}

export async function ingestFormData(formData: FormData): Promise<IngestedSource> {
  const file = formData.get("file");
  if (file instanceof File) return extractPdfText(file);
  const url = formData.get("url");
  if (typeof url === "string" && url.trim()) return ingestYouTubeUrl(url);
  throw new InputValidationError("Choose a PDF or enter a YouTube URL.", "SOURCE_REQUIRED");
}
