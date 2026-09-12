import type { CSSProperties } from "react";
import styles from "./VoiceMark.module.css";
import {
  INTRO_WAVE,
  INTRO_WAVE_CLOSING_GAIN,
  INTRO_WAVE_RIGHT,
} from "../content/intro-video";

/** The tallest a bar can stand: its floor plus its full swing. */
const HEIGHT = INTRO_WAVE.floor + INTRO_WAVE.swing;

/**
 * Each bar, exactly as the film draws it on its opening frame.
 *
 * The film's bar height is `(floor + |sin(t * speed + i * phase)| * swing)`
 * scaled by the loudness and by how near the bar is to the fading right end.
 * Read at `t = 0` that is a fixed shape, which is what a still of the film
 * shows and what this mark holds. Nothing here depends on the clock, so the
 * server and the browser draw the same wave and React has nothing to
 * reconcile.
 */
const BARS = Array.from({ length: INTRO_WAVE.bars }, (_, index) => {
  const x = INTRO_WAVE.left + index * INTRO_WAVE.pitch;
  // The film dissolves the right end into the paper over `fade` units rather
  // than cutting it off, so the sound reads as arriving from off frame.
  const reach = Math.min(
    1,
    Math.max(0, (INTRO_WAVE_RIGHT - x) / INTRO_WAVE.fade),
  );
  const swing = Math.abs(Math.sin(index * INTRO_WAVE.phase));
  return {
    index,
    x,
    reach,
    swing,
    /** The bar's share of the full height, before loudness and fade. */
    still: (INTRO_WAVE.floor + swing * INTRO_WAVE.swing) / HEIGHT,
  };
});

/**
 * The voice, drawn: the wave the introduction film runs along the top of its
 * type column in every scene, reproduced here bar for bar from the geometry
 * the renderer itself reads.
 *
 * The film ends on the loop and the landing page opens on it, so the page
 * opens on this mark too, at the loudness the film left it at. That is what
 * makes the cut from the film into the page read as one take rather than two
 * designs that happen to share a palette.
 *
 * It rises once, as the page arrives, and then holds. This page's rule is that
 * decorative motion settles instead of competing with the reader for the rest
 * of the visit, and the only thing left moving here is the loop, which is the
 * argument rather than the decoration.
 *
 * The mark is decoration by default and so is never announced. Give it a label
 * where it carries meaning of its own and it becomes an image with a name.
 */
export function VoiceMark({
  label,
  gain = INTRO_WAVE_CLOSING_GAIN,
  className,
}: {
  /** Announced name. Without one the mark is hidden from assistive software. */
  label?: string;
  /** How loud the wave stands, on the film's own scale of nought to one. */
  gain?: number;
  className?: string;
}) {
  return (
    <svg
      className={[styles.mark, className].filter(Boolean).join(" ")}
      data-testid="voice-mark"
      viewBox={`${INTRO_WAVE.left} 0 ${INTRO_WAVE_RIGHT - INTRO_WAVE.left} ${HEIGHT}`}
      preserveAspectRatio="xMinYMid meet"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {BARS.map((bar) => {
        // The fade scales the whole bar, floor included, exactly as the film
        // scales it, so a faded bar is a quieter one rather than a clipped one.
        const height = HEIGHT * bar.still * bar.reach * gain;
        return (
          <rect
            key={bar.index}
            className={styles.bar}
            x={bar.x}
            y={(HEIGHT - height) / 2}
            width={INTRO_WAVE.bar}
            height={height}
            rx={INTRO_WAVE.bar / 2}
            style={
              {
                "--bar-reach": bar.reach,
                // The film's own opacity curve: faint at the bottom of a
                // swing, near solid at the top of one.
                "--bar-ink": `calc(
                  var(--wave-quiet) +
                  ${bar.swing} * (var(--wave-loud) - var(--wave-quiet))
                )`,
                // One bar leads the next in, left to right, the way the sound
                // arrives from off frame.
                "--bar-stagger": `${bar.index * 26}ms`,
              } as CSSProperties
            }
          />
        );
      })}
    </svg>
  );
}
