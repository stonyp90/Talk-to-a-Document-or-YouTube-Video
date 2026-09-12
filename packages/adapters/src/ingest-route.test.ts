import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { InputValidationError } from "../../core/src/domain/ingestion";
vi.mock("../../../apps/web/src/composition", () => ({
  ingestFormData: vi.fn(),
  openSource: vi.fn(),
}));
import { ingestFormData, openSource } from "../../../apps/web/src/composition";
import { POST } from "../../../apps/web/app/api/ingest/route";
import { resetRateLimits } from "../../../apps/web/src/http";

const post = (body: BodyInit, headers: Record<string, string> = {}) =>
  POST(
    new Request("http://localhost/api/ingest", {
      method: "POST",
      headers,
      body,
    }),
  );

beforeEach(() => {
  resetRateLimits();
  // These cases are about the route, not the gate; the gate has its own suite.
  vi.stubEnv("AUTH_MODE", "disabled");
  vi.mocked(ingestFormData).mockReset();
  vi.mocked(openSource).mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

/**
 * A client that sends the wrong content type has made a mistake of its own.
 * Reporting it as a server failure hides the fix from whoever has to make it,
 * and makes a healthy service look broken in the logs.
 */
it("reports a body it cannot read as form data as a client error", async () => {
  const response = await post('{"url":"https://youtu.be/abc"}', {
    "content-type": "application/json",
  });
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({
    code: "INVALID_FORM_DATA",
    error: expect.stringContaining("multipart/form-data"),
  });
  // Nothing was attempted, so nothing was spent on an unreadable request.
  expect(ingestFormData).not.toHaveBeenCalled();
  expect(openSource).not.toHaveBeenCalled();
});

it("still reports a readable form with nothing usable in it", async () => {
  vi.mocked(ingestFormData).mockRejectedValue(
    new InputValidationError(
      "Choose a PDF or enter a YouTube URL.",
      "SOURCE_REQUIRED",
    ),
  );
  const form = new FormData();
  form.set("url", " ");
  const response = await post(form);
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({
    code: "SOURCE_REQUIRED",
    error: "Choose a PDF or enter a YouTube URL.",
  });
});

it("still opens a session for a form it can read", async () => {
  const envelope = { sourceId: "abc", source: { kind: "youtube" } };
  vi.mocked(ingestFormData).mockResolvedValue(
    undefined as unknown as Awaited<ReturnType<typeof ingestFormData>>,
  );
  vi.mocked(openSource).mockResolvedValue(
    envelope as unknown as Awaited<ReturnType<typeof openSource>>,
  );
  const form = new FormData();
  form.set("url", "https://youtu.be/abc");
  const response = await post(form);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(envelope);
  expect(ingestFormData).toHaveBeenCalledOnce();
});
