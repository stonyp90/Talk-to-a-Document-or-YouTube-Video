/**
 * A small Markdown reader for assistant answers. Models write lists, headings
 * and code whether or not anyone asked, and a chat that prints the asterisks is
 * harder to read than one that does not. Parsing to a description of the text —
 * never to HTML — keeps the renderer free of `dangerouslySetInnerHTML`, so a
 * source that quotes markup cannot turn into markup.
 *
 * It is deliberately partial. Answers stream in, so every rule here has to give
 * a sensible reading of a half-finished document: an unclosed fence is still a
 * code block, and an unmatched asterisk is still a word.
 */

/** Beyond this depth a heading would outrank the page's own structure. */
const MAX_HEADING_LEVEL = 6;

/** Link schemes that cannot execute script when a reader follows them. */
const SAFE_LINK_SCHEMES = ["http:", "https:", "mailto:"];

export type MarkdownSpan =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "emphasis"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; text: string; href: string };

export type MarkdownBlock =
  | { type: "paragraph"; spans: MarkdownSpan[] }
  | { type: "heading"; level: number; spans: MarkdownSpan[] }
  | { type: "list"; ordered: boolean; start?: number; items: MarkdownSpan[][] }
  | { type: "code"; language: string; text: string };

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*(\d{1,9})[.)]\s+(.*)$/;
const FENCE = /^\s*```(.*)$/;

/**
 * Matches the first inline marker in a line, whichever kind comes first. A link
 * destination may carry one balanced pair of parentheses, because real URLs do.
 */
const INLINE =
  /(\[([^\]\n]*)\]\(((?:[^()\s]|\([^()\s]*\))*)\))|(\*\*([^*\n]+)\*\*)|(\*([^*\n]+)\*)|(`([^`\n]+)`)/;

function safeHref(raw: string): string | undefined {
  try {
    // A relative destination has no scheme to distrust; the base is only a lens.
    const url = new URL(raw, "https://ursly.invalid/");
    return SAFE_LINK_SCHEMES.includes(url.protocol) ? raw : undefined;
  } catch {
    return undefined;
  }
}

function pushText(spans: MarkdownSpan[], text: string): void {
  if (!text) return;
  const last = spans.at(-1);
  if (last?.type === "text") last.text += text;
  else spans.push({ type: "text", text });
}

/** Reads one line of prose into spans, leaving unmatched markers as words. */
export function parseInline(line: string): MarkdownSpan[] {
  const spans: MarkdownSpan[] = [];
  let rest = line;
  for (let match = INLINE.exec(rest); match; match = INLINE.exec(rest)) {
    pushText(spans, rest.slice(0, match.index));
    const [whole, , linkText, linkHref, , strong, , emphasis, , code] = match;
    if (linkText !== undefined) {
      const href = safeHref(linkHref ?? "");
      if (href) spans.push({ type: "link", text: linkText, href });
      else pushText(spans, linkText);
    } else if (strong !== undefined)
      spans.push({ type: "strong", text: strong });
    else if (emphasis !== undefined)
      spans.push({ type: "emphasis", text: emphasis });
    else if (code !== undefined) spans.push({ type: "code", text: code });
    rest = rest.slice(match.index + whole.length);
  }
  pushText(spans, rest);
  return spans;
}

export function parseMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  let paragraph: string[] = [];

  const flushParagraph = () => {
    const text = paragraph.join(" ").trim();
    paragraph = [];
    if (text) blocks.push({ type: "paragraph", spans: parseInline(text) });
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";

    const fence = FENCE.exec(line);
    if (fence) {
      flushParagraph();
      const body: string[] = [];
      index++;
      // A stream can end mid-block; the closing fence is optional on purpose.
      while (index < lines.length && !FENCE.test(lines[index] ?? "")) {
        body.push(lines[index] ?? "");
        index++;
      }
      blocks.push({
        type: "code",
        language: (fence[1] ?? "").trim(),
        text: body.join("\n").replace(/\n+$/, ""),
      });
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    const heading = HEADING.exec(line);
    // A seventh hash is not a heading in any dialect; it stays prose.
    if (heading && !line.startsWith("#".repeat(MAX_HEADING_LEVEL + 1))) {
      flushParagraph();
      blocks.push({
        type: "heading",
        level: heading[1]?.length ?? 1,
        spans: parseInline((heading[2] ?? "").trim()),
      });
      continue;
    }

    const bullet = BULLET.exec(line);
    const numbered = NUMBERED.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      const previous = blocks.at(-1);
      const item = parseInline(
        ((ordered ? numbered?.[2] : bullet?.[1]) ?? "").trim(),
      );
      if (previous?.type === "list" && previous.ordered === ordered)
        previous.items.push(item);
      else
        blocks.push({
          type: "list",
          ordered,
          ...(ordered ? { start: Number(numbered?.[1] ?? 1) } : {}),
          items: [item],
        });
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  return blocks;
}
