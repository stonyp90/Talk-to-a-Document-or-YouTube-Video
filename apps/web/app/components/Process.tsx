"use client";

import styles from "./Process.module.css";
import type { Loop } from "./useLoopWalk";
import { resolveProcessCopy } from "../content/process";

/**
 * How we build, in words: the loop's argument, every stage named and
 * explained, and the mission the loop is walked for. The loop itself is
 * drawn at the top of the page, and this section shares its walk, so a stage
 * chosen here is the stage lit up there.
 */
export function Process({
  locale,
  appHref,
  loop,
}: {
  locale?: string;
  /** Where the mission CTA leads. Injected so this section knows no routes. */
  appHref: string;
  loop: Loop;
}) {
  const copy = resolveProcessCopy(locale);
  const number = (index: number) => String(index + 1).padStart(2, "0");

  return (
    <section
      className={styles.section}
      id="how-we-build"
      aria-labelledby="how-we-build-heading"
    >
      <div className={styles.layout}>
        <div className={styles.copy}>
          <span className="eyebrow">{copy.eyebrow}</span>
          <h2 id="how-we-build-heading" className={styles.heading}>
            {copy.heading.lead}
            <span>{copy.heading.accent}</span>
            {copy.heading.trail}
          </h2>
          <p className={styles.intro}>{copy.intro}</p>
          <p className={styles.quote}>{copy.quote}</p>
          <p className={styles.innerLoopNote}>{copy.innerLoop}</p>
        </div>

        <ol className={styles.steps} aria-label={copy.controls.stepList}>
          {copy.steps.map((step, index) => (
            <li key={step.id} className={styles.step}>
              <button
                type="button"
                aria-current={index === loop.index ? "step" : undefined}
                onClick={() => loop.select(index)}
              >
                <span className={styles.stepNumber}>{number(index)}</span>
                <span className={styles.stepTitle}>{step.title}</span>
                <span className={styles.stepSummary}>{step.summary}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className={styles.mission}>
        <div className={styles.missionCopy}>
          <span className="eyebrow">{copy.mission.eyebrow}</span>
          <h3>{copy.mission.heading}</h3>
          <p>{copy.mission.body}</p>
        </div>
        <div className={styles.missionActions}>
          <a className={`primary ${styles.missionAction}`} href={appHref}>
            {copy.mission.primary}
          </a>
          <a
            className={`secondary ${styles.missionAction}`}
            href="#applications"
          >
            {copy.mission.secondary}
          </a>
        </div>
      </div>
    </section>
  );
}
