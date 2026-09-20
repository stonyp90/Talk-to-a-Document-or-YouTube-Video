# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: entry.spec.ts >> returning visitor >> the application route does render the workspace, and nothing of the story
- Location: tests/e2e/entry.spec.ts:400:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByLabel('Ask a question', { exact: true })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByLabel('Ask a question', { exact: true }) with timeout 5000ms
  - waiting for getByLabel('Ask a question', { exact: true })

```

```yaml
- link "Skip to workspace":
  - /url: "#workspace"
- navigation "Primary":
  - link "Ursly home":
    - /url: /en
    - text: ursly .
  - button "Open menu"
  - radiogroup "Control mode":
    - radio "Human sense to action" [checked]: Human sense
    - radio "Keyboard to action": Keyboard
    - button "Brain to action" [disabled]: Brain
- main "Human sense to action":
  - button "Workspace settings"
  - heading "Human sense to action" [level=1]
  - button "Add a source"
  - log "Conversation"
  - group "Human sense controls":
    - region "Speak":
      - button "Speak"
      - group: Customize commands
    - region "Motion":
      - button "Start motion": Motion
- alert
```

# Test source

```ts
  310 |       expect(height).toBeLessThanOrEqual(72);
  311 |       await expect(modes(page)).toHaveCount(0);
  312 |       const cta = heroCta(page);
  313 |       await expect(cta).toBeVisible();
  314 |       await expect(cta).toBeInViewport();
  315 |       const ctaBottom = await cta.evaluate(
  316 |         (el) => el.getBoundingClientRect().bottom,
  317 |       );
  318 |       expect(ctaBottom).toBeLessThanOrEqual(900);
  319 |       const restingTop = await bar.evaluate(
  320 |         (el) => el.getBoundingClientRect().top,
  321 |       );
  322 |       await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  323 |       await page.waitForTimeout(150);
  324 |       expect(await bar.evaluate((el) => el.getBoundingClientRect().top)).toBe(
  325 |         restingTop,
  326 |       );
  327 |       expect(
  328 |         await page.evaluate(() => document.documentElement.scrollWidth),
  329 |       ).toBeLessThanOrEqual(width);
  330 |     });
  331 |   }
  332 | 
  333 |   test("the landing page does not render the workspace", async ({ page }) => {
  334 |     await page.goto(LANDING_PATH);
  335 |     for (const locator of [
  336 |       page.locator("#workspace"),
  337 |       page.getByLabel("PDF file"),
  338 |       page.getByLabel("Ask a question", { exact: true }),
  339 |       page.getByRole("button", { name: "Start Voice Chat" }),
  340 |       page.locator(".conversation-card"),
  341 |       page.locator(".source-card"),
  342 |     ])
  343 |       await expect(locator).toHaveCount(0);
  344 |     // And it tells the story, in the order the story's own index writes it:
  345 |     // the loop that built this first, then how to use it. The list is read
  346 |     // from that index rather than repeated here, so a section can be moved or
  347 |     // renamed without this journey agreeing to it twice.
  348 |     const order = await page.evaluate(
  349 |       (ids: string[]) => {
  350 |         const placed = ids
  351 |           .map(
  352 |             (id) =>
  353 |               [
  354 |                 id,
  355 |                 document.getElementById(id)?.getBoundingClientRect().top,
  356 |               ] as const,
  357 |           )
  358 |           .filter(
  359 |             (entry): entry is readonly [string, number] =>
  360 |               entry[1] !== undefined,
  361 |           )
  362 |           .sort((a, b) => a[1] - b[1])
  363 |           .map(([id]) => id);
  364 |         return placed;
  365 |       },
  366 |       STORY_SECTIONS.map((section) => section.id),
  367 |     );
  368 |     expect(order).toEqual(STORY_SECTIONS.map((section) => section.id));
  369 |     // The decks that were taken out of the story are gone, not hidden: a
  370 |     // visitor came for two answers, not a stack of them.
  371 |     for (const id of ["platform", "pricing", "applications"])
  372 |       await expect(page.locator(`#${id}`), id).toHaveCount(0);
  373 |   });
  374 | 
  375 |   test("the way into the application repeats down the story", async ({
  376 |     page,
  377 |   }) => {
  378 |     await page.goto(LANDING_PATH);
  379 |     // A reader who stops anywhere has a way in within reach: the bar is fixed,
  380 |     // the first screen opens with it, and the invitation closes the story. The
  381 |     // guide holds no button of its own on purpose — the invitation is the next
  382 |     // thing on screen, and a page of repeated buttons is the deck problem this
  383 |     // page was trimmed for.
  384 |     //
  385 |     // The first screen answers to both of the first two names — it is the hero
  386 |     // and it is how we build — so that pair is one element checked twice, and
  387 |     // the day they part again both are already covered.
  388 |     for (const selector of [".nav", ".landing-hero", ".invitation", ".footer"])
  389 |       expect(
  390 |         await page.locator(`${selector} a[href$="/app"]`).count(),
  391 |         selector,
  392 |       ).toBeGreaterThan(0);
  393 |     const lang = await page.locator("html").getAttribute("lang");
  394 |     for (const href of await page
  395 |       .locator('a[href$="/app"]')
  396 |       .evaluateAll((links) => links.map((link) => link.getAttribute("href"))))
  397 |       expect(href).toBe(`/${lang}/app`);
  398 |   });
  399 | 
  400 |   test("the application route does render the workspace, and nothing of the story", async ({
  401 |     page,
  402 |   }) => {
  403 |     await page.goto(APP_PATH);
  404 |     await expect(page.locator("#workspace")).toBeVisible();
  405 |     await expect(
  406 |       page.getByRole("button", { name: "Add a source", exact: true }),
  407 |     ).toBeVisible();
  408 |     await expect(
  409 |       page.getByLabel("Ask a question", { exact: true }),
> 410 |     ).toBeVisible();
      |       ^ Error: expect(locator).toBeVisible() failed
  411 |     for (const id of STORY_SECTIONS.map((section) => section.id))
  412 |       await expect(page.locator(`#${id}`)).toHaveCount(0);
  413 |     // The skip link points at the workspace, which is this page's content.
  414 |     const skip = page.locator("a.skip-link");
  415 |     await expect(skip).toHaveAttribute("href", "#workspace");
  416 |     await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  417 |   });
  418 | 
  419 |   for (const language of ["en", "fr"] as const) {
  420 |     test(`the menu carries a reader both ways in ${language}`, async ({
  421 |       page,
  422 |     }) => {
  423 |       const into = language === "fr" ? "Ouvrir l’application" : "Open the app";
  424 |       const back =
  425 |         language === "fr" ? "Retour à l’histoire" : "Back to the story";
  426 |       const menu = page.getByRole("navigation", {
  427 |         name: language === "fr" ? "Principale" : "Primary",
  428 |       });
  429 |       await page.goto(`/${language}`);
  430 |       await menu.getByRole("link", { name: into }).click();
  431 |       await expect(page).toHaveURL(new RegExp(`/${language}/app$`));
  432 |       await expect(page.locator("#workspace")).toBeVisible();
  433 |       const trigger = menu.getByRole("button", {
  434 |         name: /Open menu|Ouvrir le menu/,
  435 |       });
  436 |       if (await trigger.isVisible()) await trigger.click();
  437 |       await menu
  438 |         .getByRole("link", { name: back })
  439 |         .filter({ visible: true })
  440 |         .click();
  441 |       await expect(page).toHaveURL(new RegExp(`/${language}$`));
  442 |       await expect(
  443 |         menu.getByRole("link", { name: into }).filter({ visible: true }),
  444 |       ).toBeVisible();
  445 |       await expect(page.locator("#workspace")).toHaveCount(0);
  446 |     });
  447 |   }
  448 | 
  449 |   test("mode switcher keeps keyboard navigation within the shared experience", async ({
  450 |     page,
  451 |   }) => {
  452 |     await page.goto(APP_PATH);
  453 |     const human = modes(page).getByRole("radio", {
  454 |       name: "Human sense to action",
  455 |     });
  456 |     const keyboard = modes(page).getByRole("radio", {
  457 |       name: "Keyboard to action",
  458 |     });
  459 |     await expect(human).toHaveAttribute("aria-checked", "true");
  460 |     await expect(modes(page).getByRole("radio")).toHaveCount(2);
  461 |     await expect(modes(page).getByText(/^(Beta|Legacy)$/)).toHaveCount(0);
  462 |     await expect(
  463 |       modes(page).getByRole("button", { name: "Brain to action" }),
  464 |     ).toHaveAttribute("aria-disabled", "true");
  465 |     await human.focus();
  466 |     await page.keyboard.press("ArrowRight");
  467 |     await expect(keyboard).toHaveAttribute("aria-checked", "true");
  468 |     await expect(keyboard).toBeFocused();
  469 |     await page.keyboard.press("ArrowRight");
  470 |     await expect(human).toHaveAttribute("aria-checked", "true");
  471 |     await expect(human).toBeFocused();
  472 |     await page.keyboard.press("End");
  473 |     await expect(keyboard).toBeFocused();
  474 |     await page.keyboard.press("Home");
  475 |     await expect(human).toBeFocused();
  476 |     expect(await human.getAttribute("tabindex")).toBe("0");
  477 |     expect(await keyboard.getAttribute("tabindex")).toBe("-1");
  478 |     await expect(
  479 |       page.getByRole("dialog", { name: "Add a source" }),
  480 |     ).toHaveCount(0);
  481 |   });
  482 | 
  483 |   test("section links land below the fixed menu", async ({ page }) => {
  484 |     await page.goto(LANDING_PATH);
  485 |     // Every anchor the bar carries, not just the first one. A narrow bar
  486 |     // drops anchors on purpose; what it still shows has to land correctly.
  487 |     for (const section of MENU_SECTIONS) {
  488 |       const link = nav(page).getByRole("link", { name: section.label });
  489 |       if (!(await link.isVisible())) continue;
  490 |       await link.click();
  491 |       const target = page.locator(`#${section.id}`);
  492 |       await expect(target).toBeInViewport();
  493 |       const [top, barHeight] = await Promise.all([
  494 |         target.evaluate((el) => el.getBoundingClientRect().top),
  495 |         nav(page).evaluate((el) => el.getBoundingClientRect().height),
  496 |       ]);
  497 |       expect(top, section.id).toBeGreaterThanOrEqual(barHeight - 1);
  498 |       await expect(link).toHaveAttribute("aria-current", "location");
  499 |     }
  500 |   });
  501 | 
  502 |   test("keyboard input keeps voice and motion available with source entry on demand", async ({
  503 |     page,
  504 |   }) => {
  505 |     await page.goto(APP_PATH);
  506 |     await modes(page)
  507 |       .getByRole("radio", { name: "Keyboard to action" })
  508 |       .click();
  509 |     for (const name of ["Speak", "Start motion", "Add a source"])
  510 |       await expect(
```