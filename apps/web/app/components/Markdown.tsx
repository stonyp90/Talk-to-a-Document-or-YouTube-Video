import { Fragment, type ReactNode } from "react";
import {
  parseMarkdown,
  type MarkdownBlock,
  type MarkdownSpan,
} from "@/apps/web/src/lib/markdown";

/**
 * Renders an assistant answer. The parser hands back a description of the text
 * and this turns it into elements, so nothing an answer contains is ever
 * treated as markup: a source that quotes a tag renders the tag as words.
 */

function spans(items: MarkdownSpan[]): ReactNode {
  return items.map((span, index) => {
    const key = `${span.type}-${index}`;
    if (span.type === "strong") return <strong key={key}>{span.text}</strong>;
    if (span.type === "emphasis") return <em key={key}>{span.text}</em>;
    if (span.type === "code") return <code key={key}>{span.text}</code>;
    if (span.type === "link")
      return (
        <a key={key} href={span.href} target="_blank" rel="noopener noreferrer">
          {span.text}
        </a>
      );
    return <Fragment key={key}>{span.text}</Fragment>;
  });
}

function block(item: MarkdownBlock, index: number): ReactNode {
  const key = `${item.type}-${index}`;
  if (item.type === "heading") {
    // An answer sits inside the conversation's own heading level, so its
    // headings render one step below it and never outrank the page.
    const Tag = `h${Math.min(item.level + 2, 6)}` as "h3";
    return <Tag key={key}>{spans(item.spans)}</Tag>;
  }
  if (item.type === "code")
    return (
      <pre key={key} data-language={item.language || undefined}>
        <code>{item.text}</code>
      </pre>
    );
  if (item.type === "list") {
    const children = item.items.map((entry, position) => (
      <li key={position}>{spans(entry)}</li>
    ));
    return item.ordered ? (
      <ol key={key} start={item.start}>
        {children}
      </ol>
    ) : (
      <ul key={key}>{children}</ul>
    );
  }
  return <p key={key}>{spans(item.spans)}</p>;
}

export function Markdown({ text }: { text: string }) {
  const blocks = parseMarkdown(text);
  if (blocks.length === 0) return null;
  return <div className="markdown">{blocks.map(block)}</div>;
}
