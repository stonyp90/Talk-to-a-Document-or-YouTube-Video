import { expect, test } from "./base";
import { APP_PATH } from "../routes";
import { MINIMUM_SAMPLE_SECONDS } from "../../packages/core/src/domain/voiceConsent";
import {
  ANSWER,
  SOURCE_ID,
  workspace,
  mode,
  sourcePicker,
  question,
  installWorkspaceFixtures,
  expectSingleViewport,
  expectInputControls,
  expectFocusTrap,
  addPdf,
  voiceCaptureState,
  speechActivationState,
} from "./human-sense-harness";

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
  { name: "small phone", width: 320, height: 568 },
  { name: "landscape", width: 844, height: 390 },
]) {
  test.describe(`Sense to Action workspace on ${viewport.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await installWorkspaceFixtures(page);
      await page.goto(APP_PATH);
      await expect(
        page.getByRole("status", { name: "Ursly is opening", exact: true }),
      ).toHaveCount(0, { timeout: 15000 });
    });

    test("is one viewport with unified input and the requested mode badges", async ({
      page,
    }) => {
      await expect(workspace(page)).toBeVisible();
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "Sense to Action",
          exact: true,
        }),
      ).toBeVisible();
      await expect(mode(page, "Sense")).toHaveAttribute("aria-checked", "true");
      await expect(mode(page, "Keyboard to action")).toHaveAttribute(
        "aria-checked",
        "false",
      );
      await expectInputControls(page);
      await expect(
        mode(page, "Keyboard to action").getByText("Legacy", { exact: true }),
      ).toBeVisible();
      const brain = page.getByRole("button", {
        name: "Brain to action",
        exact: true,
      });
      await expect(brain).toHaveAttribute("aria-disabled", "true");
      await expect(brain.getByText("Beta", { exact: true })).toBeVisible();
      await expect(page.getByRole("contentinfo")).toHaveCount(0);
      await expectSingleViewport(page);

      await mode(page, "Sense").focus();
      await page.keyboard.press("ArrowRight");
      await expect(mode(page, "Keyboard to action")).toBeFocused();
      await expect(mode(page, "Keyboard to action")).toHaveAttribute(
        "aria-checked",
        "true",
      );
      await expectInputControls(page);
      await expectSingleViewport(page);
    });

    test("keeps navigation inside its bar and consolidates preferences in workspace settings", async ({
      page,
    }) => {
      const nav = page.getByRole("navigation", { name: "Primary" });
      await expect(nav).toBeVisible();
      const outside = await nav.evaluate((element) => {
        const bar = element.getBoundingClientRect();
        return Array.from(element.querySelectorAll<HTMLElement>("button, a"))
          .filter((control) => {
            const rect = control.getBoundingClientRect();
            return (
              rect.width > 0 &&
              rect.height > 0 &&
              getComputedStyle(control).visibility !== "hidden"
            );
          })
          .filter((control) => {
            const rect = control.getBoundingClientRect();
            return (
              rect.left < bar.left - 1 ||
              rect.top < bar.top - 1 ||
              rect.right > bar.right + 1 ||
              rect.bottom > bar.bottom + 1
            );
          })
          .map(
            (control) =>
              control.getAttribute("aria-label") ?? control.textContent?.trim(),
          );
      });
      expect(outside).toEqual([]);
      const menu = nav.getByRole("button", { name: "Open menu", exact: true });
      await expect(menu).toHaveCount(0);
      await page
        .getByRole("button", { name: "Workspace settings", exact: true })
        .click();
      const settings = page.getByRole("dialog", {
        name: "Workspace settings",
        exact: true,
      });
      await expect(
        settings.getByRole("link", { name: /Story|Back to the story/i }),
      ).toBeVisible();
      await expect(
        settings.getByRole("link", { name: "Français", exact: true }),
      ).toBeVisible();
    });

    test("starts and stops voice and motion together without opening sensors on arrival", async ({
      page,
    }) => {
      expect(await voiceCaptureState(page)).toEqual({ opens: 0, releases: 0 });
      expect(await speechActivationState(page)).toEqual({
        starts: 0,
        stops: 0,
      });
      await page
        .getByRole("button", { name: "Start experience", exact: true })
        .click();
      await expectInputControls(page, true);
      await expect
        .poll(() => voiceCaptureState(page))
        .toEqual({ opens: 1, releases: 0 });
      await expect
        .poll(() => speechActivationState(page))
        .toEqual({ starts: 1, stops: 0 });
      await expectSingleViewport(page);
      await page
        .getByRole("button", { name: "Stop experience", exact: true })
        .click();
      await expectInputControls(page);
      await expect
        .poll(() => voiceCaptureState(page))
        .toEqual({ opens: 1, releases: 1 });
      await expect
        .poll(() => speechActivationState(page))
        .toEqual({ starts: 1, stops: 1 });
      await expectSingleViewport(page);
    });

    test("opens source and settings on demand, trapping and returning keyboard focus", async ({
      page,
    }) => {
      const addSource = page.getByRole("button", {
        name: "Add a source",
        exact: true,
      });
      await addSource.click();
      const source = sourcePicker(page);
      await expect(source).toHaveAttribute("aria-modal", "true");
      await expect(
        source.getByRole("button", {
          name: "Close source picker",
          exact: true,
        }),
      ).toBeFocused();
      await expectFocusTrap(page, source);
      await page.keyboard.press("Escape");
      await expect(source).toHaveCount(0);
      await expect(addSource).toBeFocused();

      const settingsButton = page.getByRole("button", {
        name: "Workspace settings",
        exact: true,
      });
      await settingsButton.click();
      const settings = page.getByRole("dialog", {
        name: "Workspace settings",
        exact: true,
      });
      await expect(settings).toHaveAttribute("aria-modal", "true");
      await expect(
        settings.getByRole("button", { name: "Close settings", exact: true }),
      ).toBeFocused();
      await expect(
        settings.getByRole("button", { name: "Sign out", exact: true }),
      ).toBeVisible();
      await expectFocusTrap(page, settings);
      await page.keyboard.press("Escape");
      await expect(settings).toBeHidden();
      await expect(settingsButton).toBeFocused();
      await expectSingleViewport(page);
    });

    if (viewport.name === "desktop" || viewport.name === "mobile") {
      test("keeps voice lending consent accessible inside settings and preserves an approved sample", async ({
        page,
      }) => {
        await page.clock.install();
        const openSettings = page.getByRole("button", {
          name: "Workspace settings",
          exact: true,
        });
        await openSettings.click();
        const settings = page.getByRole("dialog", {
          name: "Workspace settings",
          exact: true,
        });
        expect(await voiceCaptureState(page)).toEqual({
          opens: 0,
          releases: 0,
        });
        const lend = settings.getByRole("button", {
          name: "Record a voice sample",
          exact: true,
        });
        await lend.click();
        const consent = settings.getByRole("alertdialog", {
          name: "Recording your voice",
          exact: true,
        });
        await expect(consent).toBeVisible();
        await expect(consent).toBeFocused();
        const keep = consent.getByRole("button", {
          name: "Keep the recording",
          exact: true,
        });
        const discard = consent.getByRole("button", {
          name: "Discard it",
          exact: true,
        });
        await expect(keep).toBeVisible();
        await expect(keep).toHaveAttribute("aria-disabled", "true");
        await discard.focus();
        await expect(discard).toBeFocused();
        await discard.press("Enter");
        await expect(consent).toHaveCount(0);
        expect(await voiceCaptureState(page)).toEqual({
          opens: 1,
          releases: 1,
        });
        await expect(
          settings.getByText("Recording discarded. Nothing was kept.", {
            exact: true,
          }),
        ).toBeVisible();

        await lend.click();
        await expect(consent).toBeVisible();
        await page.clock.fastForward((MINIMUM_SAMPLE_SECONDS + 1) * 1000);
        await expect(keep).not.toHaveAttribute("aria-disabled", "true");
        await keep.focus();
        await expect(keep).toBeFocused();
        await keep.press("Enter");
        await expect(consent).toHaveCount(0);
        expect(await voiceCaptureState(page)).toEqual({
          opens: 2,
          releases: 2,
        });
        await expect(
          settings.getByRole("button", {
            name: "Delete the recording",
            exact: true,
          }),
        ).toBeVisible();
        await settings
          .getByRole("button", { name: "Close settings", exact: true })
          .click();
        await expect(settings).toBeHidden();
        await expect(openSettings).toBeFocused();
        await openSettings.click();
        const deleteRecording = settings.getByRole("button", {
          name: "Delete the recording",
          exact: true,
        });
        await expect(deleteRecording).toBeVisible();
        await deleteRecording.click();
        await expect(lend).toBeVisible();
        await expect(deleteRecording).toHaveCount(0);
        expect(await voiceCaptureState(page)).toEqual({
          opens: 2,
          releases: 2,
        });
      });
    }

    test("loads a PDF and answers in the same stage while voice and motion remain available", async ({
      page,
    }) => {
      await expect(workspace(page)).toBeVisible();
      const stage = await workspace(page).elementHandle();
      await page
        .getByRole("button", { name: "Start experience", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Stop experience", exact: true }),
      ).toBeVisible();
      await mode(page, "Keyboard to action").click();
      await expectInputControls(page, true);
      await addPdf(page);
      await expectInputControls(page, true);
      expect(await voiceCaptureState(page)).toEqual({ opens: 1, releases: 0 });
      expect(await speechActivationState(page)).toEqual({
        starts: 1,
        stops: 0,
      });
      expect(await stage?.evaluate((element) => element.isConnected)).toBe(
        true,
      );

      await question(page).fill("How do the inputs work together?");
      const answered = page.waitForRequest(
        (request) =>
          request.url().endsWith("/api/text-chat/stream") &&
          request.method() === "POST",
      );
      await question(page).press("Enter");
      expect((await answered).postDataJSON()).toMatchObject({
        sourceId: SOURCE_ID,
        question: "How do the inputs work together?",
      });
      await expect(
        page.getByRole("log", { name: "Conversation", exact: true }),
      ).toContainText(ANSWER);
      await expect(question(page)).toHaveValue("");
      await expectInputControls(page, true);
      await expectSingleViewport(page);
      expect(await voiceCaptureState(page)).toEqual({ opens: 1, releases: 0 });
      expect(await speechActivationState(page)).toEqual({
        starts: 1,
        stops: 0,
      });
      expect(await stage?.evaluate((element) => element.isConnected)).toBe(
        true,
      );
    });
  });
}
