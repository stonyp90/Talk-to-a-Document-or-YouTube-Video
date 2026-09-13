import { expect, test, type Page } from "@playwright/test";
import { APP_PATH, LANDING_PATH, appPath } from "../routes";
import { MENU_SECTIONS } from "../../apps/web/app/content/story";

const INTRO_KEY = "ursly-intro-v1";
const intro = (page: Page) => page.getByRole("dialog", { name: /Ursly/ });
const nav = (page: Page) => page.getByRole("navigation", { name: "Primary" });
const modes = (page: Page) =>
  nav(page).getByRole("radiogroup", { name: "Control mode" });
const heroCta = (page: Page) => page.locator("#main .hero-actions a.primary");

test.describe("first visit", () => {
  test("plays the intro once, can be skipped, and is remembered", async ({
    page,
  }) => {
    await page.goto(LANDING_PATH);
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
    expect(
      await page.evaluate((key) => localStorage.getItem(key), INTRO_KEY),
    ).toBe("seen");
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

  test("closes itself when the video ends and hands focus to the way in", async ({
    page,
  }) => {
    // The introduction used to hand focus to the workspace, which was the same
    // page. It now opens onto the story, so the guarantee is unchanged in
    // spirit — land on the next thing a visitor needs, never nowhere — and the
    // next thing is the way into the application.
    await page.goto(LANDING_PATH);
    const video = intro(page).locator("video");
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.duration > 0))
      .toBe(true);
    await video.evaluate((v: HTMLVideoElement) => {
      v.currentTime = v.duration - 0.2;
    });
    await expect(intro(page)).toHaveCount(0);
    await expect(heroCta(page)).toBeFocused();
    // One keystroke from there reaches the application.
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/(en|fr)\/app$/);
    await expect(page.getByLabel("PDF file")).toBeVisible();
  });

  test("never interrupts the application with the introduction", async ({
    page,
  }) => {
    // A first visit straight to /app is somebody's work, not an audience: a
    // modal video over it would be worse than missing the pitch.
    await page.goto(APP_PATH);
    await expect(page.getByLabel("PDF file")).toBeVisible();
    await expect(intro(page)).toHaveCount(0);
    expect(
      await page.evaluate((key) => localStorage.getItem(key), INTRO_KEY),
    ).toBe(null);
  });

  test("respects reduced motion: no autoplay, a play button and a transcript", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(LANDING_PATH);
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
    await page.goto(LANDING_PATH);
    await page.getByRole("button", { name: "Skip intro" }).click();
    await expect(intro(page)).toHaveCount(0);
    // Not trapped: the story is readable and the application is still one tap.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(heroCta(page)).toBeVisible();
  });
});

