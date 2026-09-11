import { test as base, expect } from "@playwright/test";

/** The storage key the introduction uses to remember that it has been seen. */
export const INTRO_STORAGE_KEY = "ursly-intro-v1";

/**
 * Every journey that is not about the introduction starts as a returning
 * visitor. The intro is a modal dialog, so nothing else on the page can be
 * used while it is open; marking it as seen before navigation keeps the
 * workspace reachable. Specs that exercise the first visit import the plain
 * `test` from @playwright/test instead.
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
