import { expect, it } from "vitest";
import { extractPdfText } from "../../../apps/web/src/composition";
import { pdfFixture } from "../../../tests/pdf-fixture";
it("extracts real PDF contents", async () => {
  const bytes = pdfFixture("The source says forty two.");
  const result = await extractPdfText(
    new File([bytes], "source.pdf", { type: "application/pdf" }),
  );
  expect(result.text).toContain("The source says forty two.");
});
it("rejects renamed non-PDF bytes", async () => {
  await expect(
    extractPdfText(
      new File(["hello"], "source.pdf", { type: "application/pdf" }),
    ),
  ).rejects.toThrow("not a valid PDF");
});
