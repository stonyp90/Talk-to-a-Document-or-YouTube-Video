import { expect, test } from "./base";
import { APP_PATH } from "../routes";

test("a failed live command service releases the microphone and keeps manual actions usable", async ({
  page,
}) => {
  await page.route("**/api/health", (route) =>
    route.fulfill({
      json: {
        ok: true,
        mode: "live",
        commandSpeech: "realtime",
        directUpload: true,
      },
    }),
  );
  await page.route("**/api/speech/session", (route) =>
    route.fulfill({
      status: 503,
      json: { code: "SPEECH_UNAVAILABLE", error: "Temporarily unavailable" },
    }),
  );
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => new MediaStream(),
    });
  });
  await page.goto(APP_PATH);
  await expect(page.locator(".voice-commands")).toHaveAttribute(
    "data-speech-provider",
    "realtime",
  );
  await page.getByRole("button", { name: "Speak", exact: true }).click();
  await expect(page.locator(".voice-error")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Speak", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByLabel("PDF file")).toBeVisible();
});

test("Stop can cancel live command setup before microphone permission resolves", async ({
  page,
}) => {
  await page.route("**/api/health", (route) =>
    route.fulfill({
      json: { ok: true, mode: "live", commandSpeech: "realtime" },
    }),
  );
  let credentials = 0;
  await page.route("**/api/speech/session", (route) => {
    credentials++;
    return route.abort();
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: () => new Promise(() => {}),
    });
  });
  await page.goto(APP_PATH);
  await expect(page.locator(".voice-commands")).toHaveAttribute(
    "data-speech-provider",
    "realtime",
  );
  await page.getByRole("button", { name: "Speak", exact: true }).click();
  await expect(page.locator("#voice-actions-heading")).toHaveText(
    "Connecting…",
  );
  await page.locator(".voice-mic").click();
  await expect(
    page.getByRole("button", { name: "Speak", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  expect(credentials).toBe(0);
});
