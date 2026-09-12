"use client";

import type { CSSProperties } from "react";
import styles from "./Process.module.css";
import type { Loop } from "./useLoopWalk";
import { resolveProcessCopy } from "../content/process";

/**
 * The loop in words, standing on the same screen as the loop in pictures.
 *
 * The picture is drawn for the eye alone: its SVG is hidden from assistive
 * software and its nodes answer to a pointer. This is the other half of it —
 * the stage every reader can reach with a keyboard and every screen reader can
 * read, sharing one walk with the drawing, so a stage chosen here is the stage
 * lit up there and the other way round.
 *
 * Each stage keeps its full summary in the page for anyone reading it aloud.
 * On screen only the lit stage's summary is shown, by the caption under the
 * drawing, because ten summaries at once is the list this section used to be:
 * a second telling of the picture, a screen further down.
 */
export function Process({
  locale,
  appHref,
  loop,
}: {
  locale?: string;
  /** Where the mission's way in leads. Injected so this knows no routes. */
  appHref: string;
  loop: Loop;
}) {
  const copy = resolveProcessCopy(locale);

  return (
    <div className={`arrival-words ${styles.words}`}>
      <ol className={styles.steps} aria-label={copy.controls.stepList}>
        {copy.steps.map((step, index) => (
          <li
            key={step.id}
            className={styles.step}
            // The rail draws itself left to right as the page arrives, one
            // stage leading the next, the way the wave's bars do.
            style={{ "--enter": `${index * 45}ms` } as CSSProperties}
          >
            <button
              type="button"
              aria-current={index === loop.index ? "step" : undefined}
              onClick={() => loop.select(index)}
            >
              {/* The film closes its column with a tick per scene and the
                  beats named under them in tracked caps. This is that rail,
                  with a tick per stage and the walk lighting its own. */}
              <span className={styles.stepTick} aria-hidden="true" />
              <span className={styles.stepTitle}>{step.title}</span>
              {/* Read aloud, and read by the caption on screen. */}
              <span className="visually-hidden">{step.summary}</span>
            </button>
          </li>
        ))}
      </ol>

      <p className={styles.quote}>{copy.quote}</p>

      <div className={styles.mission}>
        <div className={styles.missionCopy}>
          <span className="eyebrow">{copy.mission.eyebrow}</span>
          <h3>{copy.mission.heading}</h3>
          <p>{copy.mission.body}</p>
          <p className={styles.innerLoopNote}>{copy.innerLoop}</p>
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
    </div>
  );
}
