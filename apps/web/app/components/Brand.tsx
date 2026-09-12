import type { ReactNode } from "react";

/**
 * The name, in one place.
 *
 * It appears in the fixed menu, on the page that says a route is missing, and
 * at the top of the introduction. Three copies of the same lockup drifted
 * apart the moment one of them was touched — the introduction's was two sizes
 * smaller than the menu's, which is exactly what made arriving on the site
 * feel like leaving the film and entering a different product. There is one
 * lockup now, and it is the same mark at the same size wherever it stands.
 *
 * Without a destination it renders as plain text: inside a modal dialog the
 * name is a label, and a link out of the film would be a way to lose it.
 */
export function Brand({
  href,
  label,
  wrap,
}: {
  /** Where the name leads, when it leads anywhere. */
  href?: string;
  /** Announced name for the link. Ignored when the name is not a link. */
  label?: string;
  /** Lets a caller supply its own router-aware link element. */
  wrap?: (content: ReactNode) => ReactNode;
}) {
  const content = (
    <>
      {/* A vector stays crisp at every screen density. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="brand-mark"
        src="/brand/ursly-mark.svg"
        width="34"
        height="34"
        alt=""
      />
      ursly<span className="brand-dot">.</span>
    </>
  );
  if (wrap) return <>{wrap(content)}</>;
  if (href)
    return (
      <a className="brand" href={href} aria-label={label}>
        {content}
      </a>
    );
  return <span className="brand">{content}</span>;
}
