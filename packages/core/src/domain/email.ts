/**
 * Every email Ursly sends, drawn once.
 *
 * There is one template and one shell: a message names its parts and this
 * renders them, so a second kind of mail cannot arrive looking like it came
 * from somewhere else. Both parts of the message are produced together, the
 * HTML for clients that show it and the plain text for those that do not,
 * from the same words.
 *
 * It lives in the domain because it is only words and shape: no transport, no
 * SDK, no framework. The adapter that signs and sends knows nothing about how
 * a message looks, and this knows nothing about how one is delivered.
 */

/** Mail clients ignore stylesheets and custom properties, so the brand is
 * written out here, once, and referenced by name everywhere below. These are
 * the values the interface tokens carry in `globals.css`. */
export const BRAND = {
  wordmark: "ursly",
  ink: "#292735",
  muted: "#716c78",
  paper: "#f8f5ef",
  surface: "#fffdf9",
  line: "#e5e0d8",
  accent: "#a84332",
  accentWash: "#fff5f2",
  /** Served by the application, so the mark is the one the page shows. */
  markPath: "/brand/icon-192.png",
  serif: "Georgia, 'Times New Roman', serif",
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
} as const;

export const EMAIL_LOCALES = ["en", "fr"] as const;
export type EmailLocale = (typeof EMAIL_LOCALES)[number];
export const DEFAULT_EMAIL_LOCALE: EmailLocale = "en";

/** "fr-CA" is French; anything unsupported is the source language. */
export function resolveEmailLocale(locale?: string): EmailLocale {
  const language = locale?.trim().toLowerCase().split(/[-_]/)[0] ?? "";
  return (EMAIL_LOCALES as readonly string[]).includes(language)
    ? (language as EmailLocale)
    : DEFAULT_EMAIL_LOCALE;
}

/** What a message says. Every email is built from exactly these parts. */
export type EmailContent = {
  subject: string;
  /** The line a mail client shows beside the subject, before it is opened. */
  preview: string;
  heading: string;
  /** One paragraph each. */
  body: string[];
  /** A value to read back to the product, shown large and spaced. */
  code?: string;
  codeNote?: string;
  action?: { label: string; href: string };
  /** The small print: why this arrived, and what to do if it should not have. */
  footnote: string;
};

/** One rendered message: the only shape an adapter has to know how to send. */
export type BrandedEmail = { subject: string; text: string; html: string };

