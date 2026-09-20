import type { Page } from "@playwright/test";
import { expect, test } from "./base";
import { APP_PATH, LANDING_PATH } from "../routes";
import { installSpeech } from "./voice-harness";

test("reduced motion keeps source tabs usable without animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(APP_PATH);
  await expect(
    page.getByRole("main", { name: "Sense to Action" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add a source", exact: true }).click();
  await page.getByRole("tab", { name: "YouTube video" }).click();
  await expect(page.getByLabel("YouTube URL")).toBeVisible();
  const motion = await page.evaluate(() => ({
    animations: document
      .getAnimations()
      .filter((animation) => animation.playState === "running").length,
    transition: getComputedStyle(document.querySelector(".tabs")!, "::before")
      .transitionDuration,
  }));
  expect(motion).toEqual({ animations: 0, transition: "0s" });
  await page.getByRole("tab", { name: "PDF file" }).click();
  await expect(page.getByLabel("PDF file")).toBeVisible();
});

for (const [name, path] of [["the landing page", LANDING_PATH]] as const) {
  test(`decorative motion on ${name} settles instead of continuously distracting`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(path);
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              document
                .getAnimations()
                .filter(
                  (animation) =>
                    animation.playState === "running" &&
                    animation.timeline instanceof DocumentTimeline,
                ).length,
          ),
        { timeout: 6500 },
      )
      .toBe(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
}

test("ambient workspace motion stops when reduced motion is requested", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(APP_PATH);
  const workspace = page.getByRole("main", { name: "Sense to Action" });
  await expect(workspace).toBeVisible();
  await expect
    .poll(() =>
      workspace.evaluate(
        (element) =>
          element
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === "running").length,
      ),
    )
    .toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() =>
      workspace.evaluate(
        (element) =>
          element
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === "running").length,
      ),
    )
    .toBe(0);
  await expect(
    page.getByRole("button", { name: "Start experience", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start motion", exact: true }),
  ).toHaveCount(0);
});

const running = (page: Page) =>
  page.evaluate(
    () =>
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.playState === "running" &&
            animation.timeline instanceof DocumentTimeline,
        ).length,
  );

test("the build loop moves only while it is on screen", async ({ page }) => {
  // The guarantee is unchanged: the walk steps while a reader is looking at
  // the picture and stops when they are not. Only the way to look away has
  // changed. The loop used to sit a screen down, so scrolling to the top hid
  // it; it now opens the page, and the top is where it is most visible. The
  // way off it is therefore downwards, to the end of the story. Without this
  // bound, "settles within 6.5s" would pass on a page whose only animation
  // never started, which proves nothing about the animation.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(LANDING_PATH);
  const loop = page.getByTestId("loop-diagram");
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(loop).toBeInViewport();
  await expect.poll(() => running(page), { timeout: 4000 }).toBeGreaterThan(0);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(loop).not.toBeInViewport();
  await expect.poll(() => running(page), { timeout: 6500 }).toBe(0);
  // And a reader who wants it still can stop it while looking straight at it.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => running(page), { timeout: 4000 }).toBeGreaterThan(0);
  await page.getByRole("button", { name: /Pause/ }).click();
  await expect.poll(() => running(page), { timeout: 6500 }).toBe(0);
});

test("the landing page adds no animation under reduced motion", async ({
  page,
}) => {
  // Measured with the picture straight on screen: the loop opens the page, so
  // the one thing that would still be moving is in front of the reader rather
  // than waiting below the fold where nothing would be observed.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(LANDING_PATH);
  await page.getByTestId("loop-diagram").scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter((animation) => animation.playState === "running").length,
    ),
  ).toBe(0);
});

test("the shared dock keeps the camera off until motion is requested", async ({
  page,
}) => {
  await installSpeech(page);
  await page.route("**/api/health", (route) =>
    route.fulfill({ json: { commandSpeech: "browser" } }),
  );
  await page.addInitScript(() => {
    const requests: MediaStreamConstraints[] = [];
    Object.defineProperty(window, "__cameraRequests", { value: requests });
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: (constraints: MediaStreamConstraints) => {
        requests.push(constraints);
        return Promise.reject(
          new DOMException("Camera denied by test", "NotAllowedError"),
        );
      },
    });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(APP_PATH);
  const motion = page.getByRole("button", {
    name: "Start experience",
    exact: true,
  });
  await expect(motion).toBeVisible();
  await expect(motion).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("button", { name: "Start experience", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Motion preview")).toBeHidden();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as Window & { __cameraRequests: unknown[] })
          .__cameraRequests,
    ),
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(motion).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await motion.click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Camera access was denied." }),
  ).toContainText("Camera access was denied.");
  await expect(page.getByLabel("Motion preview")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Stop experience", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as Window & { __cameraRequests: unknown[] })
          .__cameraRequests,
    ),
  ).toEqual([
    { video: { facingMode: "user", width: 320, height: 240 }, audio: false },
  ]);
});
