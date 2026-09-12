// Photographs the running app so the introduction video can show the product
// instead of a drawing of it. The stills are committed under
// scripts/brand/stills, which is what lets intro-video.mjs render from the
// repository alone: nobody should need a screen recorder, a device, or a live
// server to rebuild the video, and CI has none of the three.
//
//   npm run dev            # anything serving the app, by default on :3100
//   node scripts/brand/capture-app.mjs
//
// Re-run it when the workspace visibly changes, look at the PNGs, and commit
// them with the change that moved them.
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const ORIGIN = process.env.URSLY_CAPTURE_ORIGIN ?? "http://localhost:3100";
const STILLS = "scripts/brand/stills";

// The gate that offers the introduction on a first visit covers the workspace,
// and the workspace is the thing worth photographing. Seeding the same key the
// gate writes on dismissal (INTRO_STORAGE_KEY in app/components/IntroGate.tsx)
// puts the browser in the state of a returning visitor.
const INTRO_STORAGE_KEY = "ursly-intro-v1";
const INTRO_STORAGE_VALUE = "seen";

// The development server floats its own toolbar over the corner of the page.
// It belongs to the toolchain, not to the product, so it never belongs in a
// still; hiding it also makes a still from `npm run dev` identical to one
// taken against a production build.
const HIDE_DEV_OVERLAYS = "nextjs-portal { display: none !important; }";

// English is the source language; the French still exists so the French video
// never shows an English product.
const LANGUAGES = ["en", "fr"];

// Two shapes, because the video argues that Ursly is the way in on whatever
// you are holding. Each is captured above its own size in the frame so text
// stays crisp when the renderer scales it down, and no further, because these
// PNGs are committed and every wasted pixel is carried forever.
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900, scale: 1.5 },
  { name: "phone", width: 375, height: 812, scale: 2 },
];

await mkdir(STILLS, { recursive: true });
const browser = await chromium.launch();

try {
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.scale,
      isMobile: viewport.name === "phone",
      hasTouch: viewport.name === "phone",
      colorScheme: "light",
      reducedMotion: "reduce", // A still should catch the page at rest, not mid-transition.
    });
    await context.addInitScript(
      ([key, value]) => {
        try {
          window.localStorage.setItem(key, value);
        } catch {
          // Private modes refuse storage; the gate then shows and the still is
          // worth discarding, which the human reviewing the PNG will notice.
        }
      },
      [INTRO_STORAGE_KEY, INTRO_STORAGE_VALUE],
    );

    for (const language of LANGUAGES) {
      const page = await context.newPage();
      const url = `${ORIGIN}/${language}`;
      const response = await page.goto(url, { waitUntil: "networkidle" });
      if (!response?.ok()) {
        throw new Error(`${url} answered ${response?.status() ?? "nothing"}`);
      }
      await page.addStyleTag({ content: HIDE_DEV_OVERLAYS });
      // Web fonts land after the network goes quiet and reflow the headings.
      await page.evaluate(() => document.fonts.ready);
      const path = join(STILLS, `app-${viewport.name}.${language}.png`);
      await page.screenshot({ path });
      await page.close();
      console.log(`captured ${path}`);
    }

    await context.close();
  }
} finally {
  await browser.close();
}
