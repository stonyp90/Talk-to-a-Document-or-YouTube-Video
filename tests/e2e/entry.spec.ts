import { expect, test, type Page } from "@playwright/test";
import { APP_PATH, LANDING_PATH, appPath } from "../routes";
import {
  MENU_SECTIONS,
  STORY_SECTIONS,
} from "../../apps/web/app/content/story";

const INTRO_KEY = "ursly-intro-v1";
const intro = (page: Page) => page.getByRole("dialog", { name: /Ursly/ });
const nav = (page: Page) => page.getByRole("navigation", { name: "Primary" });
const modes = (page: Page) =>
  nav(page).getByRole("radiogroup", { name: "Control mode" });
const heroCta = (page: Page) => page.locator("#main .hero-actions a.primary");

/** Application preferences share its one settings dialog; the story keeps its menu. */
async function pickLanguage(page: Page, name: string) {
  if (new URL(page.url()).pathname.endsWith("/app")) {
    await page
      .getByRole("button", { name: /Workspace settings|Réglages de l’espace/ })
      .click();
    await page
      .getByRole("dialog", { name: /Workspace settings|Réglages de l’espace/ })
      .getByRole("link", { name })
      .click();
    return;
  }
  const menu = page.getByRole("navigation", { name: /^(Primary|Principale)$/ });
  const trigger = menu.getByRole("button", {
    name: /Open menu|Ouvrir le menu/,
  });
  if (await trigger.isVisible()) await trigger.click();
  await menu.getByRole("link", { name }).click();
}

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
      page.getByRole("button", { name: "Skip intro" }),
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
    await expect(
      page.getByRole("button", { name: "Add a source", exact: true }),
    ).toBeVisible();
  });

  test("never interrupts the application with the introduction", async ({
    page,
  }) => {
    // A first visit straight to /app is somebody's work, not an audience: a
    // modal video over it would be worse than missing the pitch.
    await page.goto(APP_PATH);
    await expect(
      page.getByRole("button", { name: "Add a source", exact: true }),
    ).toBeVisible();
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
      page.getByRole("button", { name: "Play the intro" }),
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
    // Switching language is remembered by the root URL.
    await pickLanguage(page, "English");
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
    await pickLanguage(page, "English");
    await expect(page).toHaveURL(/\/en\/app$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("#workspace")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add a source", exact: true }),
    ).toBeVisible();
    // And back again, from the English side.
    await pickLanguage(page, "Français");
    await expect(page).toHaveURL(/\/fr\/app$/);
    await expect(page.locator("#workspace")).toBeVisible();
  });
});

