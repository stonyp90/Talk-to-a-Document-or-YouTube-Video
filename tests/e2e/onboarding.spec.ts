import { expect, test } from "@playwright/test";

for (const width of [320, 390, 1440]) {
  test(`welcome guide and progressive workspace work at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: "Bring something you’re curious about",
      }),
    ).toBeVisible();
    await expect(
      page.locator('.progress-steps [aria-current="step"]'),
    ).toHaveText("1 Add your source");
    await expect(
      page.getByLabel("Ask a question", { exact: true }),
    ).toBeHidden();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Ask in your own words" }),
    ).toBeFocused();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: "Bring something you’re curious about",
      }),
    ).toBeFocused();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Let’s get started" }).click();
    await expect(page.locator("#workspace")).toBeFocused();
    await page.reload();
    await expect(page.locator("#welcome-guide")).toHaveCount(0);
    await page.getByRole("button", { name: "Quick tour" }).click();
    await expect(page.locator("#welcome-title")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Quick tour" }),
    ).toBeFocused();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  });
}

test("welcome guide remains usable when browser storage is blocked", async ({
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
  await page.getByRole("button", { name: "Skip tour" }).click();
  await expect(page.getByRole("button", { name: "Quick tour" })).toBeFocused();
});
