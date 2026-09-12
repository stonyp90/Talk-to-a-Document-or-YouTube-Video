import { test as base, expect } from "@playwright/test";

/** The storage key the introduction uses to remember that it has been seen. */
export const INTRO_STORAGE_KEY = "ursly-intro-v1";

/**
 * Production checks that are not about the introduction run as a returning
 * visitor: the intro is a modal dialog on the landing page, so it must be
 * marked as seen before navigation for the story to be usable. The check that
 * exercises the real first visit — and the crossing from the landing page
 * into the application — imports the plain `test` from @playwright/test.
 */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.addInitScript(
      (key) => localStorage.setItem(key, "seen"),
      INTRO_STORAGE_KEY,
    );
    await provide(page);
  },
});

export { expect };
