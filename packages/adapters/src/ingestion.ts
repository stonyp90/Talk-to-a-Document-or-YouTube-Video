import path from "node:path";
import { pathToFileURL } from "node:url";
import { DOMMatrix } from "@napi-rs/canvas";
import type { PdfTextPort } from "../../core/src/application/ports";
import { InputValidationError } from "../../core/src/domain/ingestion";

/**
 * Translates the parser's own failures into the port's vocabulary: bytes that
 * carry a PDF header but no readable structure are the caller's input, and are
 * reported as such rather than as a server fault. Failures to load the parser
 * itself are left alone; those are ours.
 */
function unreadable(cause: unknown): never {
  throw new InputValidationError(
    "This file could not be read as a PDF. Export it again or choose another file.",
    "UNREADABLE_PDF",
    { cause },
  );
}

export function createPdfParser(publicDirectory: string): PdfTextPort {
  return {
    async extract(bytes) {
      globalThis.DOMMatrix =
        DOMMatrix as unknown as typeof globalThis.DOMMatrix;
      const { PDFParse } = await import("pdf-parse");
      PDFParse.setWorker(
        pathToFileURL(path.join(publicDirectory, "pdf.worker.mjs")).href,
      );
      const parser = new PDFParse({ data: bytes });
      try {
        return (await parser.getText()).pages
          .map((page) => page.text)
          .join("\n\n");
      } catch (cause) {
        return unreadable(cause);
      } finally {
        await parser.destroy();
      }
    },
  };
}
