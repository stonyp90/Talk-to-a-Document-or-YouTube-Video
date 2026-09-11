"use client";

import { Icon, type IconName } from "./Icon";
import { useLanguage } from "../i18n/LanguageProvider";

const repository =
  "https://github.com/stonyp90/Talk-to-a-Document-or-YouTube-Video";

type Card = { icon: IconName; title: string; body: string };

const CARDS: readonly Card[] = [
  {
    icon: "eye",
    title: "A human stays in the loop.",
    body: "Every action Ursly takes is one you asked for, can see and can undo. When it is unsure, it asks instead of guessing.",
  },
  {
    icon: "voice",
    title: "A voice model that learns your voice, with your permission.",
    body: "Ursly is built to tune itself to your accent, your pace and the words you actually use, so it understands you a little better each time. Your recordings stay yours: nothing is kept without your say, and everything can be deleted in one tap.",
  },
  {
    icon: "motion",
    title: "Speak. Move. Type.",
    body: "Voice first, movement next, keyboard whenever you need it: three ways to do the same thing, so no one is left out. Choose what fits the moment, the room or the person; the request underneath stays the same.",
  },
  {
    icon: "external",
    title: "A simple site today. Every surface tomorrow.",
    body: "Talking to a document is the first surface. The same platform is designed to drive connected objects, 3D objects and interfaces that do not exist yet, without changing how you ask.",
  },
];

const ROADMAP = [
  {
    stage: "Today",
    text: "Talk to a PDF or a captioned YouTube video. Say “upload”, “summarize” or “next” to drive the page. Keyboard everywhere.",
  },
  {
    stage: "Next",
    text: "Voice profiles that adapt to each speaker, with consent and one-tap deletion. Motion to action, in beta.",
  },
  {
    stage: "Later",
    text: "Connected objects, 3D objects and other surfaces. Whole industries, not only websites.",
  },
] as const;

/**
 * The static story behind the product: what Ursly is as a platform, what is
 * true today and what comes next, told without a single superlative. It is
 * reachable from the fixed menu and reads in one scroll.
 */
export function PlatformSection({
  onReplayIntro,
}: {
  onReplayIntro: () => void;
}) {
  const { t, language } = useLanguage();
  return (
    <section
      className="platform"
      id="platform"
      aria-labelledby="platform-heading"
    >
      <div className="platform-heading">
        <span className="eyebrow">{t("Platform")}</span>
        <h2 id="platform-heading">
          {t("Not a new website. A new way to use one.")}
        </h2>
        <p className="platform-lede">
          {t(
            "Ursly sits between what you mean and what a screen does. You speak, move or type; it listens, adapts to how you talk, and keeps you, not the model, in charge of what happens next.",
          )}
        </p>
      </div>

      <div className="platform-grid">
        {CARDS.map((card) => (
          <article className="platform-card" key={card.title}>
            <span className="platform-icon" aria-hidden="true">
              <Icon name={card.icon} />
            </span>
            <h3>{t(card.title)}</h3>
            <p>{t(card.body)}</p>
          </article>
        ))}
      </div>

      <ol
        className="roadmap"
        aria-label={t("What is true today, next and later")}
      >
        {ROADMAP.map((item, index) => (
          <li
            className="roadmap-item"
            key={item.stage}
            id={`roadmap-${item.stage.toLowerCase()}`}
            data-stage={item.stage.toLowerCase()}
          >
            <span className="roadmap-stage">
              <span className="roadmap-dot" aria-hidden="true" />
              {t(item.stage)}
            </span>
            <p>{t(item.text)}</p>
            {index === 0 && (
              <a className="roadmap-link" href={`/${language}/app`}>
                {t("Try it now")} <Icon name="arrow" />
              </a>
            )}
          </li>
        ))}
      </ol>
      <p className="roadmap-note">
        {t(
          "No dates. We publish what ships, and we revise this as we learn. Not on the list: replacing your keyboard, or acting without asking.",
        )}
      </p>

      <div className="platform-proof">
        <a href={repository}>{t("Open source")}</a>
        <a href={`${repository}/actions`}>
          {t("Tests and CI on every change")}
        </a>
        <a href={`${repository}/releases`}>
          {t("Signed builds and release notes")}
        </a>
        <button type="button" className="link-button" onClick={onReplayIntro}>
          {t("Watch the intro again")} · 24 s
        </button>
      </div>

      <p className="platform-closing">
        {t(
          "Less scrolling. More understanding. On every surface that comes next.",
        )}
      </p>
    </section>
  );
}
