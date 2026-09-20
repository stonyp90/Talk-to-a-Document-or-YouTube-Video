// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Markdown } from "./Markdown";
import { parseMarkdown, parseInline } from "@/apps/web/src/lib/markdown";

afterEach(cleanup);

/**
 * The Markdown component renders assistant answers. It never touches
 * `dangerouslySetInnerHTML`; the parser produces a description of the text and
 * the renderer turns that into elements, so a source that quotes markup
 * renders it as words rather than as structure.
 */
describe("Markdown", () => {
  describe("basic rendering", () => {
    it("renders a paragraph of plain text", () => {
      render(<Markdown text="Hello world" />);
      expect(screen.getByText("Hello world")).toBeInTheDocument();
    });

    it("renders bold text inside a strong element", () => {
      const { container } = render(<Markdown text="**important**" />);
      const strong = container.querySelector("strong");
      expect(strong).not.toBeNull();
      expect(strong!.textContent).toBe("important");
    });

    it("renders italic text inside an em element", () => {
      const { container } = render(<Markdown text="*careful*" />);
      const em = container.querySelector("em");
      expect(em).not.toBeNull();
      expect(em!.textContent).toBe("careful");
    });

    it("renders inline code inside a code element", () => {
      const { container } = render(<Markdown text="Use `console.log`" />);
      const code = container.querySelector("code");
      expect(code).not.toBeNull();
      expect(code!.textContent).toBe("console.log");
    });

    it("renders a heading at the correct level", () => {
      const { container } = render(<Markdown text="## Section" />);
      // A heading level is offset by two so it never outranks the page.
      const heading = container.querySelector("h4");
      expect(heading).not.toBeNull();
      expect(heading!.textContent).toBe("Section");
    });
  });

  describe("code blocks", () => {
    it("renders a fenced block with its language", () => {
      const input = "```typescript\nconst x = 1;\n```";
      const { container } = render(<Markdown text={input} />);
      const pre = container.querySelector("pre");
      expect(pre).not.toBeNull();
      expect(pre).toHaveAttribute("data-language", "typescript");
      const code = pre!.querySelector("code");
      expect(code).not.toBeNull();
      expect(code!.textContent).toBe("const x = 1;");
    });

    it("renders an unclosed fence as a code block for streaming answers", () => {
      const input = "```python\nprint('hi')";
      const { container } = render(<Markdown text={input} />);
      const pre = container.querySelector("pre");
      expect(pre).not.toBeNull();
      expect(pre).toHaveAttribute("data-language", "python");
    });
  });

  describe("links", () => {
    it("renders a link with safe attributes for external destinations", () => {
      const { container } = render(
        <Markdown text="[example](https://example.com)" />,
      );
      const anchor = container.querySelector("a");
      expect(anchor).not.toBeNull();
      expect(anchor).toHaveAttribute("href", "https://example.com");
      expect(anchor).toHaveAttribute("target", "_blank");
      expect(anchor).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  describe("lists", () => {
    it("renders an unordered list", () => {
      const input = "- one\n- two\n- three";
      const { container } = render(<Markdown text={input} />);
      const ul = container.querySelector("ul");
      expect(ul).not.toBeNull();
      const items = ul!.querySelectorAll("li");
      expect(items).toHaveLength(3);
    });

    it("renders an ordered list with its starting number", () => {
      const input = "3. first\n4. second";
      const { container } = render(<Markdown text={input} />);
      const ol = container.querySelector("ol");
      expect(ol).not.toBeNull();
      expect(ol).toHaveAttribute("start", "3");
      const items = ol!.querySelectorAll("li");
      expect(items).toHaveLength(2);
    });
  });

  describe("XSS prevention", () => {
    it("escapes HTML tags so they render as text rather than elements", () => {
      const { container } = render(<Markdown text="<script>alert(1)</script>" />);
      expect(container.querySelector("script")).toBeNull();
      expect(container.textContent).toContain("<script>alert(1)</script>");
    });

    it("drops javascript: URLs from links", () => {
      const { container } = render(
        <Markdown text="[click](javascript:alert(1))" />,
      );
      const anchor = container.querySelector("a");
      // The unsafe scheme is not among the safe ones, so the link degrades
      // to plain text rather than carrying a dangerous destination.
      expect(anchor).toBeNull();
      expect(container.textContent).toContain("click");
    });

    it("renders event handlers as plain text, not attributes", () => {
      const { container } = render(
        <Markdown text='<img onerror="alert(1)" src="x" />' />,
      );
      const img = container.querySelector("img");
      expect(img).toBeNull();
      // The source text is preserved literally as words.
      expect(container.textContent).toContain("onerror");
    });

    it("never produces dangerouslySetInnerHTML in its output", () => {
      const { container } = render(
        <Markdown text='**bold** <div onclick="x">text</div>' />,
      );
      // No element in the output should carry an event handler attribute.
      const allElements = container.querySelectorAll("*");
      for (const element of allElements) {
        for (const attr of element.attributes) {
          expect(attr.name.startsWith("on")).toBe(false);
        }
      }
    });
  });

  describe("heading offset", () => {
    it("pushes an h1 down to h3 so it never outranks the page", () => {
      const { container } = render(<Markdown text="# Top" />);
      expect(container.querySelector("h1")).toBeNull();
      expect(container.querySelector("h3")).not.toBeNull();
    });

    it("caps headings at h6 even when the offset would go higher", () => {
      // h5 + 2 = h7, but the cap keeps it at h6.
      const { container } = render(<Markdown text="##### Deep" />);
      expect(container.querySelector("h6")).not.toBeNull();
    });

    it("does not treat seven hashes as a heading", () => {
      const { container } = render(<Markdown text="####### Not a heading" />);
      expect(container.querySelector("h1, h2, h3, h4, h5, h6")).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("renders nothing for empty input", () => {
      const { container } = render(<Markdown text="" />);
      expect(container.querySelector(".markdown")).toBeNull();
    });

    it("handles a very long single line without crashing", () => {
      const long = "word ".repeat(10000).trim();
      const { container } = render(<Markdown text={long} />);
      expect(container.querySelector(".markdown")).not.toBeNull();
    });

    it("handles inline bold and emphasis as separate spans in one paragraph", () => {
      // The parser matches ** and * independently on the same line, so placing
      // them in separate phrases lets each find its own marker.
      const { container } = render(
        <Markdown text="**bold** and *emphasis* together" />,
      );
      expect(container.querySelector("strong")).not.toBeNull();
      expect(container.querySelector("em")).not.toBeNull();
    });

    it("treats malformed markdown as plain text", () => {
      const { container } = render(<Markdown text="**unclosed bold" />);
      // The unmatched asterisks remain as words in the output.
      expect(container.textContent).toContain("**unclosed bold");
    });
  });
});

/**
 * The parser itself is tested separately from the renderer, because a flaw in
 * the description is invisible if only the final elements are checked.
 */
describe("parseMarkdown", () => {
  it("returns an empty array for blank input", () => {
    expect(parseMarkdown("")).toEqual([]);
    expect(parseMarkdown("   \n  \n  ")).toEqual([]);
  });

  it("merges consecutive lines into one paragraph", () => {
    const blocks = parseMarkdown("line one\nline two");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.type).toBe("paragraph");
  });

  it("separates paragraphs on blank lines", () => {
    const blocks = parseMarkdown("first\n\nsecond");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.type).toBe("paragraph");
    expect(blocks[1]!.type).toBe("paragraph");
  });
});

describe("parseInline", () => {
  it("rejects data: URLs as unsafe link destinations", () => {
    const spans = parseInline("[x](data:text/html,<script>alert(1)</script>)");
    const link = spans.find((s) => s.type === "link");
    expect(link).toBeUndefined();
  });
});
