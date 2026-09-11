import { test as base, expect } from "@playwright/test";

/** The storage key the introduction uses to remember that it has been seen. */
export const INTRO_STORAGE_KEY = "ursly-intro-v1";

/**
 * Production checks that are not about the introduction run as a returning
 * visitor: the intro is a modal dialog, so it must be marked as seen before
 * navigation for the workspace to be reachable. The check that exercises the
 * real first visit imports the plain `test` from @playwright/test instead.
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