test.describe("arriving at a section of the story", () => {
  /**
   * A link into the middle of the story is a request to be shown that part.
   * Two things used to defeat it, both of them the page behaving well on its
   * own account: the introduction, which holds the page still while it runs,
   * and the boundary the story streams in behind, which means the browser's
   * own jump happens while the page is still a placeholder.
   */
  async function landedAt(page: Page, id: string) {
    const section = page.locator(`#${id}`);
    await expect(section).toBeInViewport();
    const [top, barHeight] = await Promise.all([
      section.evaluate((el) => el.getBoundingClientRect().top),
      nav(page).evaluate((el) => el.getBoundingClientRect().height),
    ]);
    expect(top, id).toBeGreaterThanOrEqual(barHeight - 1);
  }

  test("on a first visit, with the film stood aside", async ({ page }) => {
    await page.goto(`${LANDING_PATH}#how-it-works`);
    await expect(intro(page)).toHaveCount(0);
    // Nothing was marked seen on the reader's behalf: the film is still owed
    // to them, and the menu hands it over whenever they want it.
    expect(
      await page.evaluate((key) => localStorage.getItem(key), INTRO_KEY),
    ).toBe(null);
    await landedAt(page, "how-it-works");
    await nav(page).getByRole("button", { name: "Watch the intro" }).click();
    await expect(intro(page)).toBeVisible();
  });

  test("on a later visit, from any of the sections the story has", async ({
    page,
  }) => {
    await page.addInitScript(
      (key) => localStorage.setItem(key, "seen"),
      INTRO_KEY,
    );
    for (const section of STORY_SECTIONS) {
      await page.goto(`${LANDING_PATH}#${section.id}`);
      await landedAt(page, section.id);
    }
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
      // Source, conversation and input controls share the viewport below the bar.
      await expect(page.locator("#workspace")).toBeVisible();
      const [barBottom, workspaceTop] = await Promise.all([
        bar.evaluate((el) => el.getBoundingClientRect().bottom),
        page
          .locator("#workspace")
          .evaluate((el) => el.getBoundingClientRect().top),
      ]);
      expect(workspaceTop).toBeGreaterThanOrEqual(barBottom - 1);
      for (const name of ["Sense", "Keyboard to action"])
        await expect(modes(page).getByRole("radio", { name })).toBeInViewport();
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
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      expect(
        await page.evaluate(() => document.documentElement.scrollHeight),
      ).toBeLessThanOrEqual(900);
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
    // And it tells the story, in the order the story's own index writes it:
    // the loop that built this first, then how to use it. The list is read
    // from that index rather than repeated here, so a section can be moved or
    // renamed without this journey agreeing to it twice.
    const order = await page.evaluate(
      (ids: string[]) => {
        const placed = ids
          .map(
            (id) =>
              [
                id,
                document.getElementById(id)?.getBoundingClientRect().top,
              ] as const,
          )
          .filter(
            (entry): entry is readonly [string, number] =>
              entry[1] !== undefined,
          )
          .sort((a, b) => a[1] - b[1])
          .map(([id]) => id);
        return placed;
      },
      STORY_SECTIONS.map((section) => section.id),
    );
    expect(order).toEqual(STORY_SECTIONS.map((section) => section.id));
    // The decks that were taken out of the story are gone, not hidden: a
    // visitor came for two answers, not a stack of them.
    for (const id of ["platform", "pricing", "applications"])
      await expect(page.locator(`#${id}`), id).toHaveCount(0);
  });

  test("the way into the application repeats down the story", async ({
    page,
  }) => {
    await page.goto(LANDING_PATH);
    // A reader who stops anywhere has a way in within reach: the bar is fixed,
    // the first screen opens with it, and the invitation closes the story. The
    // guide holds no button of its own on purpose — the invitation is the next
    // thing on screen, and a page of repeated buttons is the deck problem this
    // page was trimmed for.
    //
    // The first screen answers to both of the first two names — it is the hero
    // and it is how we build — so that pair is one element checked twice, and
    // the day they part again both are already covered.
    for (const selector of [".nav", ".landing-hero", ".invitation", ".footer"])
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
    await expect(
      page.getByRole("button", { name: "Add a source", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Ask a question", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Start experience", exact: true }),
    ).toBeVisible();
    for (const id of STORY_SECTIONS.map((section) => section.id))
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
      await expect(
        menu.getByRole("button", { name: /Open menu|Ouvrir le menu/ }),
      ).toHaveCount(0);
      await page
        .getByRole("button", {
          name: /Workspace settings|Réglages de l’espace/,
        })
        .click();
      await page
        .getByRole("dialog", {
          name: /Workspace settings|Réglages de l’espace/,
        })
        .getByRole("link", { name: back })
        .click();
      await expect(page).toHaveURL(new RegExp(`/${language}$`));
      await expect(
        menu.getByRole("link", { name: into }).filter({ visible: true }),
      ).toBeVisible();
      await expect(page.locator("#workspace")).toHaveCount(0);
    });
  }

  test("mode switcher keeps keyboard navigation within the shared experience", async ({
    page,
  }) => {
    await page.goto(APP_PATH);
    const human = modes(page).getByRole("radio", {
      name: "Sense",
    });
    const keyboard = modes(page).getByRole("radio", {
      name: "Keyboard to action",
    });
    await expect(human).toHaveAttribute("aria-checked", "true");
    await expect(modes(page).getByRole("radio")).toHaveCount(2);
    await expect(keyboard.getByText("Legacy", { exact: true })).toBeVisible();
    await expect(
      modes(page)
        .getByRole("button", { name: "Brain to action" })
        .getByText("Beta", { exact: true }),
    ).toBeVisible();
    await expect(human.getByText(/^(Beta|Legacy)$/)).toHaveCount(0);
    await expect(
      modes(page).getByRole("button", { name: "Brain to action" }),
    ).toHaveAttribute("aria-disabled", "true");
    await human.focus();
    await page.keyboard.press("ArrowRight");
    await expect(keyboard).toHaveAttribute("aria-checked", "true");
    await expect(keyboard).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(human).toHaveAttribute("aria-checked", "true");
    await expect(human).toBeFocused();
    await page.keyboard.press("End");
    await expect(keyboard).toBeFocused();
    await page.keyboard.press("Home");
    await expect(human).toBeFocused();
    expect(await human.getAttribute("tabindex")).toBe("0");
    expect(await keyboard.getAttribute("tabindex")).toBe("-1");
    await expect(
      page.getByRole("dialog", { name: "Add a source" }),
    ).toHaveCount(0);
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

  test("keyboard input keeps the shared experience available with source entry on demand", async ({
    page,
  }) => {
    await page.goto(APP_PATH);
    await modes(page)
      .getByRole("radio", { name: "Keyboard to action" })
      .click();
    for (const name of ["Start experience", "Add a source"])
      await expect(
        page.getByRole("button", { name, exact: true }),
      ).toBeVisible();
    await expect(
      page.getByRole("dialog", { name: "Add a source" }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Add a source", exact: true })
      .click();
    const source = page.getByRole("dialog", {
      name: "Add a source",
      exact: true,
    });
    await expect(source.getByLabel("PDF file")).toBeVisible();
    await expect(
      source.getByRole("tab", { name: "YouTube video" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(source).toHaveCount(0);
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
