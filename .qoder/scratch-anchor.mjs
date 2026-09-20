import { chromium, devices } from "@playwright/test";

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices["iPhone 13"] });
await context.addInitScript(() => {
  window.__probe = [];
  const snap = (why) => {
    const el = document.getElementById("how-it-works");
    const cs = el ? getComputedStyle(el) : null;
    window.__probe.push({
      why,
      t: Math.round(performance.now()),
      scrollY: Math.round(scrollY),
      deScrollH: document.documentElement.scrollHeight,
      deClientH: document.documentElement.clientHeight,
      bodyOverflow: getComputedStyle(document.body).overflow,
      bodyScrollH: document.body.scrollHeight,
      bodyClientH: document.body.clientHeight,
      bodyScrollTop: document.body.scrollTop,
      elOffsetTop: el ? Math.round(el.offsetTop) : null,
      elRectTop: el ? Math.round(el.getBoundingClientRect().top) : null,
      elDisplay: cs?.display,
      elHeight: el ? Math.round(el.getBoundingClientRect().height) : null,
      dialogOpen: !!document.querySelector("dialog[open]"),
      sheets: document.styleSheets.length,
    });
  };
  addEventListener("DOMContentLoaded", () => snap("dcl"));
  addEventListener("load", () => snap("load"));
  for (const t of [50, 150, 300, 600, 1000, 1600, 2400])
    setTimeout(() => snap(`+${t}`), t);
});
const page = await context.newPage();
await page.goto("http://127.0.0.1:3000/en#how-it-works");
await page.waitForTimeout(3000);
for (const p of await page.evaluate(() => window.__probe))
  console.log(JSON.stringify(p));
await browser.close();
