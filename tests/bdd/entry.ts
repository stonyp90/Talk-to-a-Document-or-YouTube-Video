import assert from "node:assert/strict";
import { expect, type Page } from "@playwright/test";
import type { Step, World } from "./steps";
import { fixturePdf } from "./fixtures";
import { french } from "../../apps/web/app/i18n/fr";

type Helpers = {
  page: (w: World) => Promise<Page>;
  baseURL: string;
};

const INTRO_STORAGE_KEY = "ursly-intro-v1";

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
/** The one control that carries a visitor from the story into the tool. */
function openTheApp(p: Page) {
  return nav(p).getByRole("link", { name: "Open the app" });
}

/** The story, in the order it is meant to be read: the build loop leads. */
const STORY_IDS = [
  "how-we-build",
  "platform",
  "how-it-works",
  "applications",
] as const;

/** The sections as the page actually stacks them, top to bottom. */
function storyOrder(p: Page) {
  return p.evaluate(
    (ids) =>
      ids
        .map(
          (id) =>
            [
              id,
              document.getElementById(id)?.getBoundingClientRect().top ?? 0,
            ] as const,
        )
        .sort((a, b) => a[1] - b[1])
        .map(([id]) => id),
    [...STORY_IDS],
  );
}

/** Anything that leads into the application, wherever it sits on the page. */
function waysIn(p: Page, selector: string) {
  return p.locator(`${selector} a[href$="/app"]`);
}

