import { expect, test, type Page } from "@playwright/test";
import {
  installRealtimeHarness,
  type RealtimeHarness,
} from "../support/realtime-harness";
import { pdfFixture } from "../pdf-fixture";
test.use({
  baseURL: process.env.TRANSPORT_BASE_URL ?? "http://localhost:3000",
});

// Explicit transport fault injection. No microphone/audio/network fidelity claim.
let harness: RealtimeHarness;
const status = (page: Page) => page.locator(".status");

test.beforeEach(async ({ page }) => {
  harness = await installRealtimeHarness(page);
  await page.goto("/");
  await page.getByLabel("PDF file").setInputFiles({
    name: "transport.pdf",
    mimeType: "application/pdf",
    buffer: pdfFixture("Transport test source"),
  });
  await page.getByRole("button", { name: "Extract source text" }).click();
  await expect(page.locator(".preview-text")).toContainText(
    "Transport test source",
  );
  await page
    .getByRole("button", { name: "Start Voice Chat", exact: true })
    .click();
  await expect
    .poll(async () => (await harness.snapshot()).remoteDescriptions)
    .toBe(1);
  await expect(status(page)).toHaveText("Connecting");
  await harness.setConnection("connected");
  await expect(status(page)).toHaveText("Connected");
});

async function transcript(page: Page) {
  await harness.emit({
    type: "conversation.item.input_audio_transcription.completed",
    item_id: "user-1",
    transcript: "What does it say?",
  });
  await harness.emit({
    type: "response.output_audio_transcript.delta",
    item_id: "answer-1",
    delta: "Preserved answer",
  });
  await harness.emit({
    type: "response.output_audio_transcript.done",
    item_id: "answer-1",
    transcript: "Preserved answer",
  });
  await expect(page.locator(".message")).toHaveText([
    "What does it say?",
    "Preserved answer",
  ]);
}

test("live client recovers transport and preserves transcript and mute state", async ({
  page,
}) => {
  await transcript(page);
  await page
    .getByRole("button", { name: "Mute microphone", exact: true })
    .click();
  expect((await harness.snapshot()).tracks[0].enabled).toBe(false);
  await page.clock.install();
  await harness.setConnection("disconnected");
  await expect(status(page)).toHaveText("Reconnecting");
  await expect(
    page.getByRole("button", { name: "Start Voice Chat", exact: true }),
  ).toBeDisabled();
  await harness.setConnection("connected");
  await page.clock.fastForward(15001);
  await expect(status(page)).toHaveText("Connected");
  await expect(page.locator(".message")).toHaveText([
    "What does it say?",
    "Preserved answer",
  ]);
  expect((await harness.snapshot()).tracks[0].enabled).toBe(false);
  await page
    .getByRole("button", { name: "Unmute microphone", exact: true })
    .click();
  expect((await harness.snapshot()).tracks[0].enabled).toBe(true);
});

test("Stop releases media and ignores late transport events", async ({
  page,
}) => {
  await transcript(page);
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(status(page)).toHaveText("Ended");
  expect(await harness.snapshot()).toMatchObject({
    closedPeers: 1,
    tracks: [{ enabled: true, stopped: true }],
  });
  await harness.setConnection("connected");
  await harness.emit({
    type: "response.output_audio_transcript.delta",
    item_id: "late",
    delta: "STALE",
  });
  await expect(status(page)).toHaveText("Ended");
  await expect(page.locator(".message")).toHaveCount(2);
});

test("failed transport preserves transcript and permits restart", async ({
  page,
}) => {
  await transcript(page);
  await harness.setConnection("failed");
  await expect(status(page)).toHaveText("Needs attention");
  await expect
    .soft(
      page.getByText("Voice connection failed. Start a new session.", {
        exact: true,
      }),
    )
    .toBeVisible();
  await expect(page.locator(".message")).toHaveCount(2);
  expect((await harness.snapshot()).tracks[0].stopped).toBe(true);
  await page
    .getByRole("button", { name: "Start Voice Chat", exact: true })
    .click();
  await expect
    .poll(async () => (await harness.snapshot()).remoteDescriptions)
    .toBe(2);
  await harness.setConnection("connected");
  await expect(status(page)).toHaveText("Connected");
  await expect(page.locator(".message")).toHaveCount(2);
});

test("unrecovered disconnect reaches a bounded failure", async ({ page }) => {
  await transcript(page);
  await page.clock.install();
  await harness.setConnection("disconnected");
  await expect(status(page)).toHaveText("Reconnecting");
  await page.clock.fastForward(15001);
  await expect(status(page)).toHaveText("Needs attention");
  await expect
    .soft(
      page.getByText(
        "Voice connection could not recover. Start a new session.",
        {
          exact: true,
        },
      ),
    )
    .toBeVisible();
  await expect(page.locator(".message")).toHaveCount(2);
  expect((await harness.snapshot()).tracks[0].stopped).toBe(true);
});
