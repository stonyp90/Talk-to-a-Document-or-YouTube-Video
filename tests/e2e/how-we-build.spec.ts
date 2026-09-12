import type { Page } from "@playwright/test";
import { expect, test } from "./base";
import { resolveProcessCopy } from "../../apps/web/app/content/process";

const section = (page: Page) => page.locator("#how-we-build");
const caption = (page: Page) =>
  section(page).locator("p[class*='caption']").first();

/** French runs longest, so it is the copy that decides the reservation. */
const locales = ["/en", "/fr"] as const;

/**
 * The widths where the caption's wrapped height steps up: one column at 900
 * widens its measure and costs it a line, then the column itself gets narrow
 * and it climbs again. 340 is the deepest.
 */
const widths = [1280, 1160, 1000, 900, 700, 500, 390, 340, 320];

/**
 * The caption reserves room for the tallest stage summary so that the Pause
 * control beneath it does not move as the walk advances. Only a browser can
 * compare the reservation with the text the reader actually gets, which is why
 * this lives here and not beside the stylesheet.
 */
test("the caption reserves room for its tallest stage at every width", async ({
  page,
}) => {
  for (const locale of locales) {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(locale);
      await section(page).scrollIntoViewIfNeeded();

      const stages = section(page).getByRole("listitem").locator("button");
      const count = await stages.count();
      expect(count).toBeGreaterThan(0);

      // Walk every stage and record the tallest text the caption ever holds,
      // measured with the reservation lifted so the content speaks for itself.
      let tallest = 0;
      for (let index = 0; index < count; index += 1) {
        await stages.nth(index).click();
        tallest = Math.max(
          tallest,
          await caption(page).evaluate((element) => {
            const node = element as HTMLElement;
            const reserved = node.style.minHeight;
            node.style.minHeight = "0px";
            const height = node.scrollHeight;
            node.style.minHeight = reserved;
            return height;
          }),
        );
      }

      const reserved = await caption(page).evaluate((element) =>
        parseFloat(getComputedStyle(element).minHeight),
      );
      expect(
        reserved,
        `${locale} at ${width}px reserves ${reserved}px for ${tallest}px of caption`,
      ).toBeGreaterThanOrEqual(tallest);
    }
  }
});

/**
 * Selecting a stage pauses the walk, so the control must stay where the reader
 * last saw it while they read. This is the symptom the reservation prevents.
 */
test("the pause control holds still as the walk advances", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/fr");
  await section(page).scrollIntoViewIfNeeded();

  // By its exact name: a stage summary also mentions the loop, so a loose
  // match would resolve to more than one control.
  const copy = resolveProcessCopy("fr");
  const control = section(page)
    .getByRole("button", { name: copy.controls.pause, exact: true })
    .or(
      section(page).getByRole("button", {
        name: copy.controls.play,
        exact: true,
      }),
    );
  const stages = section(page).getByRole("listitem").locator("button");
  const count = await stages.count();

  // Laid-out position, not painted position: offsetTop ignores both the page
  // scroll that clicking a stage causes on a phone and the caption's one-shot
  // entry transform. Neither of those is the layout moving.
  const offsetInSection = () =>
    control.evaluate((element) => {
      const top = (node: HTMLElement) => {
        let total = 0;
        for (
          let current: HTMLElement | null = node;
          current;
          current = current.offsetParent as HTMLElement | null
        )
          total += current.offsetTop;
        return total;
      };
      return (
        top(element as HTMLElement) -
        top(document.querySelector("#how-we-build") as HTMLElement)
      );
    });

  const offsets = new Set<number>();
  for (let index = 0; index < count; index += 1) {
    await stages.nth(index).click();
    offsets.add(await offsetInSection());
  }
  expect([...offsets]).toHaveLength(1);
});
