import { describe, expect, it } from "vitest";
import { parseMarkdown, type MarkdownBlock } from "./markdown";

const blocks = (text: string): MarkdownBlock[] => parseMarkdown(text);

describe("parseMarkdown", () => {
  it("keeps ordinary prose as a single paragraph", () => {
    expect(blocks("Just a sentence.")).toEqual([
      {
        type: "paragraph",
        spans: [{ type: "text", text: "Just a sentence." }],
      },
    ]);
  });

  it("splits paragraphs on a blank line", () => {
    const parsed = blocks("First.\n\nSecond.");
    expect(parsed).toHaveLength(2);
    expect(parsed.every((block) => block.type === "paragraph")).toBe(true);
  });

  it("joins a soft-wrapped paragraph into one flowing line", () => {
    expect(blocks("one\ntwo")).toEqual([
      { type: "paragraph", spans: [{ type: "text", text: "one two" }] },
    ]);
  });

  it("reads a heading and its level", () => {
    expect(blocks("## Key ideas")).toEqual([
      {
        type: "heading",
        level: 2,
        spans: [{ type: "text", text: "Key ideas" }],
      },
    ]);
  });

  it("caps heading depth so an answer cannot outrank the page", () => {
    const [block] = blocks("####### deep");
    expect(block).toEqual({
      type: "paragraph",
      spans: [{ type: "text", text: "####### deep" }],
    });
  });

  it("collects consecutive bullets into one list", () => {
    expect(blocks("- one\n- two")).toEqual([
      {
        type: "list",
        ordered: false,
        items: [
          [{ type: "text", text: "one" }],
          [{ type: "text", text: "two" }],
        ],
      },
    ]);
  });

  it("reads a numbered list and remembers its start", () => {
    const [block] = blocks("3. third\n4. fourth");
    expect(block).toMatchObject({ type: "list", ordered: true, start: 3 });
  });

  it("keeps a fenced code block verbatim, including its blank lines", () => {
    expect(blocks("```ts\nconst a = 1;\n\nconst b = 2;\n```")).toEqual([
      { type: "code", language: "ts", text: "const a = 1;\n\nconst b = 2;" },
    ]);
  });

  it("closes an unterminated fence at the end of a streaming answer", () => {
    expect(blocks("```\nhalf a line")).toEqual([
      { type: "code", language: "", text: "half a line" },
    ]);
  });

  it("reads bold, italic and inline code inside a paragraph", () => {
    expect(blocks("a **b** c *d* e `f`")).toEqual([
      {
        type: "paragraph",
        spans: [
          { type: "text", text: "a " },
          { type: "strong", text: "b" },
          { type: "text", text: " c " },
          { type: "emphasis", text: "d" },
          { type: "text", text: " e " },
          { type: "code", text: "f" },
        ],
      },
    ]);
  });

  it("leaves an unclosed emphasis marker as plain text while it streams", () => {
    expect(blocks("half **way")).toEqual([
      { type: "paragraph", spans: [{ type: "text", text: "half **way" }] },
    ]);
  });

  it("reads a link and keeps its destination", () => {
    expect(blocks("see [docs](https://example.com/a)")).toEqual([
      {
        type: "paragraph",
        spans: [
          { type: "text", text: "see " },
          { type: "link", text: "docs", href: "https://example.com/a" },
        ],
      },
    ]);
  });

  it("refuses a script-bearing link and keeps its words", () => {
    expect(blocks("[click](javascript:alert(1))")).toEqual([
      {
        type: "paragraph",
        spans: [{ type: "text", text: "click" }],
      },
    ]);
  });

  it("keeps raw HTML as text rather than markup", () => {
    expect(blocks("<img src=x onerror=alert(1)>")).toEqual([
      {
        type: "paragraph",
        spans: [{ type: "text", text: "<img src=x onerror=alert(1)>" }],
      },
    ]);
  });

  it("returns nothing for an empty answer", () => {
    expect(blocks("   \n  ")).toEqual([]);
  });
});
