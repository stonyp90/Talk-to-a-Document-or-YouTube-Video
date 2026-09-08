import { afterEach, expect, it, vi } from "vitest";
const send = vi.hoisted(() => vi.fn());
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = send;
  },
  GetObjectCommand: class {
    constructor(public input: unknown) {}
  },
  DeleteObjectCommand: class {
    constructor(public input: unknown) {}
  },
}));
vi.mock("./ingestion", () => ({
  extractPdfText: vi.fn().mockResolvedValue({ text: "all pages" }),
}));
import { extractUpload } from "./uploads";
afterEach(() => {
  send.mockReset();
  vi.unstubAllEnvs();
});
it("rejects arbitrary storage keys before contacting S3", async () => {
  await expect(extractUpload("private/other.pdf", "file.pdf")).rejects.toThrow(
    "Invalid upload reference",
  );
  expect(send).not.toHaveBeenCalled();
});
it("deletes temporary PDF after extraction", async () => {
  vi.stubEnv("UPLOAD_BUCKET", "test");
  send
    .mockResolvedValueOnce({
      ContentLength: 4,
      Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3, 4]) },
    })
    .mockResolvedValueOnce({});
  await expect(
    extractUpload(
      "uploads/12345678-1234-1234-1234-123456789abc.pdf",
      "file.pdf",
    ),
  ).resolves.toEqual({ text: "all pages" });
  expect(send).toHaveBeenCalledTimes(2);
});
