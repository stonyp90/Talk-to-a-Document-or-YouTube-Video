import type { Page } from "@playwright/test";

/**
 * Where each half of the site lives, in one place, so the nineteen browser
 * journeys that used to hardcode `"/"` do not have to agree by accident.
 *
 * Both paths are deliberately language-free: the proxy rewrites them to the
 * negotiated language, so every journey keeps exercising that negotiation
 * exactly as it did when the application was the root.
 */
export const LANDING_PATH = "/";
export const APP_PATH = "/app";

/** The landing page: the hero, the introduction and the story sections. */
export function openLanding(page: Page) {
  return page.goto(LANDING_PATH);
}

/** The application: add a source, ask a question. */
export function openApp(page: Page) {
  return page.goto(APP_PATH);
}

/** The app route in one explicit language, for the language-switch journeys. */
export function appPath(language: "en" | "fr") {
  return `/${language}${APP_PATH}`;
}
