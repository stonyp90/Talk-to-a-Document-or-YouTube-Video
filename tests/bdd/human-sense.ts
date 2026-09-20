import { expect, type ElementHandle, type Page } from "@playwright/test";
import type { Step, World } from "./steps";
import { APP_PATH } from "../routes";
import {
  ANSWER,
  addPdf,
  expectFocusTrap,
  expectInputControls,
  expectSingleViewport,
  installWorkspaceFixtures,
  mode,
  question,
  sourcePicker,
  workspace,
  speechActivationState,
  voiceCaptureState,
} from "../e2e/human-sense-harness";

type Helpers = {
  page: (world: World) => Promise<Page>;
  baseURL: string;
};

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
  { width: 844, height: 390 },
];

export function registerHumanSenseChecks(step: Step, helpers: Helpers) {
  const stages = new WeakMap<World, ElementHandle<HTMLElement | SVGElement>>();

  async function open(world: World) {
    const page = await helpers.page(world);
    await page.goto(`${helpers.baseURL}${APP_PATH}`);
    await expect(workspace(page)).toBeVisible();
    await expect(
      page.getByRole("status", { name: "Ursly is opening", exact: true }),
    ).toHaveCount(0, { timeout: 15000 });
    return page;
  }

  step(
    "the human sense workspace uses local provider fixtures",
    async function () {
      const page = await helpers.page(this);
      // tsx preserves function/class names with this helper; browser-injected
      // fixture functions need the same runtime when run through Cucumber.
      await page.addInitScript("globalThis.__name = (target) => target");
      await installWorkspaceFixtures(page);
    },
  );

  step(
    "I open the unified workspace at desktop and mobile sizes",
    async function () {
      await open(this);
    },
  );

  step(
    "the complete workspace fits each viewport without page scrolling",
    async function () {
      const page = await helpers.page(this);
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport);
        await expectInputControls(page);
        await expectSingleViewport(page);
      }
    },
  );

  step(
    "Sense is primary while Keyboard is Legacy and Brain is Beta",
    async function () {
      const page = await helpers.page(this);
      await expect(mode(page, "Sense")).toHaveAttribute("aria-checked", "true");
      await expect(mode(page, "Keyboard to action")).toBeVisible();
      await expect(
        mode(page, "Keyboard to action").getByText("Legacy", { exact: true }),
      ).toBeVisible();
      const brain = page.getByRole("button", {
        name: "Brain to action",
        exact: true,
      });
      await expect(brain).toHaveAttribute("aria-disabled", "true");
      await expect(brain.getByText("Beta", { exact: true })).toBeVisible();
    },
  );

  step("I open the unified workspace source picker", async function () {
    const page = await open(this);
    await page
      .getByRole("button", { name: "Add a source", exact: true })
      .click();
    await expect(sourcePicker(page)).toHaveAttribute("aria-modal", "true");
  });

  step("keyboard focus stays inside the source picker", async function () {
    const page = await helpers.page(this);
    await expectFocusTrap(page, sourcePicker(page));
  });

  step(
    "closing the source picker returns focus to its opener",
    async function () {
      const page = await helpers.page(this);
      await page.keyboard.press("Escape");
      await expect(sourcePicker(page)).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Add a source", exact: true }),
      ).toBeFocused();
    },
  );

  step("I open the unified workspace settings", async function () {
    const page = await helpers.page(this);
    await page
      .getByRole("button", { name: "Workspace settings", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Workspace settings", exact: true }),
    ).toHaveAttribute("aria-modal", "true");
  });

  step("keyboard focus stays inside settings", async function () {
    const page = await helpers.page(this);
    await expectFocusTrap(
      page,
      page.getByRole("dialog", { name: "Workspace settings", exact: true }),
    );
  });

  step("closing settings returns focus to its opener", async function () {
    const page = await helpers.page(this);
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Workspace settings", exact: true }),
    ).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Workspace settings", exact: true }),
    ).toBeFocused();
  });

  step("I load the human sense PDF fixture", async function () {
    const page = await open(this);
    const stage = await workspace(page).elementHandle();
    if (stage) stages.set(this, stage);
    await page
      .getByRole("button", { name: "Start experience", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Stop experience", exact: true }),
    ).toBeVisible();
    await addPdf(page);
  });

  step("I ask a question with the unified keyboard input", async function () {
    const page = await helpers.page(this);
    await mode(page, "Keyboard to action").click();
    await question(page).fill("How do the inputs work together?");
    await question(page).press("Enter");
  });

  step("the answer appears in the same immersive workspace", async function () {
    const page = await helpers.page(this);
    await expect(
      page.getByRole("log", { name: "Conversation", exact: true }),
    ).toContainText(ANSWER);
    expect(
      await stages.get(this)?.evaluate((element) => element.isConnected),
    ).toBe(true);
    await expectSingleViewport(page);
  });

  step(
    "the shared experience control remains available after changing input preference",
    async function () {
      const page = await helpers.page(this);
      await expectInputControls(page, true);
      await mode(page, "Sense").click();
      await expectInputControls(page, true);
      await expectSingleViewport(page);
    },
  );

  step(
    "I arrive at the unified experience without starting it",
    async function () {
      await open(this);
    },
  );
  step("no microphone or camera has been started", async function () {
    const page = await helpers.page(this);
    expect(await voiceCaptureState(page)).toEqual({ opens: 0, releases: 0 });
    expect(await speechActivationState(page)).toEqual({ starts: 0, stops: 0 });
  });
  step("I start the shared experience", async function () {
    const page = await helpers.page(this);
    await page
      .getByRole("button", { name: "Start experience", exact: true })
      .click();
  });
  step("voice and movement are active together", async function () {
    const page = await helpers.page(this);
    await expectInputControls(page, true);
    await expect
      .poll(() => voiceCaptureState(page))
      .toEqual({ opens: 1, releases: 0 });
    await expect
      .poll(() => speechActivationState(page))
      .toEqual({ starts: 1, stops: 0 });
  });
  step("I stop the shared experience", async function () {
    const page = await helpers.page(this);
    await page
      .getByRole("button", { name: "Stop experience", exact: true })
      .click();
  });
  step("both input channels release their resources", async function () {
    const page = await helpers.page(this);
    await expectInputControls(page);
    await expect
      .poll(() => voiceCaptureState(page))
      .toEqual({ opens: 1, releases: 1 });
    await expect
      .poll(() => speechActivationState(page))
      .toEqual({ starts: 1, stops: 1 });
  });
}
