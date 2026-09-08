import { expect, it, vi } from "vitest";
import { InputValidationError } from "../domain/ingestion";
vi.mock("./uploads", () => ({
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
import { POST as prepare } from "../../app/api/uploads/route";
import { POST as extract } from "../../app/api/uploads/extract/route";
it("preserves actionable size errors from upload validation", async () => {
  const response = await prepare(
    new Request("http://localhost/api/uploads", { method: "POST", body: "{}" }),
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