test.describe("french visitor", () => {
  test.use({ locale: "fr-CA" });

  test("gets the French page, intro and menu", async ({ page }) => {
    await page.goto(LANDING_PATH);
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    const video = intro(page).locator("video");
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentSrc))
      .toMatch(/ursly-intro\.fr\.(webm|mp4)$/);
    await page.getByRole("button", { name: "Passer l’intro" }).click();
    // Landmarks and the primary action are named in the page language too.
    const menu = page.getByRole("navigation", { name: "Principale" });
    await expect(
      menu.getByRole("link", { name: "Ouvrir l’application" }),
    ).toBeVisible();
    // Switching language is one tap and remembered by the root URL.
    await menu.getByRole("link", { name: "English" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.goto(LANDING_PATH);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("stays inside the application when switching language", async ({
    page,
  }) => {
    // The language links used to be hardcoded to `/<code>`, which would eject
    // a reader mid-conversation back to the pitch. This is the test that
    // holds them path-aware.
    await page.goto(appPath("fr"));
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    const menu = page.getByRole("navigation", { name: "Principale" });
    await expect(
      menu.getByRole("radiogroup", { name: "Mode de contrôle" }),
    ).toBeVisible();
    await menu.getByRole("link", { name: "English" }).click();
    await expect(page).toHaveURL(/\/en\/app$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("#workspace")).toBeVisible();
    await expect(page.getByLabel("PDF file")).toBeVisible();
    // And back again, from the English side.
    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Français" })
      .click();
    await expect(page).toHaveURL(/\/fr\/app$/);
    await expect(page.locator("#workspace")).toBeVisible();
  });
});

test.describe("returning visitor", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      (key) => localStorage.setItem(key, "seen"),
      INTRO_KEY,
    );
  });

  for (const width of [320, 390, 768, 1440]) {
    test(`top menu stays fixed and compact at ${width}px in the app`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(APP_PATH);
      const bar = nav(page);
      await expect(bar).toBeVisible();
      expect(await bar.evaluate((el) => getComputedStyle(el).position)).toBe(
        "fixed",
      );
      const height = await bar.evaluate(
        (el) => el.getBoundingClientRect().height,
      );
      expect(height).toBeLessThanOrEqual(width <= 960 ? 112 : 72);
      // The controls are the first thing under the menu, not a billboard. In
      // voice mode the panel leads and the two cards follow it, so the budget
      // is measured against whichever comes first — the numbers are unchanged.
      const [panelTop, workspaceTop] = await Promise.all([
        page
          .locator(".voice-commands")
          .evaluate((el) => el.getBoundingClientRect().top),
        page
          .locator("#workspace")
          .evaluate((el) => el.getBoundingClientRect().top),
      ]);
      expect(panelTop).toBeLessThanOrEqual(width <= 960 ? 340 : 280);
      expect(workspaceTop).toBeGreaterThan(panelTop);
      // Where there is room the bar floats a few pixels clear of the edge,
      // so what is asserted is that it does not move, not that it is flush.
      const restingTop = await bar.evaluate(
        (el) => el.getBoundingClientRect().top,
      );
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(150);
      expect(await bar.evaluate((el) => el.getBoundingClientRect().top)).toBe(
        restingTop,
      );
      expect(await bar.getAttribute("data-scrolled")).toBe("true");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    });

    test(`landing page keeps the point above the fold at ${width}px`, async ({
      page,
    }) => {
      // The landing page IS a billboard now, by design. What it is still held
      // to is the same discipline the workspace was: the point of the page and
      // the way to act on it are visible without scrolling, and the bar is a
      // single row because there are no control modes here.
      await page.setViewportSize({ width, height: 900 });
      await page.goto(LANDING_PATH);
      const bar = nav(page);
      await expect(bar).toBeVisible();
      expect(await bar.evaluate((el) => getComputedStyle(el).position)).toBe(
        "fixed",
      );
      const height = await bar.evaluate(
        (el) => el.getBoundingClientRect().height,
      );
      expect(height).toBeLessThanOrEqual(72);
      await expect(modes(page)).toHaveCount(0);
      const cta = heroCta(page);
      await expect(cta).toBeVisible();
      await expect(cta).toBeInViewport();
      const ctaBottom = await cta.evaluate(
        (el) => el.getBoundingClientRect().bottom,
      );
      expect(ctaBottom).toBeLessThanOrEqual(900);
      const restingTop = await bar.evaluate(
        (el) => el.getBoundingClientRect().top,
      );
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(150);
      expect(await bar.evaluate((el) => el.getBoundingClientRect().top)).toBe(
        restingTop,
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    });
  }

  test("the landing page does not render the workspace", async ({ page }) => {
    await page.goto(LANDING_PATH);
    for (const locator of [
      page.locator("#workspace"),
      page.getByLabel("PDF file"),
      page.getByLabel("Ask a question", { exact: true }),
      page.getByRole("button", { name: "Start Voice Chat" }),
      page.locator(".conversation-card"),
      page.locator(".source-card"),
    ])
      await expect(locator).toHaveCount(0);
    // And it tells the story, in the order it was asked for: the loop that
    // built this first, the product story after it.
    const order = await page.evaluate(() =>
      ["platform", "how-we-build", "pricing", "how-it-works", "applications"]
        .map(
          (id) =>
            [
              id,
              document.getElementById(id)!.getBoundingClientRect().top,
            ] as const,
        )
        .sort((a, b) => a[1] - b[1])
        .map(([id]) => id),
    );
    expect(order).toEqual([
      "how-we-build",
      "platform",
      "pricing",
      "how-it-works",
      "applications",
    ]);
  });

  test("the way into the application repeats down the story", async ({
    page,
  }) => {
    await page.goto(LANDING_PATH);
    // A reader who stops anywhere in the story has a way in within reach.
    // The first screen answers to both of the first two names — it is the
    // hero and it is how we build — so that pair is one element checked
    // twice, and the day they part again both are already covered.
    for (const selector of [
      ".nav",
      ".landing-hero",
      "#how-we-build",
      "#platform",
      "#pricing",
      "#how-it-works",
      ".invitation",
      ".footer",
    ])
      expect(
        await page.locator(`${selector} a[href$="/app"]`).count(),
        selector,
      ).toBeGreaterThan(0);
    const lang = await page.locator("html").getAttribute("lang");
    for (const href of await page
      .locator('a[href$="/app"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute("href"))))
      expect(href).toBe(`/${lang}/app`);
  });

  test("the application route does render the workspace, and nothing of the story", async ({
    page,
  }) => {
    await page.goto(APP_PATH);
    await expect(page.locator("#workspace")).toBeVisible();
    await expect(page.getByLabel("PDF file")).toBeVisible();
    await expect(
      page.getByLabel("Ask a question", { exact: true }),
    ).toBeVisible();
    for (const id of [
      "platform",
      "how-we-build",
      "how-it-works",
      "applications",
    ])
      await expect(page.locator(`#${id}`)).toHaveCount(0);
    // The skip link points at the workspace, which is this page's content.
    const skip = page.locator("a.skip-link");
    await expect(skip).toHaveAttribute("href", "#workspace");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  });

  for (const language of ["en", "fr"] as const) {
    test(`the menu carries a reader both ways in ${language}`, async ({
      page,
    }) => {
      const into = language === "fr" ? "Ouvrir l’application" : "Open the app";
      const back =
        language === "fr" ? "Retour à l’histoire" : "Back to the story";
      const menu = page.getByRole("navigation", {
        name: language === "fr" ? "Principale" : "Primary",
      });
      await page.goto(`/${language}`);
      await menu.getByRole("link", { name: into }).click();
      await expect(page).toHaveURL(new RegExp(`/${language}/app$`));
      await expect(page.locator("#workspace")).toBeVisible();
      await menu.getByRole("link", { name: back }).click();
      await expect(page).toHaveURL(new RegExp(`/${language}$`));
      await expect(page.locator("#platform")).toHaveCount(1);
      await expect(page.locator("#workspace")).toHaveCount(0);
    });
  }

  test("mode switcher is a keyboard-operable radio group over all three modes", async ({
    page,
  }) => {
    await page.goto(APP_PATH);
    const voice = modes(page).getByRole("radio", { name: "Voice to action" });
    const keyboard = modes(page).getByRole("radio", {
      name: "Keyboard to action",
    });
    const motion = modes(page).getByRole("radio", { name: /Motion to action/ });
    await expect(voice).toHaveAttribute("aria-checked", "true");
    await expect(motion).not.toHaveAttribute("aria-disabled", "true");
    await voice.focus();
    // The beta sits in the middle of the row, so the keys land on it.
    await page.keyboard.press("ArrowRight");
    await expect(motion).toHaveAttribute("aria-checked", "true");
    await expect(motion).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(keyboard).toHaveAttribute("aria-checked", "true");
    await expect(keyboard).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(voice).toHaveAttribute("aria-checked", "true");
    await motion.click();
    await expect(motion).toHaveAttribute("aria-checked", "true");
    await expect(voice).toHaveAttribute("aria-checked", "false");
    // Only the selected radio is in the tab sequence.
    expect(await motion.getAttribute("tabindex")).toBe("0");
    expect(await voice.getAttribute("tabindex")).toBe("-1");
    expect(await keyboard.getAttribute("tabindex")).toBe("-1");
  });

  test("section links land below the fixed menu", async ({ page }) => {
    await page.goto(LANDING_PATH);
    // Every anchor the bar carries, not just the first one. A narrow bar
    // drops anchors on purpose; what it still shows has to land correctly.
    for (const section of MENU_SECTIONS) {
      const link = nav(page).getByRole("link", { name: section.label });
      if (!(await link.isVisible())) continue;
      await link.click();
      const target = page.locator(`#${section.id}`);
      await expect(target).toBeInViewport();
      const [top, barHeight] = await Promise.all([
        target.evaluate((el) => el.getBoundingClientRect().top),
        nav(page).evaluate((el) => el.getBoundingClientRect().height),
      ]);
      expect(top, section.id).toBeGreaterThanOrEqual(barHeight - 1);
      await expect(link).toHaveAttribute("aria-current", "location");
    }
  });

  test("keyboard mode keeps the picker in place; voice mode adds one listening button", async ({
    page,
  }) => {
    await page.goto(APP_PATH);
    await expect(page.getByLabel("PDF file")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Speak", exact: true }),
    ).toBeVisible();
    await modes(page)
      .getByRole("radio", { name: "Keyboard to action" })
      .click();
    await expect(page.getByLabel("PDF file")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Speak", exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(page.viewportSize()!.width);
  });
});

test.describe("the bar the film wears", () => {
  /**
   * The film's bar and the page's menu are the same panel, so they must stand
   * on the same two vertical lines. A bar that is even slightly narrower than
   * the one that replaces it makes the hand-off read as a change of product,
   * which is the whole reason the film borrowed the site's component.
   */
  async function barsAgree(page: Page) {
    const film = intro(page)
      .getByRole("navigation", { name: "Primary" })
      .first();
    await expect(film).toBeVisible();
    const filmBar = await film.boundingBox();
    const filmBrand = await film.locator(".brand").boundingBox();
    await page.getByRole("button", { name: "Skip intro" }).click();
    await expect(intro(page)).toHaveCount(0);
    const pageBar = await nav(page).boundingBox();
    const pageBrand = await nav(page).locator(".brand").boundingBox();
    expect(filmBar).not.toBeNull();
    expect(pageBar).not.toBeNull();
    expect(filmBrand).not.toBeNull();
    expect(pageBrand).not.toBeNull();
    // The panel: the same width, on the same left edge.
    expect(filmBar!.width).toBeCloseTo(pageBar!.width, 0);
    expect(filmBar!.x).toBeCloseTo(pageBar!.x, 0);
    // And the name inside it on the same line, so the padding matches too.
    expect(filmBrand!.x).toBeCloseTo(pageBrand!.x, 0);
  }

  test("stands exactly where the menu stands, on a wide screen", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(LANDING_PATH);
    await barsAgree(page);
  });

  test("stands exactly where the menu stands, on a phone", async ({ page }) => {
    await page.goto(LANDING_PATH);
    await barsAgree(page);
  });
});
