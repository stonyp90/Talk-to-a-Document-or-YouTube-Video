import { expect, test } from "@playwright/test";

for (const width of [320, 390, 1440]) {
  test(`welcome guide and progressive workspace work at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: "Start with something worth understanding.",
      }),
    ).toBeVisible();
    await expect(
      page.locator('.guide-step-rail [aria-current="step"] b'),
    ).toHaveText("Bring a source");
    await expect(
      page.getByLabel("Ask a question", { exact: true }),
    ).toBeHidden();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: "Use your voice when the thought arrives.",
      }),
    ).toBeFocused();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: "Start with something worth understanding.",
      }),
    ).toBeFocused();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Open Ursly" }).click();
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
  await page.getByRole("button", { name: "Skip guide" }).click();
  await expect(page.getByRole("button", { name: "Quick tour" })).toBeFocused();
});
