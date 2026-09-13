"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageProvider";

/** How long a smooth scroll to a section is given before the arrival is marked. */
export const SECTION_SETTLE_MS = 900;

/**
 * The id of the section a link points at, when it is on this very page;
 * links to other pages, other origins or nothing at all return null.
 */
export function sectionTargetFromHref(
  href: string | null,
  here: Pick<Location, "pathname" | "origin">,
): string | null {
  if (!href) return null;
  let url: URL;
  try {
    url = new URL(href, `${here.origin}${here.pathname}`);
  } catch {
    return null;
  }
  if (url.origin !== here.origin || url.pathname !== here.pathname) return null;
  const id = decodeURIComponent(url.hash.slice(1));
  return id || null;
}

/**
 * Watches every in-page link: while the page travels to the section, the
 * target carries `data-entering` and the returned id is not null; once the
 * scroll settles (or the settle time passes) the target carries `data-arrived`
 * so its heading can announce itself.
 */
export function useSectionTransition(): string | null {
  const [entering, setEntering] = useState<string | null>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as Element | null;
      const anchor = target?.closest?.("a[href]");
      if (!anchor) return;
      const id = sectionTargetFromHref(anchor.getAttribute("href"), window.location);
      if (!id || !document.getElementById(id)) return;
      setEntering(id);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!entering) return;
    const section = document.getElementById(entering);
    section?.removeAttribute("data-arrived");
    section?.setAttribute("data-entering", "true");
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      section?.removeAttribute("data-entering");
      section?.setAttribute("data-arrived", "true");
      setEntering(null);
    };
    const timer = window.setTimeout(finish, SECTION_SETTLE_MS);
    document.addEventListener("scrollend", finish, { once: true });
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("scrollend", finish);
    };
  }, [entering]);

  return entering;
}

/**
 * A thin line that runs under the fixed menu while the page moves into a
 * section, announced once so assistive technology knows where it is going.
 */
export function SectionLoader({
  entering,
  labels,
}: {
  entering: string | null;
  labels: Readonly<Record<string, string>>;
}) {
  const { t } = useLanguage();
  if (!entering) return null;
  return (
    <div
      className="section-loader"
      role="status"
      aria-label={t("Opening {section}", { section: labels[entering] ?? entering })}
    >
      <span />
    </div>
  );
}
