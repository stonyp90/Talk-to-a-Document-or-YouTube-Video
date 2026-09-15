import { expect, test } from "@playwright/test";

for (const language of ["en", "fr"]) {
  for (const { width, height } of [
    { width: 320, height: 568 },
    { width: 390, height: 900 },
    { width: 768, height: 1024 },
    { width: 844, height: 390 },
    { width: 1440, height: 900 },
  ]) {
    test(`the film and animated loop follow theme changes (${language}, ${width}px)`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`/${language}`);
      const player = page.locator(".intro-player");
      await expect(player).toBeVisible();
      // The app defaults to light theme regardless of OS preference.
      // Verify that initial render is light.
      await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
      await expect(player).toHaveCSS("object-fit", "contain");
      const expectVideoFits = async () => {
        const video = await player.boundingBox();
        const stage = await page.locator(".intro-stage").boundingBox();
        const footer = await page.locator(".intro-gate-footer").boundingBox();
        expect(video).not.toBeNull();
        expect(stage).not.toBeNull();
        expect(footer).not.toBeNull();
        expect(video!.y + video!.height).toBeLessThanOrEqual(
          stage!.y + stage!.height + 1,
        );
        expect(video!.y + video!.height).toBeLessThanOrEqual(footer!.y);
        const scene = page.locator(".intro-scene strong");
        if (await scene.isVisible()) {
          const headline = await scene.boundingBox();
          const footerPadding = await page
            .locator(".intro-gate-footer")
            .evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));
          expect(
            Math.abs(headline!.x - footer!.x - footerPadding),
          ).toBeLessThanOrEqual(1);
        }
      };
      expect(await player.evaluate((v: HTMLVideoElement) => v.paused)).toBe(
        true,
      );
      await expect
        .poll(() => player.evaluate((v: HTMLVideoElement) => v.readyState))
        .toBeGreaterThanOrEqual(2);
      await player.evaluate((v: HTMLVideoElement) => {
        v.pause();
        v.currentTime = 2;
      });
      await expect
        .poll(() => player.evaluate((v: HTMLVideoElement) => v.seeking))
        .toBe(false);
      const source = await player.evaluate(
        (v: HTMLVideoElement) => v.currentSrc,
      );
      const lightCanvas = await page
        .locator("body")
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      await expectVideoFits();
      await page.screenshot({
        path: testInfo.outputPath("intro-light.png"),
        scale: "css",
      });

      // Toggle to dark via the theme button and verify the change.
      const themeButton = page.locator(".nav-theme");
      await themeButton.click();
      await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
      await expect(player).toHaveCSS(
        "filter",
        "brightness(0.72) saturate(0.9)",
      );
      await expect(page.locator(".intro-skip")).toHaveCSS("filter", "none");
      await expect(page.locator(".intro-gate-footer")).toHaveCSS(
        "filter",
        "none",
      );
      await expectVideoFits();
      expect(
        await page
          .locator("body")
          .evaluate((el) => getComputedStyle(el).backgroundColor),
      ).not.toBe(lightCanvas);
      await page.screenshot({
        path: testInfo.outputPath("intro-dark.png"),
        scale: "css",
      });

      // Toggle back to light and verify stability.
      await themeButton.click();
      await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
      await expect(player).toHaveCSS("filter", "brightness(1) saturate(1)");
      await expectVideoFits();
      expect(
        await player.evaluate((v: HTMLVideoElement) => ({
          src: v.currentSrc,
          at: v.currentTime,
          paused: v.paused,
        })),
      ).toEqual({ src: source, at: 2, paused: true });
      await page.screenshot({
        path: testInfo.outputPath("intro-light-again.png"),
        scale: "css",
      });

      await page.keyboard.press("Escape");
      const loop = page.getByTestId("loop-diagram");
      await expect(loop).toBeVisible();
      const paints = () =>
        loop.evaluate((svg) =>
          [...svg.querySelectorAll("circle, text")].map(
            (el) => getComputedStyle(el).fill,
          ),
        );
      const lightPaints = await paints();
      await page.screenshot({
        path: testInfo.outputPath("animation-light.png"),
        scale: "css",
      });
      // Toggle to dark via button and verify loop paints change.
      await page.locator(".nav-theme").click();
      await expect.poll(paints).not.toEqual(lightPaints);
      await expect(loop).toHaveCSS("filter", "none");
      await page.screenshot({
        path: testInfo.outputPath("animation-dark.png"),
        scale: "css",
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
    });
  }
}
