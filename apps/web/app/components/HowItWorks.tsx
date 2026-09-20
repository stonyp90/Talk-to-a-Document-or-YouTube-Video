"use client";

import { useLanguage } from "../i18n/LanguageProvider";

/**
 * Written as literals at the call site rather than as an English constant
 * translated later: the dictionary is checked against the strings this section
 * asks for, and a key hidden behind a variable is a key nobody audits.
 */
const steps = (t: (source: string) => string) => [
  {
    title: t("Bring your source"),
    text: t("A PDF or a captioned YouTube video."),
  },
  {
    title: t("Start talking"),
    text: t("Allow the microphone and ask out loud."),
  },
  {
    title: t("Go deeper"),
    text: t("Follow up in your own words."),
  },
];

export function HowItWorks() {
  const { t } = useLanguage();
  return (
    <section
      className="how-it-works"
      id="how-it-works"
      aria-labelledby="how-heading"
    >
      <div className="guide-heading">
        <span className="eyebrow">{t("How it works")}</span>
        <h2 id="how-heading">{t("Three steps. About a minute.")}</h2>
      </div>
      <ol className="guide-steps">
        {steps(t).map((step, index) => (
          <li key={step.title} className="guide-step">
            <span className="guide-step-number">{index + 1}</span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <details className="help-detail">
        <summary>
          {t("Having trouble with a source or your microphone?")}
        </summary>
        <p>
          {t(
            "Scanned PDFs need a text layer before upload. YouTube captions must be available, and some videos may be blocked by YouTube. For voice, allow microphone access in your browser. If voice cannot connect, the keyboard is right there and answers every question about an extracted source.",
          )}
        </p>
      </details>
    </section>
  );
}
