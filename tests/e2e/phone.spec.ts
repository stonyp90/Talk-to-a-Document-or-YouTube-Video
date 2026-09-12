import { test as firstVisit, expect, type Page } from "@playwright/test";
import { test } from "./base";
import { APP_PATH, LANDING_PATH } from "../routes";

const PHONE = { width: 390, height: 844 };

/** What a thumb can reliably hit, in pixels. */
const THUMB = 44;

/**
 * Names every control matching `selector` that is shorter than a thumb.
 *
 * Heights are read from the layout box rather than from a client rectangle:
 * a phone renders at its own width and the visual viewport scales it, so a
 * forty-four pixel control measures forty-three through the rectangle and the
 * assertion would fail on arithmetic rather than on layout.
 */
async function tooSmall(page: Page, selector: string) {
  return page.evaluate(
    ({ selector, thumb }) => {
      for (const details of document.querySelectorAll("details"))
        (details as HTMLDetailsElement).open = true;
      return [...document.querySelectorAll<HTMLElement>(selector)]
        .filter(
          (control) =>
            control.offsetParent !== null &&
            control.offsetHeight > 2 &&
            control.offsetHeight < thumb,
        )
        .map(
          (control) =>
            `${(
              control.getAttribute("aria-label") ||
              control.innerText ||
              control.getAttribute("placeholder") ||
              "(unnamed)"
            )
              .replace(/\s+/g, " ")
              .slice(0, 40)} — ${control.offsetHeight}px`,
        );
    },
    { selector, thumb: THUMB },
  );
}

test.describe("the fixed menu on a phone", () => {
  /**
   * The bar is paper seen through glass: translucent, with the story passing
   * underneath. Take the blur away and it stops being glass and becomes a
   * window -- the page reads straight through the brand, the modes and the
   * way in, which on a phone is two rows of a short screen. The declaration
   * was once dropped on the way through the CSS pipeline, which is invisible
   * in the source and obvious on the screen, so it is asserted against the
   * stylesheet the browser actually received.
   */
  test("is glass in the browser, not only in the stylesheet", async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await page.goto(APP_PATH);
    const blur = await page
      .locator(".nav")
      .evaluate((nav) => getComputedStyle(nav).backdropFilter);
    expect(blur).not.toBe("none");
    expect(blur).toContain("blur");
  });

  test("gives the brand, the language and the way across a thumb to hit", async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await page.goto(APP_PATH);
    expect(await tooSmall(page, ".nav a, .nav button")).toEqual([]);
  });

  test("leaves the footer a thumb's worth of link, not a hairline", async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await page.goto(APP_PATH);
    expect(await tooSmall(page, ".footer-links a")).toEqual([]);
  });
});

test("every control in the workspace is a thumb's target, disclosures included", async ({
  page,
}) => {
  await page.setViewportSize(PHONE);
  await page.goto(APP_PATH);
  // Everything the page keeps folded away counts too: the saved voice
  // triggers behind "Customize commands" carried a 27px edit and remove.
  expect(
    await tooSmall(
      page,
      "#workspace button, #workspace summary, #workspace input:not([type=file]), #workspace select, #workspace a",
    ),
  ).toEqual([]);
});

test("the question a phone types takes the width of the phone", async ({
  page,
}) => {
  await page.setViewportSize(PHONE);
  await page.goto(APP_PATH);
  const field = page.getByLabel("Ask a question", { exact: true });
  const send = page.getByRole("button", { name: "Send", exact: true });
  const fieldBox = await field.boundingBox();
  const sendBox = await send.boundingBox();
  // Side by side, the field is short enough to cut its own placeholder in
  // half. Stacked, it reads, and the button is a full-width target.
  expect(sendBox!.y).toBeGreaterThanOrEqual(fieldBox!.y + fieldBox!.height);
  expect(fieldBox!.width).toBeGreaterThan(PHONE.width * 0.7);
  expect(sendBox!.width).toBeGreaterThan(PHONE.width * 0.7);
});

test("a phone page ends where its content ends", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto(APP_PATH);
  // The shell once reserved room at the bottom for a fixed dock of control
  // modes. The modes moved into the top bar; the reservation stayed, and
  // every phone page ended in most of a screenful of nothing.
  const slack = await page.evaluate(() => {
    const footer = document.querySelector(".footer");
    const bottom = footer!.getBoundingClientRect().bottom + window.scrollY;
    return document.documentElement.scrollHeight - bottom;
  });
  expect(slack).toBeLessThanOrEqual(48);
});

firstVisit(
  "the introduction says what the film is saying, at a size a phone can read",
  async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto(LANDING_PATH);
    const scene = page.getByTestId("intro-scene");
    await expect(scene).toBeVisible();
    // The film is drawn 1920 wide and shown around 340 here: its own type
    // lands near 11px. The page type beside it has to be page type.
    const size = await scene
      .locator("strong")
      .evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
    expect(size).toBeGreaterThanOrEqual(24);
    // And it has to be the film's own words, not a fixed line.
    await expect(scene).toContainText("The next generation of internet.");
  },
);

test("the brand sits on the page's left margin, just outside the first heading", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(APP_PATH);
  const edges = await page.evaluate(() => ({
    brand: document.querySelector(".nav .brand")!.getBoundingClientRect().left,
    heading: document.querySelector("h1")!.getBoundingClientRect().left,
  }));
  // The mark is the page's left margin; the heading begins just inside it.
  expect(edges.brand).toBeLessThan(edges.heading);
  expect(edges.heading - edges.brand).toBeLessThanOrEqual(12);
});
