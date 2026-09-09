import { expect, test } from "@playwright/test";

test.describe("source conversation journey", () => {
  test("ingests a YouTube transcript and uses text fallback chat", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "YouTube video" }).click();
    await page
      .getByLabel("YouTube URL")
      .fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    await page.getByRole("button", { name: "Continue to questions" }).click();

    await page.locator(".preview summary").click();
    await expect(
      page.getByText(/deterministic local transcript/),
    ).toBeVisible();

    await page
      .getByLabel("Ask a question", { exact: true })
      .fill("What is this about?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(/Local demo response/)).toBeVisible();
  });

  test("starts a local mock voice session and supports mute/stop", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "YouTube video" }).click();
    await page.getByLabel("YouTube URL").fill("https://youtu.be/dQw4w9WgXcQ");
    await page.getByRole("button", { name: "Continue to questions" }).click();
    await page.locator(".voice-option summary").click();
    await page.getByRole("button", { name: "Start Voice Chat" }).click();
    await expect(page.getByText("Connected")).toBeVisible();
    await page.getByRole("button", { name: "Mute microphone" }).click();
    await expect(
      page.getByRole("button", { name: "Unmute microphone" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Stop" }).click();
    await expect(page.getByText("Ended")).toBeVisible();
  });
});
