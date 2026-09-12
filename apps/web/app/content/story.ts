/**
 * The story the landing page tells, in the order a reader meets it.
 *
 * How we build leads: the loop that produced this is the first thing to see,
 * before any claim about the product. The application itself is not on this
 * page at all — it lives at `/<lang>/app`, and every section here ends with a
 * way into it, so the way in is never more than a section away.
 *
 * The order lives here rather than in the markup so the page, the fixed menu
 * and the suites all read it from one place.
 */
export type StorySection = {
  id: string;
  /**
   * The English label, which is also its translation key: the menu and any
   * in-page link name the section with it.
   */
  label: string;
  /** What the menu shows when the bar is too narrow for the label. */
  short: string;
  /** Whether the fixed menu carries an anchor to it. */
  inMenu: boolean;
};

export const STORY_SECTIONS = [
  { id: "how-we-build", label: "How we build", short: "Build", inMenu: true },
  { id: "platform", label: "Platform", short: "Platform", inMenu: true },
  {
    id: "how-it-works",
    label: "How it works",
    short: "Guide",
    inMenu: false,
  },
  {
    id: "applications",
    label: "Applications",
    short: "Apps",
    inMenu: false,
  },
] as const satisfies readonly StorySection[];

export type StorySectionId = (typeof STORY_SECTIONS)[number]["id"];

/** The anchors the fixed menu carries; the rest are reached by scrolling. */
export const MENU_SECTIONS = STORY_SECTIONS.filter(
  (section) => section.inMenu,
) as readonly StorySection[];

/** The application, in the reader's language. Pages take it as a parameter. */
export function appHref(language: string): string {
  return `/${language}/app`;
}
