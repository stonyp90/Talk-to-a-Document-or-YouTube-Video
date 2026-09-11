import { expect, test, type Page } from "@playwright/test";

const INTRO_KEY = "ursly-intro-v1";
const intro = (page: Page) => page.getByRole("dialog", { name: /Ursly/ });
const nav = (page: Page) => page.getByRole("navigation", { name: "Primary" });
const modes = (page: Page) =>
  nav(page).getByRole("radiogroup", { name: "Control mode" });

test.describe("first visit", () => {
  test("plays the intro once, can be skipped, and is remembered", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(intro(page)).toBeVisible();
    const video = intro(page).locator("video");
    await expect(video).toHaveAttribute("autoplay", "");
    await expect(video).toHaveAttribute("muted", "");
    await expect(video).toHaveAttribute("playsinline", "");
    await expect(video.locator("track")).toHaveAttribute("kind", "captions");
    await expect
      .poll(() =>
        video.evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0),
      )
      .toBe(true);
    // Focus starts on the one control a visitor needs: skip.
    await expect(
      intro(page).getByRole("button", { name: "Skip intro" }),
    ).toBeFocused();
    await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
    await page.getByRole("button", { name: "Skip intro" }).click();
    await expect(intro(page)).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
    expect(await page.evaluate((key) => localStorage.getItem(key), INTRO_KEY))
      .toBe("seen");
    await page.reload();
    await expect(intro(page)).toHaveCount(0);
    await nav(page).getByRole("button", { name: "Watch the intro" }).click();
    await expect(intro(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(intro(page)).toHaveCount(0);
    await expect(
      nav(page).getByRole("button", { name: "Watch the intro" }),
    ).toBeFocused();
  });

  test("closes itself when the video ends and hands focus to the workspace", async ({
    page,
  }) => {
    await page.goto("/");
    const video = intro(page).locator("video");
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.duration > 0))
      .toBe(true);
    await video.evaluate((v: HTMLVideoElement) => {
      v.currentTime = v.duration - 0.2;
    });
    await expect(intro(page)).toHaveCount(0);
    await expect(page.getByLabel("PDF file")).toBeVisible();
    const focused = await page.evaluate(
      () => document.activeElement?.closest("#workspace") !== null,
    );
    expect(focused).toBe(true);
  });

  test("respects reduced motion: no autoplay, a play button and a transcript", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(intro(page)).toBeVisible();
    const video = intro(page).locator("video");
    await expect(video).not.toHaveAttribute("autoplay", "");
    expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
    await expect(
      intro(page).getByRole("button", { name: "Play the intro" }),
    ).toBeVisible();
    await expect(
      intro(page).getByText("Read the intro instead", { exact: true }),
    ).toBeVisible();
  });

  test("survives blocked storage without trapping the visitor", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Storage.prototype.getItem = () => {
        throw new Error("Blocked");
      };
      Storage.prototype.setItem = () => {
        throw new Error("Blocked");
      };
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Skip intro" }).click();
    await expect(intro(page)).toHaveCount(0);
    await expect(page.getByLabel("PDF file")).toBeVisible();
  });
});

test.describe("french visitor", () => {
  test.use({ locale: "fr-CA" });

  test("gets the French page, intro and menu", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    const video = intro(page).locator("video");
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentSrc))
      .toMatch(/ursly-intro\.fr\.(webm|mp4)$/);
    await page.getByRole("button", { name: "Passer l’intro" }).click();
    // Landmarks are named in the page language too.
    const menu = page.getByRole("navigation", { name: "Principale" });
    await expect(
      menu.getByRole("radiogroup", { name: "Mode de contrôle" }),
    ).toBeVisible();
    await expect(
      menu.getByRole("radio", { name: "Commande vocale" }),
    ).toHaveAttribute("aria-checked", "true");
    // Switching language is one tap and remembered by the root URL.
    await menu.getByRole("link", { name: "English" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});

test.describe("returning visitor", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, "seen"), INTRO_KEY);
  });

  for (const width of [320, 390, 768, 1440]) {
    test(`top menu stays fixed and compact at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const bar = nav(page);
      await expect(bar).toBeVisible();
      expect(await bar.evaluate((el) => getComputedStyle(el).position)).toBe(
        "fixed",
      );
      const height = await bar.evaluate((el) => el.getBoundingClientRect().height);
      expect(height).toBeLessThanOrEqual(width <= 960 ? 112 : 72);
      // The workspace is the first thing under the menu, not a billboard.
      const workspaceTop = await page
        .locator("#workspace")
        .evaluate((el) => el.getBoundingClientRect().top);
      expect(workspaceTop).toBeLessThanOrEqual(width <= 960 ? 340 : 280);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(150);
      expect(await bar.evaluate((el) => el.getBoundingClientRect().top)).toBe(0);
      expect(await bar.getAttribute("data-scrolled")).toBe("true");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    });
  }

  test("mode switcher is a keyboard-operable radio group with motion disabled", async ({
    page,
  }) => {
    await page.goto("/");
    const voice = modes(page).getByRole("radio", { name: "Voice to action" });
    const keyboard = modes(page).getByRole("radio", { name: "Keyboard to action" });
    const motion = modes(page).getByRole("radio", { name: /Motion to action/ });
    await expect(voice).toHaveAttribute("aria-checked", "true");
    await expect(motion).toHaveAttribute("aria-disabled", "true");
    await expect(motion).toHaveAccessibleDescription(/not available yet/i);
    await voice.focus();
    await page.keyboard.press("ArrowRight");
    await expect(keyboard).toHaveAttribute("aria-checked", "true");
    await expect(keyboard).toBeFocused();
    await page.keyboard.press("ArrowRight");
    // The disabled beta is skipped, never selected.
    await expect(voice).toHaveAttribute("aria-checked", "true");
    await expect(motion).toHaveAttribute("aria-checked", "false");
    await motion.click({ force: true });
    await expect(motion).toHaveAttribute("aria-checked", "false");
    await expect(voice).toHaveAttribute("aria-checked", "true");
    // Only the selected radio is in the tab sequence.
    expect(await voice.getAttribute("tabindex")).toBe("0");
    expect(await keyboard.getAttribute("tabindex")).toBe("-1");
  });

  test("section links land below the fixed menu", async ({ page }) => {
    await page.goto("/");
    await nav(page).getByRole("link", { name: "Platform" }).click();
    const platform = page.locator("#platform");
    await expect(platform).toBeInViewport();
    const [top, barHeight] = await Promise.all([
      platform.evaluate((el) => el.getBoundingClientRect().top),
      nav(page).evaluate((el) => el.getBoundingClientRect().height),
    ]);
    expect(top).toBeGreaterThanOrEqual(barHeight - 1);
    await expect(nav(page).getByRole("link", { name: "Platform" })).toHaveAttribute(
      "aria-current",
      "location",
    );
  });

  test("keyboard mode keeps the picker in place; voice mode adds one listening button", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByLabel("PDF file")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Speak a command" }),
    ).toBeVisible();
    await modes(page).getByRole("radio", { name: "Keyboard to action" }).click();
    await expect(page.getByLabel("PDF file")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Speak a command" }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(page.viewportSize()!.width);
  });
});
