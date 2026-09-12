import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { InputValidationError } from "../../core/src/domain/ingestion";
vi.mock("../../../apps/web/src/composition", () => ({
  openSource: vi.fn(),
  prepareUpload: vi
    .fn()
    .mockRejectedValue(
      new InputValidationError(
        "PDF files must be 25 MB or smaller.",
        "FILE_TOO_LARGE",
      ),
    ),
  extractUpload: vi
    .fn()
    .mockRejectedValue(
      new InputValidationError(
        "This PDF does not contain extractable text.",
        "EMPTY_PDF",
      ),
    ),
}));
import { POST as prepare } from "../../../apps/web/app/api/uploads/route";
import { POST as extract } from "../../../apps/web/app/api/uploads/extract/route";

// These cases are about upload validation, not the gate; the gate has its own suite.
beforeEach(() => {
  vi.stubEnv("AUTH_MODE", "disabled");
});
afterEach(() => {
  vi.unstubAllEnvs();
});
it("preserves actionable size errors from upload validation", async () => {
  const response = await prepare(
    new Request("http://localhost/api/uploads", {
      method: "POST",
      body: JSON.stringify({
        name: "huge.pdf",
        type: "application/pdf",
        size: 26_214_401,
      }),
    }),
  );
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({
    code: "FILE_TOO_LARGE",
    error: "PDF files must be 25 MB or smaller.",
  });
});
it("preserves no-text errors after direct object upload", async () => {
  const response = await extract(
    new Request("http://localhost/api/uploads/extract", {
      method: "POST",
      body: '{"key":"test","name":"test.pdf"}',
    }),
  );
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({
    code: "EMPTY_PDF",
    error: "This PDF does not contain extractable text.",
  });
});
