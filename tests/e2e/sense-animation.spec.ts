import { expect, test } from "./base";
import { APP_PATH } from "../routes";
import { installWorkspaceFixtures, workspace } from "./human-sense-harness";

test("the Sense orb moves continuously and reflects the combined session", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await installWorkspaceFixtures(page);
  await page.goto(APP_PATH);
  const main = workspace(page);
  await expect(main).toBeVisible();
  const orbit = main
    .locator('[aria-hidden="true"][data-activity] > span')
    .first();
  const initial = await orbit.evaluate(
    (node) => getComputedStyle(node).transform,
  );
  await expect
    .poll(() => orbit.evaluate((node) => getComputedStyle(node).transform))
    .not.toBe(initial);
  await page
    .getByRole("button", { name: "Start experience", exact: true })
    .click();
  await expect(main).toHaveAttribute("data-sensing", "true");
  await expect(main).toHaveAttribute("data-activity", "listening");
  await page
    .getByRole("button", { name: "Stop experience", exact: true })
    .click();
  await expect(main).toHaveAttribute("data-activity", "idle");
  await expect(main).toHaveAttribute("data-sensing", "false");
});

test("reduced motion keeps the full experience usable with stationary visuals", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await installWorkspaceFixtures(page);
  await page.goto(APP_PATH);
  const main = workspace(page);
  await expect(main).toBeVisible();
  expect(
    await main.evaluate(
      (node) =>
        node
          .getAnimations({ subtree: true })
          .filter((animation) => animation.playState === "running").length,
    ),
  ).toBe(0);
  await page.getByRole("button", { name: "Add a source", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Add a source", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close source picker", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Workspace settings", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Workspace settings", exact: true }),
  ).toBeVisible();
  expect(
    await main.evaluate(
      (node) =>
        node
          .getAnimations({ subtree: true })
          .filter((animation) => animation.playState === "running").length,
    ),
  ).toBe(0);
});
