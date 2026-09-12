import { expect, test } from "@playwright/test";
import { APP_PATH, LANDING_PATH } from "../routes";
import { pdfFixture } from "../pdf-fixture";

/**
 * The gap between a page appearing and its script running is real: on a slow
 * connection it is seconds, and production found both of these the hard way.
 * Each test holds every script until it says otherwise, so the gap is a fact
 * of the run rather than a race that passes on a fast machine.
 */
async function holdScripts(page: import("@playwright/test").Page) {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/_next/static/**/*.js", async (route) => {
    await held;
    await route.continue();
  });
  return release;
}

test("a PDF chosen before the script runs is not lost", async ({ page }) => {
  const release = await holdScripts(page);
  await page.goto(APP_PATH, { waitUntil: "commit" });
  const picker = page.getByLabel("PDF file");
  await expect(picker).toBeAttached();
  await picker.setInputFiles({
    name: "chosen-early.pdf",
    mimeType: "application/pdf",
    buffer: pdfFixture("Chosen before the page was ready."),
  });
  release();
  // The page adopts what the picker already holds, so the reader carries on
  // instead of choosing the same file twice.
  await expect(
    page.getByRole("button", { name: "Continue to questions" }),
  ).toBeEnabled();
  await expect(page.locator(".dropzone strong")).toHaveText("chosen-early.pdf");
});

test("the intro replay waits until it can actually play", async ({ page }) => {
  const release = await holdScripts(page);
  await page.addInitScript(() =>
    localStorage.setItem("ursly-intro-v1", "seen"),
  );
  await page.goto(LANDING_PATH, { waitUntil: "commit" });
  const menu = page.getByRole("navigation", { name: "Primary" });
  const replay = menu.getByRole("button", { name: "Watch the intro" });
  // Before the script runs the button cannot open anything, and says so
  // rather than swallowing the tap.
  await expect(replay).toBeDisabled();
  release();
  await expect(replay).toBeEnabled();
  await replay.click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
