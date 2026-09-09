/**
 * How much extracted source text is handed to the model as conversation context.
 *
 * The assessment allows a PDF of up to 25 MB and asks for no chunking, no
 * summarization and no citations. A 25 MB PDF can still hold far more text than
 * any model context window, so the source is windowed rather than rejected: the
 * reader always sees the complete extraction in the preview, and the model
 * receives the largest faithful excerpt that fits.
 */
export const DEFAULT_CONTEXT_CHARACTER_BUDGET = 120000;
const MIN_CONTEXT_CHARACTER_BUDGET = 1000;
const MAX_CONTEXT_CHARACTER_BUDGET = 1000000;

/** Share of the budget spent on the opening of the source; the rest holds its ending. */
const HEAD_SHARE = 0.7;

const ELISION =
  "\n\n[... a middle section of this source was omitted from this excerpt ...]\n\n";

export type ContextWindow = {
  /** The excerpt handed to the model. */
  text: string;
  /** Characters of the excerpt. */
  usedCharacters: number;
  /** Characters of the complete extraction. */
  totalCharacters: number;
  /** True when the excerpt is smaller than the extraction. */
  truncated: boolean;
};

/**
 * Reads a character budget supplied by configuration, falling back to the
 * default whenever the value is missing or unusable. The domain never reads the
 * environment itself; the composition root passes the raw value in.
 */
export function resolveContextBudget(raw: string | undefined | null): number {
  const parsed = Number(raw);
  if (!raw || !Number.isFinite(parsed) || parsed < MIN_CONTEXT_CHARACTER_BUDGET)
    return DEFAULT_CONTEXT_CHARACTER_BUDGET;
  return Math.min(Math.floor(parsed), MAX_CONTEXT_CHARACTER_BUDGET);
}

/**
 * Keeps the opening and the ending of a source. A document's framing and its
 * conclusions carry most of the answers, and a marked elision keeps the model
 * honest about the part it cannot see.
 */
export function buildContextWindow(
  text: string,
  budget: number = DEFAULT_CONTEXT_CHARACTER_BUDGET,
): ContextWindow {
  const totalCharacters = text.length;
  if (totalCharacters <= budget)
    return {
      text,
      usedCharacters: totalCharacters,
      totalCharacters,
      truncated: false,
    };

  const room = Math.max(0, budget - ELISION.length);
  const headLength = Math.floor(room * HEAD_SHARE);
  const tailLength = room - headLength;
  const excerpt =
    text.slice(0, headLength) + ELISION + text.slice(totalCharacters - tailLength);

  return {
    text: excerpt,
    usedCharacters: excerpt.length,
    totalCharacters,
    truncated: true,
  };
}
