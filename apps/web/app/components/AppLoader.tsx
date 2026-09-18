"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { prefersReducedMotion } from "./motion";
import { useLanguage } from "../i18n/LanguageProvider";

/** Long enough for the animation to read as an opening, not a flicker. */
export const LOADER_MIN_MS = 900;
/** Never keep anyone waiting longer than this, whatever the fonts do. */
export const LOADER_MAX_MS = 2600;

type FontsDocument = Document & { fonts?: { ready: Promise<unknown> } };

/**
 * True once the app has hydrated, the fonts have settled (or the ceiling has
 * passed) and the minimum display time has elapsed. People who ask for less
 * motion are ready at once.
 */
export function useAppReady({ reduced }: { reduced?: boolean } = {}): boolean {
  const shouldReduce = reduced ?? prefersReducedMotion();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (shouldReduce) return;
    let done = false;
    let fontsSettled = false;
    let minimumElapsed = false;
    const finish = () => {
      if (done) return;
      done = true;
      setReady(true);
    };
    const check = () => {
      if (fontsSettled && minimumElapsed) finish();
    };
    const ceiling = window.setTimeout(finish, LOADER_MAX_MS);
    const floor = window.setTimeout(() => {
      minimumElapsed = true;
      check();
    }, LOADER_MIN_MS);
    const fonts = (document as FontsDocument).fonts;
    if (fonts) {
      fonts.ready.then(
        () => {
          fontsSettled = true;
          check();
        },
        () => {
          fontsSettled = true;
          check();
        },
      );
    } else fontsSettled = true;
    return () => {
      done = true;
      window.clearTimeout(ceiling);
      window.clearTimeout(floor);
    };
  }, [shouldReduce]);
  return shouldReduce || ready;
}

/**
 * True when the browser can actually paint WebGL. Checked client-side after
 * mount so the server and headless test environments never try to spin up
 * Three.js.
 */
function useWebGLAvailable(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      setAvailable(!!(c.getContext("webgl2") || c.getContext("webgl")));
    } catch {
      setAvailable(false);
    }
  }, []);
  return available;
}

/** Lazy so Three.js is only fetched when the browser can actually use it. */
const BrandScene3D = lazy(() => import("./BrandScene3D"));

/**
 * A drop-in shell: pages render this single component and the intro handles
 * the rest — it waits for fonts, shows the brand, and dissolves on its own.
 */
export function AppLoaderShell() {
  const ready = useAppReady();
  return <AppLoader ready={ready} />;
}

/** How long the dissolve takes when the browser never reports it ended. */
const DISSOLVE_FALLBACK_MS = 900;

/** The static brand mark shown while the 3D scene loads or when WebGL is unavailable. */
function LoaderContent() {
  return (
    <>
      {/* A vector stays crisp at every screen density. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="app-loader-mark"
        src="/brand/ursly-mark.svg"
        width="56"
        height="56"
        alt=""
      />
      <span className="app-loader-word">
        {Array.from("ursly").map((letter, index) => (
          <span key={index}>{letter}</span>
        ))}
        <span className="brand-dot">.</span>
      </span>
      <span className="app-loader-bar">
        <span />
      </span>
    </>
  );
}

/**
 * The opening: the brand breathes over the paper while the app hydrates, then
 * dissolves and leaves the page. It is rendered on the server so the very
 * first paint already shows it, and it is a status, so assistive technology
 * hears that Ursly is opening rather than meeting an empty page.
 *
 * When the browser supports WebGL the static mark gives way to a gently
 * rotating 3D brand scene; the static content remains as the Suspense
 * fallback so the opening always has something to show.
 */
export function AppLoader({ ready }: { ready: boolean }) {
  const { t } = useLanguage();
  const [gone, setGone] = useState(false);
  const webgl = useWebGLAvailable();

  useEffect(() => {
    if (!ready) return;
    const fallback = window.setTimeout(() => setGone(true), DISSOLVE_FALLBACK_MS);
    return () => window.clearTimeout(fallback);
  }, [ready]);

  if (gone) return null;
  return (
    <div
      className="app-loader"
      role="status"
      aria-label={t("Ursly is opening")}
      data-done={ready}
      onTransitionEnd={() => ready && setGone(true)}
    >
      <div className="app-loader-inner" aria-hidden="true">
        <noscript>
          <LoaderContent />
        </noscript>
        {webgl ? (
          <Suspense fallback={<LoaderContent />}>
            <BrandScene3D />
          </Suspense>
        ) : (
          /* null during SSR / first render — show static until we know. */
          webgl === false ? <LoaderContent /> : null
        )}
      </div>
    </div>
  );
}
