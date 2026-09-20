#!/usr/bin/env node
/**
 * Demo video creator - captures screenshots and compiles into <30s videos.
 * Shows the full feature flow: landing → source → question → voice/motion modes.
 */

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const SHOTS_DIR = './demo-shots';
const WEB_VIDEO = './demo-web.mp4';
const MOBILE_VIDEO = './demo-mobile.mp4';

if (!fs.existsSync(SHOTS_DIR)) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
}

async function captureScreenshots(viewport, prefix) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const shots = [];
  let shotIndex = 0;

  // Mock session API to bypass sign-in for demo
  await page.route('**/api/auth/session', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ email: 'demo@ursly.app' }),
    });
  });

  // Inject session data before page loads
  await page.addInitScript(() => {
    // Pre-populate fetch to return mock session
    const originalFetch = window.fetch;
    window.fetch = async (url, options) => {
      if (typeof url === 'string' && url.includes('/api/auth/session')) {
        return new Response(JSON.stringify({ email: 'demo@ursly.app' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return originalFetch.call(window, url, options);
    };
  });

  async function snap(label) {
    const filename = `${prefix}-${String(shotIndex++).padStart(2, '0')}-${label}.png`;
    const filepath = path.join(SHOTS_DIR, filename);
    await page.screenshot({ path: filepath, fullPage: false });
    shots.push(filepath);
    console.log(`  📸 ${label}`);
  }

  try {
    // 1. Landing page
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(800);
    await snap('landing');

    // 2. App workspace
    await page.goto('http://localhost:3000/app', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(800);
    await snap('workspace');

    // 3. Dismiss sign-in dialog if present
    const signInDialog = page.getByRole('dialog', { name: /Sign in/i });
    if (await signInDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
      const closeButton = page.getByRole('button', { name: /Close|Dismiss|Cancel/i });
      if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click();
        await page.waitForTimeout(300);
      }
    }

    // 4. YouTube tab selected
    const youtubeTab = page.getByRole('tab', { name: /YouTube video/i });
    if (await youtubeTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await youtubeTab.click({ force: true });
      await page.waitForTimeout(400);
    }
    await snap('youtube-tab');

    // 4. URL entered
    const urlInput = page.getByLabel('YouTube URL');
    if (await urlInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await urlInput.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      await page.waitForTimeout(400);
    }
    await snap('url-entered');

    // 5. Continue to questions
    const continueBtn = page.getByRole('button', { name: /Continue to questions/i });
    if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await continueBtn.click({ force: true });
      await page.waitForTimeout(800);
    }
    await snap('continue-clicked');

    // 6. Question typed (voice UI visible on right)
    const questionInput = page.getByRole('textbox', { name: /Ask a question/i });
    if (await questionInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await questionInput.fill('What is the main topic of this video?');
      await page.waitForTimeout(400);
    }
    await snap('question-typed');

    // 7. Voice mode tab
    const voiceTab = page.getByRole('radio', { name: /Voice to action/i });
    if (await voiceTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Hide sign-in gate if present (it may be in DOM but not visible)
      await page.evaluate(() => {
        const gate = document.querySelector('dialog.sign-in-gate');
        if (gate) gate.style.display = 'none';
      });
      await voiceTab.click({ force: true });
      await page.waitForTimeout(600);
    }
    await snap('voice-mode');

    // 8. Motion mode tab
    const motionTab = page.getByRole('radio', { name: /Motion to action/i });
    if (await motionTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await motionTab.click({ force: true });
      await page.waitForTimeout(600);
    }
    await snap('motion-mode');

    // 9. Keyboard mode tab
    const keyboardTab = page.getByRole('radio', { name: /Keyboard to action/i });
    if (await keyboardTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await keyboardTab.click({ force: true });
      await page.waitForTimeout(600);
    }
    await snap('keyboard-mode');

  } catch (error) {
    console.error(`  ⚠️  Error: ${error.message}`);
  }

  await context.close();
  await browser.close();
  return shots;
}

function createVideo(shots, outputPath, durationPerShot) {
  return new Promise((resolve, reject) => {
    if (shots.length === 0) {
      reject(new Error('No screenshots to compile'));
      return;
    }

    const listFile = `${outputPath}.txt`;
    const content = shots.map(s => `file '${path.resolve(s)}'\nduration ${durationPerShot}`).join('\n');
    fs.writeFileSync(listFile, content + '\n');

    const ffmpeg = spawn('ffmpeg', [
      '-f', 'concat',
      '-safe', '0',
      '-i', listFile,
      '-vf', 'fps=30,format=yuv420p',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-movflags', '+faststart',
      outputPath,
      '-y'
    ]);

    ffmpeg.on('close', (code) => {
      try { fs.unlinkSync(listFile); } catch {}
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
    ffmpeg.on('error', reject);
  });
}

async function main() {
  console.log('🎬 Creating demo videos...\n');

  console.log('📹 Capturing web app (1440×900)...');
  const webShots = await captureScreenshots({ width: 1440, height: 900 }, 'web');
  console.log(`  → ${webShots.length} frames`);
  if (webShots.length > 0) {
    console.log('  🎞️  Compiling...');
    await createVideo(webShots, WEB_VIDEO, 3);
    console.log(`  ✅ ${WEB_VIDEO} (${webShots.length * 3}s)\n`);
  }

  console.log('📹 Capturing mobile app (390×844)...');
  const mobileShots = await captureScreenshots({ width: 390, height: 844 }, 'mobile');
  console.log(`  → ${mobileShots.length} frames`);
  if (mobileShots.length > 0) {
    console.log('  🎞️  Compiling...');
    await createVideo(mobileShots, MOBILE_VIDEO, 3);
    console.log(`  ✅ ${MOBILE_VIDEO} (${mobileShots.length * 3}s)\n`);
  }

  console.log('Done:');
  console.log(`  Web:   ${WEB_VIDEO}`);
  console.log(`  Mobile: ${MOBILE_VIDEO}`);
}

main().catch(error => {
  console.error('❌', error);
  process.exit(1);
});
