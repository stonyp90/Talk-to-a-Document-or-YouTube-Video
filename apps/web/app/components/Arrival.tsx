"use client";

import { useState, useEffect, type RefObject } from "react";
import { Icon } from "./Icon";
import { Galaxy3D } from "./Galaxy3D";
import { LoopDiagram } from "./LoopDiagram";
import { Process } from "./Process";
import { VoiceMark } from "./VoiceMark";
import { useHydrated } from "./useHydrated";
import { useLanguage } from "../i18n/LanguageProvider";
import type { Loop } from "./useLoopWalk";
import { INTRO_DURATION_SECONDS } from "../content/intro-video";

/**
 * The first screen: where the film lets go and the page takes over.
 *
 * The introduction ends on the loop, drawn, with the voice running along the
 * top of a serif headline on warm paper. This screen is that frame, alive: the
 * same wave, the same face, the same loop, now turning under a reader's hand.
 * Nothing about the cut should be noticeable, which is why the mark, the type
 * and the palette are the film's own rather than a second design that happens
 * to share a colour.
 *
 * It is also the whole of "how we build". The argument used to be told three
 * times down the page — named in the lede, drawn on the ring, then listed
 * again a screen below — and a reader had to scroll before meeting a word of
 * it. One screen now carries the claim, the picture, every stage of it and the
 * way in, and the section keeps its own anchor so the menu still points here.
 */
export function Arrival({
  language,
  appHref,
  loop,
  onReplayIntro,
  heroCta,
}: {
  language: string;
  /** Where every way in leads. Injected so this screen knows no routes. */
  appHref: string;
  loop: Loop;
  onReplayIntro: () => void;
  /** Where focus lands when the introduction hands the page over. */
  heroCta?: RefObject<HTMLAnchorElement | null>;
}) {
  const { t } = useLanguage();
  const hydrated = useHydrated();
  const [use3D, setUse3D] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const canvas = document.createElement("canvas");
      const supported = !!(
        window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
      );
      setUse3D(supported);
    } catch {
      setUse3D(false);
    }
  }, []);

  return (
    <section
      className="hero landing-hero arrival"
      id="how-we-build"
      aria-labelledby="hero-heading"
    >
      <div className="arrival-copy">
        <VoiceMark className="arrival-wave" />
        <span className="eyebrow">{t("Internet 3.0")}</span>
        <h1 id="hero-heading">
          {t("A new way to build software.")}{" "}
          <span>{t("For tomorrow’s internet.")}</span>
        </h1>
        <p className="arrival-claim">
          {t("Not a new website. A new way to use one.")}
        </p>
        <div className="hero-actions">
          <a ref={heroCta} className="primary" href={appHref}>
            <Icon name="arrow" /> {t("Open the app")}
          </a>
          <button
            type="button"
            className="secondary"
            onClick={onReplayIntro}
            disabled={!hydrated}
          >
            <Icon name="play" /> {t("Watch the intro")} ·{" "}
            {INTRO_DURATION_SECONDS} s
          </button>
        </div>
      </div>

      <div className="arrival-loop">
        {/* The ring's own label, now that the column's eyebrow says what Ursly
            is rather than what this picture is. */}
        <span className="eyebrow arrival-loop-label">
          {t("The software development lifecycle")}
        </span>
        {use3D ? (
          <Galaxy3D width={300} height={300} />
        ) : (
          <LoopDiagram locale={language} loop={loop} />
        )}
      </div>

      <Process locale={language} appHref={appHref} loop={loop} />
    </section>
  );
}
