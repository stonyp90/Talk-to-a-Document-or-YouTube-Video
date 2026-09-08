import assert from "node:assert/strict";
import { expect, type Page } from "@playwright/test";
import {
  installRealtimeHarness,
  type RealtimeHarness,
} from "../support/realtime-harness";
import type { Step, World } from "./steps";

type Helpers = {
  page: (w: World) => Promise<Page>;
  ready: (this: World) => Promise<void>;
  open: (this: World) => Promise<void>;
  baseURL: string;
};
const controls = new WeakMap<World, RealtimeHarness>();
const transcript = "Preserved source answer.";
export function registerResilienceChecks(step: Step, h: Helpers) {
  async function setup(w: World) {
    const p = await h.page(w);
    // tsx's named-function annotation is harmless but absent in the browser realm.
    await p.addInitScript("globalThis.__name = (target) => target");
    controls.set(w, await installRealtimeHarness(p));
    await h.ready.call(w);
    return p;
  }
  async function connected(w: World) {
    const p = await setup(w);
    await p.getByRole("button", { name: "Start Voice Chat" }).click();
    await expect
      .poll(async () => (await controls.get(w)!.snapshot()).remoteDescriptions)
      .toBe(1);
    await controls.get(w)!.setConnection("connected");
    await expect(p.locator(".status")).toHaveText("Connected");
  }
  step(
    ["a voice session was connected", "a voice session is connected"],
    async function () {
      await connected(this);
    },
  );
  step(
    [
      "the WebRTC connection is temporarily interrupted",
      "the realtime connection is interrupted",
      "network quality degrades",
    ],
    async function () {
      await controls.get(this)!.setConnection("disconnected");
    },
  );
  step(
    [
      "the UI enters a reconnecting state",
      "the UI shows a degraded or reconnecting status",
    ],
    async function () {
      await expect((await h.page(this)).locator(".status")).toHaveText(
        "Reconnecting",
      );
    },
  );
  step("the client attempts recovery", async function () {
    const snapshot = await controls.get(this)!.snapshot();
    assert.equal(snapshot.peers, 1);
    assert.equal(snapshot.closedPeers, 0);
    assert.equal(snapshot.tracks[0].stopped, false);
    await expect(
      (await h.page(this)).getByRole("button", { name: "Stop", exact: true }),
    ).toBeEnabled();
  });
  step("the UI returns to connected when recovery succeeds", async function () {
    await controls.get(this)!.setConnection("connected");
    await expect((await h.page(this)).locator(".status")).toHaveText(
      "Connected",
    );
  });
  step("the conversation contains transcript turns", async function () {
    await connected(this);
    await controls
      .get(this)!
      .emit({
        type: "response.output_audio_transcript.done",
        item_id: "preserved-answer",
        transcript,
      });
    await expect((await h.page(this)).locator(".message.assistant")).toHaveText(
      transcript,
    );
  });
  step("all visible transcript turns remain available", async function () {
    await expect((await h.page(this)).locator(".status")).toHaveText(
      "Reconnecting",
    );
    await expect((await h.page(this)).locator(".message.assistant")).toHaveText(
      transcript,
    );
  });
  step("the user receives a clear recovery message", async function () {
    await expect((await h.page(this)).locator(".status")).toContainText(
      "Reconnecting",
    );
  });
  step("an ingestion or session request times out", async function () {
    await h.ready.call(this);
    const p = await h.page(this);
    await p.clock.install();
    await p.route("**/api/realtime/session", (route) =>
      route.abort("timedout"),
    );
    await p.getByRole("button", { name: "Start Voice Chat" }).click();
  });
  step("the timeout error is displayed", async function () {
    await expect(
      (await h.page(this)).locator("main [role=alert]"),
    ).toBeVisible();
  });
  step("a retry action is offered", async function () {
    await expect(
      (await h.page(this)).getByRole("button", { name: "Start Voice Chat" }),
    ).toBeEnabled();
  });
  step(
    "the application does not show a false success state",
    async function () {
      await expect((await h.page(this)).locator(".status")).toHaveText(
        "Needs attention",
      );
    },
  );
  step("extraction fails after a source is submitted", async function () {
    await h.open.call(this);
    const p = await h.page(this);
    await p.route("**/api/ingest", (route) =>
      route.fulfill({
        status: 503,
        json: { error: "Source extraction failed. Please retry." },
      }),
    );
    await p.getByRole("tab", { name: "YouTube video" }).click();
    await p.getByLabel("YouTube URL").fill("https://youtu.be/dQw4w9WgXcQ");
    await p.getByRole("button", { name: "Extract source text" }).click();
  });
  step("the result is rendered", async function () {
    await expect(
      (await h.page(this)).locator("main [role=alert]"),
    ).toContainText("Source extraction failed");
  });
  step("the source is not marked ready", async function () {
    await expect((await h.page(this)).locator("details.preview")).toHaveCount(
      0,
    );
  });
  step("starting a voice session is disabled", async function () {
    await expect(
      (await h.page(this)).getByRole("button", { name: "Start Voice Chat" }),
    ).toBeDisabled();
  });
  step(
    "the session changes between idle, preparing, connecting, connected, reconnecting, ended, and error",
    async function () {
      const p = await setup(this);
      const status = p.locator(".status"),
        start = p.getByRole("button", { name: "Start Voice Chat" }),
        stop = p.getByRole("button", { name: "Stop", exact: true });
      await expect(status).toHaveText("Ready");
      const gate = new Promise<void>((resolve) => {
        this.release = resolve;
      });
      await p.route("**/api/realtime/session", async (route) => {
        await gate;
        await route.fulfill({
          json: { mode: "live", clientSecret: "controlled-session" },
        });
      });
      await start.click();
      await expect(status).toHaveText("Preparing");
      await expect(start).toBeDisabled();
      await expect(stop).toBeEnabled();
      this.release?.();
      await expect
        .poll(
          async () => (await controls.get(this)!.snapshot()).remoteDescriptions,
        )
        .toBe(1);
      await expect(status).toHaveText("Connecting");
      await expect(start).toBeDisabled();
      await controls.get(this)!.setConnection("connected");
      await expect(status).toHaveText("Connected");
      await controls.get(this)!.setConnection("disconnected");
      await expect(status).toHaveText("Reconnecting");
      await expect(start).toBeDisabled();
      await stop.click();
      await expect(status).toHaveText("Ended");
      await expect(start).toBeEnabled();
      await start.click();
      await expect
        .poll(
          async () => (await controls.get(this)!.snapshot()).remoteDescriptions,
        )
        .toBe(2);
      await controls.get(this)!.setConnection("failed");
      await expect(status).toHaveText("Needs attention");
    },
  );
  step("the UI displays the corresponding status", async function () {
    await expect((await h.page(this)).locator(".status")).toHaveText(
      "Needs attention",
    );
  });
  step("controls match the current session state", async function () {
    const p = await h.page(this);
    await expect(
      p.getByRole("button", { name: "Start Voice Chat" }),
    ).toBeEnabled();
    await expect(
      p.getByRole("button", { name: "Stop", exact: true }),
    ).toBeDisabled();
    const snapshot = await controls.get(this)!.snapshot();
    assert.equal(snapshot.closedPeers, 2);
    assert.ok(snapshot.tracks.every((t) => t.stopped));
  });
}
