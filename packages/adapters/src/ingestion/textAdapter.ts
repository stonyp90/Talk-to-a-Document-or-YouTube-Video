import { normalizeExtractedText } from "../../../core/src/domain/ingestion";

export type TextIngestedSource = {
  kind: "text";
  sourceName: string;
  text: string;
  characters: number;
};

export function ingestText(
  bytes: Uint8Array,
  fileName: string,
): TextIngestedSource {
  const text = normalizeExtractedText(new TextDecoder().decode(bytes));
  return {
    kind: "text",
    sourceName: fileName,
    text,
    characters: text.length,
  };
}
