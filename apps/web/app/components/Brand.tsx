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
  name = "ursly",
  showDot = true,
}: {
  /** Product wordmark; the shared wave mark stays intact. */
  name?: string;
  showDot?: boolean;
  /** Where the name leads, when it leads anywhere. */
  href?: string;
  /** Announced name for the link. Ignored when the name is not a link. */
  label?: string;
  /** Lets a caller supply its own router-aware link element. */
  wrap?: (content: ReactNode) => ReactNode;
}) {
  const content = (
    <>
      <svg
        className="brand-mark"
        viewBox="15 20 70 60"
        width="34"
        height="34"
        aria-hidden="true"
      >
        <rect className="brand-bar brand-bar-1" x="27" y="43" width="6" height="14" rx="3" />
        <rect className="brand-bar brand-bar-2" x="37" y="30" width="6" height="40" rx="3" />
        <rect className="brand-bar brand-bar-3" x="47" y="35" width="6" height="30" rx="3" />
        <rect className="brand-bar brand-bar-4" x="57" y="30" width="6" height="40" rx="3" />
        <rect className="brand-bar brand-bar-5" x="67" y="39" width="6" height="22" rx="3" />
      </svg>
      {name}
      {showDot && <span className="brand-dot">.</span>}
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
