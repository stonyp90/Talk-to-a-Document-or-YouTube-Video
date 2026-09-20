"use client";

import { Icon, type IconName } from "./Icon";
import { useHydrated } from "./useHydrated";
import { useLanguage } from "../i18n/LanguageProvider";
import { INTRO_DURATION_SECONDS } from "../content/intro-video";

const repository =
  "https://github.com/stonyp90/Talk-to-a-Document-or-YouTube-Video";

type Card = { icon: IconName; title: string; body: string };

const CARDS: readonly Card[] = [
  {
    icon: "eye",
    title: "You stay in charge.",
    body: "Every action Ursly takes is one you asked for, can see, and can undo. When it is unsure, it asks instead of guessing.",
  },
  {
    icon: "voice",
    title: "It learns you.",
    body: "Ursly tunes itself to your accent, your pace and the words you actually use. Your recordings stay yours — nothing kept without your say, everything deleted in one tap.",
  },
  {
    icon: "motion",
    title: "Speak. Move. Look. Type if you want.",
    body: "Voice, gesture, gaze and motion are the way in. The keyboard still works — nobody is left out — but it is no longer where you start.",
  },
  {
    icon: "external",
    title: "One intention. Every surface.",
    body: "A document is the first surface. The same platform drives connected objects, 3D spaces and interfaces that do not exist yet, without changing how you ask.",
  },
  {
    icon: "eye",
    title: "Built for everyone.",
    body: "No setup. No learning curve. Speak or move and Ursly understands. The Web 3.0 experience should be accessible to everyone, not only to people who enjoy keyboards.",
  },
];

const ROADMAP = [
  {
    stage: "Today",
    text: "Talk to a document or a video. Speak, gesture, or move to navigate. The keyboard still works for whoever wants it.",
  },
  {
    stage: "Next",
    text: "Voice profiles that adapt to each speaker. Motion to action on VR and AR headsets. Gaze as a way in.",
  },
  {
    stage: "Later",
    text: "Connected objects, 3D spaces and new surfaces. Whole industries, not only websites — with permission at every boundary.",
  },
] as const;

/**
 * The static story behind the product: what Ursly is as a platform, what is
 * true today and what comes next, told without a single superlative. It is
 * reachable from the fixed menu and reads in one scroll.
 */
export function PlatformSection({
  appHref,
  onReplayIntro,
}: {
  /** Where the ways in lead. Injected so this section knows no routes. */
  appHref: string;
  onReplayIntro: () => void;
}) {
  const { t } = useLanguage();
  const hydrated = useHydrated();
  return (
    <section
      className="platform"
      id="platform"
      aria-labelledby="platform-heading"
    >
      <div className="platform-heading">
        <span className="eyebrow">{t("Platform")}</span>
        <h2 id="platform-heading">{t("Less computer. More human.")}</h2>
        <p className="platform-lede">
          {t(
            "You express your intention. Ursly acts. Speak, gesture, look, move — the interface adapts to you, not the other way around.",
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
              <a className="roadmap-link" href={appHref}>
                {t("Try it now")} <Icon name="arrow" />
              </a>
            )}
          </li>
        ))}
      </ol>
      <p className="roadmap-note">
        {t("No dates. We publish what ships, and we revise this as we learn.")}
      </p>

      <div className="platform-proof">
        <a className="platform-way-in" href={appHref}>
          {t("Open the app")} <Icon name="arrow" />
        </a>
        <a href={repository}>{t("Open source")}</a>
        <a href={`${repository}/actions`}>
          {t("Tests and CI on every change")}
        </a>
        <a href={`${repository}/releases`}>
          {t("Signed builds and release notes")}
        </a>
        <button
          type="button"
          className="link-button"
          onClick={onReplayIntro}
          disabled={!hydrated}
        >
          {t("Watch the intro again")} · {INTRO_DURATION_SECONDS} s
        </button>
      </div>

      <p className="platform-closing">{t("Ursly is the human interface.")}</p>
    </section>
  );
}