export type BrandOptions = {
  /** Where the application lives, for the mark and the footer link. */
  origin?: string;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** A trailing slash would double up against the paths below. */
const trimOrigin = (origin?: string) =>
  origin?.trim().replace(/\/+$/, "") || "";

/**
 * The shell, as one centred table: mail clients still disagree about
 * everything else, and a table with inline styles is what all of them draw.
 */
export function renderBrandedEmail(
  content: EmailContent,
  options: BrandOptions = {},
): BrandedEmail {
  const origin = trimOrigin(options.origin);
  const home = origin || "";
  const mark = origin
    ? `<img src="${escapeHtml(`${origin}${BRAND.markPath}`)}" width="40" height="40" alt="" style="display:block;border:0;border-radius:10px;" />`
    : "";

  const paragraphs = content.body
    .map(
      (line) =>
        `<p style="margin:0 0 14px;font:400 15px/1.7 ${BRAND.sans};color:${BRAND.ink};">${escapeHtml(line)}</p>`,
    )
    .join("");

  const code = content.code
    ? `<div style="margin:22px 0 8px;padding:18px 20px;border:1px solid ${BRAND.line};border-radius:14px;background:${BRAND.accentWash};text-align:center;">
            <span style="font:700 30px/1.2 ${BRAND.mono};letter-spacing: 0.3em;color:${BRAND.accent};">${escapeHtml(content.code)}</span>
          </div>`
    : "";
  const codeNote = content.codeNote
    ? `<p style="margin:0 0 14px;font:400 13px/1.6 ${BRAND.sans};color:${BRAND.muted};text-align:center;">${escapeHtml(content.codeNote)}</p>`
    : "";
  const action = content.action
    ? `<p style="margin:22px 0 0;"><a href="${escapeHtml(content.action.href)}" style="display:inline-block;padding:12px 18px;border:1px solid ${BRAND.accent};border-radius:8px;font:650 13px/1 ${BRAND.sans};color:${BRAND.accent};text-decoration:none;">${escapeHtml(content.action.label)}</a></p>`
    : "";
  const footerHome = home
    ? `<a href="${escapeHtml(home)}" style="color:${BRAND.muted};text-decoration:underline;">${escapeHtml(home.replace(/^https?:\/\//, ""))}</a>`
    : "";

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /><title>${escapeHtml(content.subject)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.paper};">
  <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${escapeHtml(content.preview)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.paper};padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:${BRAND.surface};border:1px solid ${BRAND.line};border-radius:20px;">
        <tr><td style="padding:28px 28px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="padding-right:10px;">${mark}</td>
            <td style="font:700 20px/1 ${BRAND.sans};color:${BRAND.ink};letter-spacing:-0.03em;">${BRAND.wordmark}<span style="color:${BRAND.accent};">.</span></td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:24px 28px 28px;">
          <h1 style="margin:0 0 14px;font:400 26px/1.2 ${BRAND.serif};color:${BRAND.ink};letter-spacing:-0.02em;">${escapeHtml(content.heading)}</h1>
          ${paragraphs}${code}${codeNote}${action}
        </td></tr>
        <tr><td style="padding:0 28px 28px;">
          <p style="margin:0;padding-top:18px;border-top:1px solid ${BRAND.line};font:400 12px/1.7 ${BRAND.sans};color:${BRAND.muted};">${escapeHtml(content.footnote)}</p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font:400 11px/1.6 ${BRAND.sans};color:${BRAND.muted};">${BRAND.wordmark}. ${footerHome}</p>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `${BRAND.wordmark}.`,
    "",
    content.heading,
    "",
    ...content.body,
    ...(content.code ? ["", content.code] : []),
    ...(content.codeNote ? [content.codeNote] : []),
    ...(content.action
      ? ["", `${content.action.label}: ${content.action.href}`]
      : []),
    "",
    content.footnote,
    ...(home ? ["", home] : []),
  ].join("\n");

  return { subject: content.subject, text, html };
}

/* ------------------------------------------------------------------------- *
 * The messages themselves. English is the source; French is a full
 * translation of the same parts, so neither can drift into being a different
 * message from the other.
 * ------------------------------------------------------------------------- */

type SignInInput = {
  code: string;
  ttlMinutes: number;
  locale?: string;
  origin?: string;
};

const signInCopy: Record<EmailLocale, (input: SignInInput) => EmailContent> = {
  en: ({ code, ttlMinutes }) => ({
    subject: "Your Ursly sign-in code",
    preview: `One code, valid for ${ttlMinutes} minutes.`,
    heading: "Your sign-in code",
    body: [
      "Type this code into Ursly to finish signing in. There is no password to remember, and nothing else to click.",
    ],
    code,
    codeNote: `Valid for ${ttlMinutes} minutes, and it can be used once.`,
    footnote:
      "If you did not ask to sign in, you can ignore this message: nothing happens until the code is typed in. This address is used for sign-in codes and nothing else.",
  }),
  fr: ({ code, ttlMinutes }) => ({
    subject: "Votre code de connexion Ursly",
    preview: `Un seul code, valide ${ttlMinutes} minutes.`,
    heading: "Votre code de connexion",
    body: [
      "Entrez ce code dans Ursly pour terminer la connexion. Aucun mot de passe à retenir, rien d’autre à cliquer.",
    ],
    code,
    codeNote: `Valide ${ttlMinutes} minutes, et utilisable une seule fois.`,
    footnote:
      "Si vous n’avez pas demandé à vous connecter, ignorez ce message : rien ne se passe tant que le code n’est pas entré. Cette adresse ne sert qu’aux codes de connexion.",
  }),
};

/**
 * The one message the product sends today. It carries no link that signs
 * anyone in: a code typed by the person reading the mailbox is the whole
 * proof, and a clickable one would be a second credential to steal.
 */
export function signInEmail(input: SignInInput): BrandedEmail {
  const locale = resolveEmailLocale(input.locale);
  return renderBrandedEmail(signInCopy[locale](input), {
    origin: input.origin,
  });
}
