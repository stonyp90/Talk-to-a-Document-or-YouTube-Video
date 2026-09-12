import { describe, expect, it } from "vitest";
import {
  BRAND,
  DEFAULT_EMAIL_LOCALE,
  EMAIL_LOCALES,
  renderBrandedEmail,
  signInEmail,
  type EmailContent,
} from "./email";

const origin = "https://ursly.io";
const content: EmailContent = {
  subject: "A subject",
  preview: "A preview line",
  heading: "A heading",
  body: ["First paragraph.", "Second paragraph."],
  code: "123456",
  codeNote: "A note under the code",
  action: { label: "Open Ursly", href: "https://ursly.io/en/app" },
  footnote: "A footnote.",
};

describe("the branded email", () => {
  it("is one template: every message is the same shell", () => {
    const rendered = renderBrandedEmail(content, { origin });
    expect(rendered.subject).toBe(content.subject);
    for (const part of [rendered.html, rendered.text]) {
      expect(part).toContain(content.heading);
      expect(part).toContain(content.body[0]);
      expect(part).toContain(content.body[1]);
      expect(part).toContain(content.code!);
      expect(part).toContain(content.codeNote!);
      expect(part).toContain(content.footnote);
    }
    // The brand, drawn the one way: the mark from the origin, the wordmark,
    // and the colours the product uses everywhere else.
    expect(rendered.html).toContain(`${origin}${BRAND.markPath}`);
    expect(rendered.html).toContain(BRAND.wordmark);
    expect(rendered.html).toContain(BRAND.ink);
    expect(rendered.html).toContain(BRAND.accent);
    expect(rendered.html).toContain(BRAND.paper);
    expect(rendered.html).toContain(content.preview);
    expect(rendered.html).toContain(content.action!.href);
  });

  it("reads as plain words with no markup when HTML is not shown", () => {
    const { text } = renderBrandedEmail(content, { origin });
    expect(text).not.toMatch(/<[a-z/!]/i);
    expect(text).not.toContain("&amp;");
    expect(text).toContain(BRAND.wordmark);
    expect(text).toContain(content.action!.href);
  });

  it("escapes what it is given rather than trusting it", () => {
    const { html, text } = renderBrandedEmail(
      { ...content, heading: `<script>alert("x")</script> & more` },
      { origin },
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp; more");
    // The reader of a plain-text part sees the characters themselves.
    expect(text).toContain(`<script>alert("x")</script> & more`);
  });

  it("still sends without an origin, with no broken image in the shell", () => {
    const { html } = renderBrandedEmail(content);
    expect(html).toContain(BRAND.wordmark);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("undefined");
  });

  it("leaves out the parts a message does not use", () => {
    const plain: EmailContent = {
      subject: "S",
      preview: "P",
      heading: "H",
      body: ["B"],
      footnote: "F",
    };
    const { html, text } = renderBrandedEmail(plain, { origin });
    expect(html).not.toContain("undefined");
    expect(text).not.toContain("undefined");
    expect(html).not.toMatch(/letter-spacing: 0\.3em/); // the code block
  });
});

describe("the sign-in code email", () => {
  it("says what it is, in the reader's language", () => {
    const english = signInEmail({ code: "482913", ttlMinutes: 10, origin });
    expect(english.subject).toMatch(/Ursly/);
    expect(english.subject).toMatch(/sign-in code/i);
    expect(english.text).toContain("482913");
    expect(english.text).toMatch(/10 minutes/);
    expect(english.text).toMatch(/did not ask/i);

    const french = signInEmail({
      code: "482913",
      ttlMinutes: 10,
      locale: "fr-CA",
      origin,
    });
    expect(french.subject).toMatch(/code de connexion/i);
    expect(french.text).toContain("482913");
    expect(french.text).toMatch(/10 minutes/);
    expect(french.text).toMatch(/n’avez pas demandé/i);
    expect(french.html).not.toEqual(english.html);
  });

  it("falls back to the source language for anything unsupported", () => {
    expect(DEFAULT_EMAIL_LOCALE).toBe("en");
    expect(EMAIL_LOCALES).toEqual(["en", "fr"]);
    const unknown = signInEmail({ code: "1", ttlMinutes: 5, locale: "de-CH" });
    const english = signInEmail({ code: "1", ttlMinutes: 5 });
    expect(unknown).toEqual(english);
  });

  it("never carries a link that signs anyone in", () => {
    const { html, text } = signInEmail({
      code: "482913",
      ttlMinutes: 10,
      origin,
    });
    // A magic link in a mailbox is a second credential; the code is the only one.
    for (const part of [html, text])
      expect(part).not.toMatch(/482913[^<\s]*@|token=|code=482913/);
  });
});
