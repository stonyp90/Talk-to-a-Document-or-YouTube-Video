"use client";

import { Fragment, type ReactNode } from "react";
import styles from "./Applications.module.css";
import { BrandIcon, type BrandIconName } from "./BrandIcon";
import { useLanguage } from "../i18n/LanguageProvider";
import {
  appDownloads,
  checksumsUrl,
  releaseNotesUrl,
  releaseTag,
  repositoryUrl,
} from "../content/downloads";

/**
 * The release is named once, in `content/downloads`, because the top menu
 * hands over the same files: a version written in two places is a version
 * that will one day disagree with itself.
 */
export const PREVIEW_VERSION = releaseTag;

/** The published file for a platform, so no filename is spelled twice. */
const buildUrl = (id: (typeof appDownloads)[number]["id"]): string => {
  const build = appDownloads.find((candidate) => candidate.id === id);
  if (!build) throw new Error(`No published build for ${id}`);
  return build.url;
};

/**
 * English is the source language, so every string below is also its own
 * translation key and `fr.ts` carries the French. Nothing user-facing is
 * written into the markup: a literal there would read English in French.
 */
const HEADING = {
  eyebrow: "Applications",
  title: "Your next insight, wherever you go.",
  lede: "Try Ursly on Android, explore the iOS Simulator build, or look inside the code.",
  release: "Release notes & installation",
} as const;

type Card = {
  brand: BrandIconName;
  /** Set when the card is styled apart from the others. */
  variant?: string;
  /** The Android build is the one a visitor can actually run today. */
  emphasis: "primary" | "secondary";
  badge: string;
  title: string;
  body: string;
  action: string;
  href: string;
  /** Takes `{version}`, so the published version stays in one place. */
  note: string;
};

const CARDS: readonly Card[] = [
  {
    brand: "android",
    emphasis: "primary",
    badge: "Android preview",
    title: "Take Ursly with you.",
    body: "Download the signed APK for Android 7.0 or later. Installation requires allowing apps from your browser.",
    action: "Download Android APK",
    href: buildUrl("android"),
    note: "Preview {version} · APK",
  },
  {
    brand: "apple",
    variant: styles.ios,
    emphasis: "secondary",
    badge: "iOS Simulator preview",
    title: "Explore the iOS experience.",
    body: "For the iOS Simulator in Xcode on an Apple silicon Mac. This archive cannot be installed on an iPhone.",
    action: "Download iOS Simulator build",
    href: buildUrl("ios"),
    note: "Preview {version} · ARM64 archive",
  },
  {
    brand: "github",
    variant: styles.code,
    emphasis: "secondary",
    badge: "Public repository",
    title: "See how it’s made.",
    body: "Explore the source, architecture, development setup, and tests. Contributions and thoughtful feedback are welcome.",
    action: "View on GitHub",
    href: repositoryUrl,
    note: "Next.js · Expo · TypeScript",
  },
];

const DISCLOSURE =
  "These are evaluation builds. Review the {limitations} before downloading. {checksums}.";
const LIMITATIONS = "known limitations and installation instructions";
const CHECKSUMS = "Verify download checksums";

/** The cards, for the test that reads the section in French. */
export const APPLICATION_CARDS = CARDS;

/**
 * Every user-facing string the section renders, so a test can hold the French
 * dictionary to the whole section rather than to a list it repeats by hand.
 */
export const APPLICATION_STRINGS: readonly string[] = [
  ...Object.values(HEADING),
  ...CARDS.flatMap((card) => [
    card.badge,
    card.title,
    card.body,
    card.action,
    card.note,
  ]),
  DISCLOSURE,
  LIMITATIONS,
  CHECKSUMS,
];

/**
 * Renders a translated sentence that owns its links. The placeholders travel
 * with the translation, so French decides where the links land instead of the
 * sentence being cut into fragments no translator can reorder.
 */
function withLinks(
  sentence: string,
  links: Readonly<Record<string, ReactNode>>,
): ReactNode[] {
  return sentence.split(/(\{\w+\})/).map((part, index) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    return <Fragment key={index}>{name ? links[name] : part}</Fragment>;
  });
}

export function Applications() {
  const { t } = useLanguage();
  return (
    <section
      className={styles.section}
      id="applications"
      aria-labelledby="applications-heading"
    >
      <div className={styles.heading}>
        <div>
          <span className="eyebrow">{t(HEADING.eyebrow)}</span>
          <h2 id="applications-heading">{t(HEADING.title)}</h2>
          <p>{t(HEADING.lede)}</p>
        </div>
        <a className={styles.releaseLink} href={releaseNotesUrl}>
          <BrandIcon name="github" />
          {t(HEADING.release)}
        </a>
      </div>
      <div className={styles.grid}>
        {CARDS.map((card) => (
          <article
            className={
              card.variant ? `${styles.card} ${card.variant}` : styles.card
            }
            key={card.title}
          >
            <span className={styles.badge}>{t(card.badge)}</span>
            <h3>{t(card.title)}</h3>
            <p>{t(card.body)}</p>
            <a className={`${card.emphasis} ${styles.action}`} href={card.href}>
              <BrandIcon name={card.brand} /> {t(card.action)}
            </a>
            <span className={styles.note}>
              {t(card.note, { version: PREVIEW_VERSION })}
            </span>
          </article>
        ))}
      </div>
      <p className={styles.disclosure}>
        {withLinks(t(DISCLOSURE), {
          limitations: <a href={releaseNotesUrl}>{t(LIMITATIONS)}</a>,
          checksums: <a href={checksumsUrl}>{t(CHECKSUMS)}</a>,
        })}
      </p>
    </section>
  );
}
