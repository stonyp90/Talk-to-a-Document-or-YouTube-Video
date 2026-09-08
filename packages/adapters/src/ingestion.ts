import path from "node:path";
import { pathToFileURL } from "node:url";
import { DOMMatrix } from "@napi-rs/canvas";
import type { PdfTextPort } from "../../core/src/application/ports";

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
      } finally {
        await parser.destroy();
      }
    },
  };
}
