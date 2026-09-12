import assert from "node:assert/strict";
import { expect, type Page } from "@playwright/test";
import type { Step, World } from "./steps";
import { fixturePdf } from "./fixtures";

type Helpers = {
  page: (w: World) => Promise<Page>;
  open: (this: World) => Promise<void>;
  baseURL: string;
};

function intro(p: Page) {
  return p.getByRole("dialog", { name: /Ursly/ });
}
function video(p: Page) {
  return intro(p).locator("video");
}
/** Landmarks are named in the page language. */
function nav(p: Page) {
  return p.getByRole("navigation", { name: /^(Primary|Principale)$/ });
}
function modes(p: Page) {
  return nav(p).getByRole("radiogroup", { name: "Control mode" });
}

/** Entry experience: introduction, fixed top menu, control modes, platform. */
export function registerEntryChecks(step: Step, h: Helpers) {
  step("I open the application for the first time", async function () {
    // Must be set before the page exists: a returning visitor is the default.
    this.firstVisit = true;
    const p = await h.page(this);
    await p.goto(h.baseURL);
  });
  step(
    "adding a source is the first thing in the workspace",
    async function () {
      const p = await h.page(this);
      const picker = p.getByLabel("PDF file");
      await expect(picker).toBeVisible();
      // Nothing may sit between the workspace heading and the source card.
      const first = await p.evaluate(() => {
        const card = document.querySelector("#workspace > section");
        return card?.querySelector("h2")?.textContent?.trim() ?? "";
      });
      assert.match(first, /Add a source|Ajouter une source/);
      // The picker outranks the spoken-command panel inside that card.
      const order = await p.evaluate(() => {
        const card = document.querySelector("#workspace > section");
        if (!card) return "missing";
        const kids = [...card.children];
        const pickerIndex = kids.findIndex((el) =>
          el.querySelector("input#pdf-file"),
        );
        const actionsIndex = kids.findIndex((el) =>
          el.matches(".voice-actions, [data-voice-actions]"),
        );
        return actionsIndex === -1 || pickerIndex < actionsIndex
          ? "picker-first"
          : "actions-first";
      });
      assert.equal(order, "picker-first");
    },
  );
  step("the platform story is not on the workspace page", async function () {
    const p = await h.page(this);
    await expect(p.locator("#platform")).toHaveCount(0);
  });
  step(
    "the source picker is reachable within the first screen",
    async function () {
      const p = await h.page(this);
      await p.setViewportSize({ width: 390, height: 844 });
      await expect(p.getByLabel("PDF file")).toBeVisible();
      const top = await p
        .locator("#workspace")
        .evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
      assert.ok(top < 844, `workspace starts at ${top}px`);
    },
  );
  step("I have already seen the introduction", function () {
    // Every page starts as a returning visitor unless a step asks otherwise.
    this.firstVisit = false;
  });
  step("no introduction is shown", async function () {
    await expect(intro(await h.page(this))).toHaveCount(0);
  });
  step("the introduction can be played from the top menu", async function () {
    const p = await h.page(this);
    await nav(p).getByRole("button", { name: "Watch the intro" }).click();
    await expect(intro(p)).toBeVisible();
    await p.keyboard.press("Escape");
    await expect(intro(p)).toHaveCount(0);
  });
  step("my browser prefers French", function () {
    this.locale = "fr-CA";
  });
  step("the page language is French", async function () {
    const p = await h.page(this);
    await expect(p.locator("html")).toHaveAttribute("lang", "fr");
    await expect(
      nav(p).getByRole("radiogroup", { name: "Mode de contrôle" }),
    ).toBeVisible();
  });
  step(
    "the introduction played from the top menu is the French version",
    async function () {
      const p = await h.page(this);
      await nav(p)
        .getByRole("button", { name: /Voir l’intro|Watch the intro/ })
        .click();
      await expect(intro(p)).toBeVisible();
      await expect
        .poll(() => video(p).evaluate((v: HTMLVideoElement) => v.currentSrc))
        .toMatch(/\/brand\/ursly-intro\.fr\.(webm|mp4)$/);
      await expect(video(p).locator("track")).toHaveAttribute("srclang", "fr");
    },
  );
  step("the top menu stays fixed while I scroll", async function () {
    const p = await h.page(this);
    const bar = nav(p);
    await expect(bar).toBeVisible();
    assert.equal(
      await bar.evaluate((el) => getComputedStyle(el).position),
      "fixed",
    );
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await p.waitForTimeout(150);
    assert.ok((await p.evaluate(() => window.scrollY)) > 0, "page scrolled");
    assert.equal(
      await bar.evaluate((el) => Math.round(el.getBoundingClientRect().top)),
      0,
    );
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "no horizontal scrolling",
    );
  });
  step("voice to action is the selected control mode", async function () {
    await expect(
      modes(await h.page(this)).getByRole("radio", { name: "Voice to action" }),
    ).toHaveAttribute("aria-checked", "true");
  });
  step("keyboard to action can be selected", async function () {
    const p = await h.page(this);
    const keyboard = modes(p).getByRole("radio", {
      name: "Keyboard to action",
    });
    await keyboard.click();
    await expect(keyboard).toHaveAttribute("aria-checked", "true");
    await expect(
      modes(p).getByRole("radio", { name: "Voice to action" }),
    ).toHaveAttribute("aria-checked", "false");
  });
  step(
    "motion to action is shown as a beta that is not yet available",
    async function () {
      const p = await h.page(this);
      const motion = modes(p).getByRole("radio", { name: /Motion to action/ });
      await expect(motion).toBeVisible();
      await expect(motion).toHaveAttribute("aria-disabled", "true");
      await expect(motion).toHaveAccessibleDescription(/not available yet/i);
      await motion.click({ force: true });
      await expect(motion).toHaveAttribute("aria-checked", "false");
      await expect(
        modes(p).getByRole("radio", { name: "Keyboard to action" }),
      ).toHaveAttribute("aria-checked", "true");
    },
  );
  step("I choose Platform in the top menu", async function () {
    const p = await h.page(this);
    await nav(p).getByRole("link", { name: "Platform" }).click();
  });
  step(
    "the platform page explains voice, movement and keyboard control",
    async function () {
      const p = await h.page(this);
      const section = p.locator("#platform");
      await expect(section).toBeVisible();
      await expect(section).toBeInViewport();
      for (const word of [/voice/i, /movement/i, /keyboard/i])
        await expect(section).toContainText(word);
    },
  );
  step(
    "the platform page explains connected objects, 3D objects and voice adaptation",
    async function () {
      const section = (await h.page(this)).locator("#platform");
      for (const phrase of [
        /connected objects/i,
        /3D/,
        /your voice/i,
        /human/i,
      ])
        await expect(section).toContainText(phrase);
    },
  );
  step(
    "I can add a source and ask a question with at most three actions",
    async function () {
      const p = await h.page(this);
      let actions = 0;
      // 1. Choose the file: the picker is already on screen, no click before it.
      await expect(p.getByLabel("PDF file")).toBeVisible();
      await p.getByLabel("PDF file").setInputFiles({
        name: "three-actions.pdf",
        mimeType: "application/pdf",
        buffer: fixturePdf(["Three actions to an answer."]),
      });
      actions++;
      // 2. Continue.
      await p.getByRole("button", { name: "Continue to questions" }).click();
      actions++;
      // 3. Ask.
      const question = p.getByLabel("Ask a question", { exact: true });
      await expect(question).toBeFocused();
      await question.fill("What is this about?");
      await p.getByRole("button", { name: "Send", exact: true }).click();
      actions++;
      await expect(p.locator(".message.assistant").last()).toBeVisible();
      assert.ok(actions <= 3, `${actions} actions`);
    },
  );
}
