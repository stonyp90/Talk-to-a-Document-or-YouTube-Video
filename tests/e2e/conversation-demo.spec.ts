import { expect, test } from "./base";

test("the recorded conversation loads on demand with playable audio/video and bilingual captions", async ({
  page,
}) => {
  const mediaRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/demo/voice-conversation.mp4"))
      mediaRequests.push(request.url());
  });
  await page.goto("/en");
  await expect(page.locator("#voice-demo video")).toHaveCount(0);
  expect(mediaRequests).toHaveLength(0);
  await page.getByText("Watch a real conversation", { exact: true }).click();
  const player = page.locator("#voice-demo video");
  await expect(player).toBeVisible();
  await player.evaluate((video: HTMLVideoElement) => {
    video.muted = true;
    return video.play();
  });
  await expect
    .poll(() => player.evaluate((video: HTMLVideoElement) => video.currentTime))
    .toBeGreaterThan(0);
  const media = await player.evaluate((video: HTMLVideoElement) => ({
    width: video.videoWidth,
    duration: video.duration,
    tracks: [...video.textTracks].map((track) => track.language),
  }));
  expect(media.width).toBeGreaterThan(0);
  expect(media.duration).toBeGreaterThan(30);
  expect(media.tracks).toEqual(["en", "fr"]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.getByText("Watch a real conversation", { exact: true }).click();
  await expect(player).toHaveCount(0);
  await page.goto("/fr");
  await page.getByText("Voir une vraie conversation", { exact: true }).click();
  await expect(page.locator('#voice-demo track[srclang="fr"]')).toHaveAttribute(
    "default",
    "",
  );
});
