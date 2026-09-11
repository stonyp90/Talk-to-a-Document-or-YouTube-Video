"use client";

import { useLanguage } from "../i18n/LanguageProvider";

const STEPS = [
  {
    title: "Bring your source",
    text: "Choose a text-based PDF up to 25 MB or a captioned YouTube video, then check the extracted text in the preview.",
  },
  {
    title: "Start talking",
    text: "Select Start Voice Chat, allow the microphone, and ask out loud. Interrupt or mute whenever you want; typing is always available.",
  },
  {
    title: "Go a little deeper",
    text: "Use a suggestion or ask a follow-up in your own words. Keep the source nearby to check important details.",
  },
] as const;

export function HowItWorks() {
  const { t } = useLanguage();
  return (
    <section className="how-it-works" id="how-it-works" aria-labelledby="how-heading">
      <div className="guide-heading">
        <span className="eyebrow">{t("A little guidance")}</span>
        <h2 id="how-heading">{t("From information to understanding.")}</h2>
      </div>
      <div className="guide-grid">
        {STEPS.map((step, index) => (
          <article key={step.title}>
            <span className="guide-number">0{index + 1}</span>
            <h3>{t(step.title)}</h3>
            <p>{t(step.text)}</p>
          </article>
        ))}
      </div>
      <details className="help-detail">
        <summary>{t("Having trouble with a source or your microphone?")}</summary>
        <p>
          {t("Scanned PDFs need a text layer before upload. YouTube captions must be available, and some videos may be blocked by YouTube. For voice, allow microphone access in your browser. If voice cannot connect, you can still type your questions about an extracted source.")}
        </p>
      </details>
    </section>
  );
}