/** Entry experience: introduction, fixed top menu, control modes, platform. */
export function registerEntryChecks(step: Step, h: Helpers) {
  step("I open the landing page for the first time", async function () {
    // Must be set before the page exists: a returning visitor is the default.
    this.firstVisit = true;
    const p = await h.page(this);
    await p.goto(h.baseURL);
  });
  step("the introduction video is playing in my language", async function () {
    const p = await h.page(this);
    await expect(intro(p)).toBeVisible();
    const player = video(p);
    await expect(player).toHaveAttribute("autoplay", "");
    await expect(player).toHaveAttribute("muted", "");
    const lang = await p.evaluate(() => document.documentElement.lang);
    await expect
      .poll(() => player.evaluate((v: HTMLVideoElement) => v.currentSrc))
      .toMatch(new RegExp(`/brand/ursly-intro\\.${lang}\\.(webm|mp4)$`));
    await expect
      .poll(() =>
        player.evaluate(
          (v: HTMLVideoElement) => !v.paused && v.currentTime > 0,
        ),
      )
      .toBe(true);
  });
  step("I can skip the introduction at any time", async function () {
    await expect(
      intro(await h.page(this)).getByRole("button", { name: "Skip intro" }),
    ).toBeEnabled();
  });
  step("the introduction ends", async function () {
    const p = await h.page(this);
    await video(p).evaluate((v: HTMLVideoElement) => {
      v.currentTime = Math.max(0, v.duration - 0.2);
    });
  });
  step(
    "the landing page is ready and no introduction remains",
    async function () {
      const p = await h.page(this);
      await expect(intro(p)).toHaveCount(0);
      // No workspace here: the story is the front door, the tool is a tap away.
      await expect(p.locator("#workspace")).toHaveCount(0);
      await expect(p.getByRole("heading", { level: 1 })).toBeVisible();
      // The introduction hands focus to the way in, so the keyboard is ready.
      const cta = p.locator("#main .hero-actions a.primary");
      await expect(cta).toBeVisible();
      await expect(cta).toBeFocused();
      assert.equal(
        await p.evaluate((key) => localStorage.getItem(key), INTRO_STORAGE_KEY),
        "seen",
      );
    },
  );
  step("the workspace is ready for a source", async function () {
    const p = await h.page(this);
    await expect(intro(p)).toHaveCount(0);
    await expect(p.locator("#workspace")).toBeVisible();
    await expect(p.getByLabel("PDF file")).toBeVisible();
  });
  step("I have already seen the introduction", function () {
    // Every page starts as a returning visitor unless a step asks otherwise.
    this.firstVisit = false;
  });
  step("no introduction is shown", async function () {
    await expect(intro(await h.page(this))).toHaveCount(0);
  });
  step("the introduction can be replayed from the top menu", async function () {
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
    // Landmarks and the primary action are named in the page language.
    await expect(nav(p)).toBeVisible();
    await expect(
      nav(p).getByRole("link", { name: "Ouvrir l’application" }),
    ).toBeVisible();
  });
  step("the control modes are named in French", async function () {
    const p = await h.page(this);
    // Read from the dictionary rather than repeated here: renaming a mode in
    // French is a copy decision, and it should not also be a test edit.
    await expect(
      nav(p).getByRole("radiogroup", { name: french["Control mode"] }),
    ).toBeVisible();
    await expect(
      nav(p).getByRole("radio", { name: french["Voice to action"] }),
    ).toHaveAttribute("aria-checked", "true");
  });
  step("the introduction video is the French version", async function () {
    const p = await h.page(this);
    await expect
      .poll(() => video(p).evaluate((v: HTMLVideoElement) => v.currentSrc))
      .toMatch(/\/brand\/ursly-intro\.fr\.(webm|mp4)$/);
    await expect(video(p).locator("track")).toHaveAttribute("srclang", "fr");
  });
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
  step(
    "the control modes read voice first, motion next and keyboard last",
    async function () {
      const p = await h.page(this);
      assert.deepEqual(
        await modes(p)
          .getByRole("radio")
          .evaluateAll((items) =>
            items.map((item) => item.getAttribute("aria-label")),
          ),
        ["Voice to action", "Motion to action", "Keyboard to action"],
      );
    },
  );

  step("voice to action is the selected control mode", async function () {
    await expect(
      modes(await h.page(this)).getByRole("radio", { name: "Voice to action" }),
    ).toHaveAttribute("aria-checked", "true");
  });
  step(
    "keyboard to action is marked legacy and can still be selected",
    async function () {
      const p = await h.page(this);
      const keyboard = modes(p).getByRole("radio", {
        name: "Keyboard to action",
      });
      await expect(keyboard).toContainText("Legacy");
      await expect(keyboard).not.toHaveAttribute("aria-disabled", "true");
      await keyboard.click();
      await expect(keyboard).toHaveAttribute("aria-checked", "true");
      await expect(
        modes(p).getByRole("radio", { name: "Voice to action" }),
      ).toHaveAttribute("aria-checked", "false");
    },
  );
  step(
    "motion to action is shown as the beta that comes next for headsets",
    async function () {
      const p = await h.page(this);
      const motion = modes(p).getByRole("radio", { name: /Motion to action/ });
      await expect(motion).toBeVisible();
      await expect(motion).toContainText("Beta");
      await expect(motion).toHaveAttribute("aria-disabled", "true");
      await expect(motion).toHaveAccessibleDescription(/not available yet/i);
      await expect(motion).toHaveAccessibleDescription(/VR and AR headsets/i);
      await motion.click({ force: true });
      await expect(motion).toHaveAttribute("aria-checked", "false");
      // Reaching for the beta leaves the selection exactly where it was.
      await expect(
        modes(p).getByRole("radio", { name: "Voice to action" }),
      ).toHaveAttribute("aria-checked", "true");
    },
  );
  step("how we build is the first section of the story", async function () {
    const p = await h.page(this);
    const [first] = await storyOrder(p);
    assert.equal(first, "how-we-build");
    // Nothing of the tool is above it: the story explains before it asks.
    await expect(p.locator("#workspace")).toHaveCount(0);
    const build = await p
      .locator("#how-we-build")
      .evaluate((el) => el.getBoundingClientRect().top);
    const platform = await p
      .locator("#platform")
      .evaluate((el) => el.getBoundingClientRect().top);
    assert.ok(build < platform, "the build loop is read before the platform");
  });
  step(
    "every part of the story offers a way into the application",
    async function () {
      const p = await h.page(this);
      for (const selector of [
        ".nav",
        ".landing-hero",
        "#how-we-build",
        "#platform",
        "#how-it-works",
        ".invitation",
        ".footer",
      ])
        assert.ok(
          (await waysIn(p, selector).count()) > 0,
          `a way into the application in ${selector}`,
        );
      // Every one of them points at the application in the page language.
      const lang = await p.evaluate(() => document.documentElement.lang);
      for (const href of await p
        .locator('a[href$="/app"]')
        .evaluateAll((links) => links.map((link) => link.getAttribute("href"))))
        assert.equal(href, `/${lang}/app`);
    },
  );
  step("I choose Platform in the top menu", async function () {
    const p = await h.page(this);
    await nav(p).getByRole("link", { name: "Platform" }).click();
  });
  step("the application is one tap from the landing page", async function () {
    const p = await h.page(this);
    // Exactly one: the promise is a hop, not a hunt.
    const cta = openTheApp(p);
    await expect(cta).toBeVisible();
    await cta.click();
    assert.match(new URL(p.url()).pathname, /^\/(en|fr)\/app$/);
    await expect(p.locator("#workspace")).toBeVisible();
    await expect(p.getByLabel("PDF file")).toBeVisible();
  });
  step(
    "the landing page tells the story without the workspace",
    async function () {
      const p = await h.page(this);
      await expect(p.locator("#workspace")).toHaveCount(0);
      await expect(p.getByLabel("PDF file")).toHaveCount(0);
      await expect(p.getByLabel("Ask a question", { exact: true })).toHaveCount(
        0,
      );
      // The story the founder asked for, in the order he named it.
      for (const id of STORY_IDS)
        await expect(p.locator(`#${id}`)).toHaveCount(1);
      assert.deepEqual(await storyOrder(p), [...STORY_IDS]);
    },
  );
  step("I return to the story from the application", async function () {
    const p = await h.page(this);
    const back = nav(p).getByRole("link", { name: "Back to the story" });
    await expect(back).toBeVisible();
    await back.click();
    assert.match(new URL(p.url()).pathname, /^\/(en|fr)$/);
    await expect(p.locator("#platform")).toHaveCount(1);
    await expect(p.locator("#workspace")).toHaveCount(0);
  });
  step("switching language keeps me in the application", async function () {
    const p = await h.page(this);
    const before = new URL(p.url()).pathname;
    const current = await p.locator("html").getAttribute("lang");
    const other = current === "fr" ? "English" : "Français";
    await nav(p).getByRole("link", { name: other }).click();
    await expect(p.locator("html")).toHaveAttribute(
      "lang",
      current === "fr" ? "en" : "fr",
    );
    const after = new URL(p.url()).pathname;
    assert.match(after, /^\/(en|fr)\/app$/);
    assert.notEqual(after, before);
    await expect(p.locator("#workspace")).toBeVisible();
  });
  step(
    "the platform section explains voice now, movement next and the keyboard as the old way",
    async function () {
      const p = await h.page(this);
      const section = p.locator("#platform");
      await expect(section).toBeVisible();
      await expect(section).toBeInViewport();
      for (const word of [
        /voice/i,
        /movement/i,
        /keyboard/i,
        /VR and AR headsets/i,
        /old way/i,
      ])
        await expect(section).toContainText(word);
    },
  );
  step(
    "the platform section explains connected objects, 3D objects and voice adaptation",
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
