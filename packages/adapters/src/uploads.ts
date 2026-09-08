import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { MAX_PDF_BYTES } from "../../core/src/domain/ingestion";
import type { TemporaryUploadPort } from "../../core/src/application/ports";

function client(publicUrl = false) {
  const endpoint = publicUrl
    ? process.env.OBJECT_STORE_PUBLIC_ENDPOINT
    : process.env.OBJECT_STORE_ENDPOINT;
  return new S3Client({
    region: process.env.AWS_REGION ?? "us-east-1",
    endpoint,
    forcePathStyle: !!endpoint,
    ...(endpoint
      ? {
          credentials: {
            accessKeyId: process.env.OBJECT_STORE_ACCESS_KEY ?? "local-minio",
            secretAccessKey:
              process.env.OBJECT_STORE_SECRET_KEY ?? "local-minio-password",
          },
        }
      : {}),
  });
}
function bucket() {
  const value = process.env.UPLOAD_BUCKET;
  if (!value) throw new Error("Object storage is not configured.");
  return value;
}

export function createS3Uploads(): TemporaryUploadPort {
  return {
    async prepare() {
      const key = `uploads/${crypto.randomUUID()}.pdf`;
      const signed = await createPresignedPost(client(true), {
        Bucket: bucket(),
        Key: key,
        Expires: 120,
        Fields: { "Content-Type": "application/pdf" },
        Conditions: [
          ["content-length-range", 1, MAX_PDF_BYTES],
          ["eq", "$Content-Type", "application/pdf"],
        ],
      });
      return { ...signed, key };
    },
    async read(key) {
      const object = await client().send(
        new GetObjectCommand({ Bucket: bucket(), Key: key }),
      );
      if (
        !object.Body ||
        !object.ContentLength ||
        object.ContentLength > MAX_PDF_BYTES
      )
        throw new Error("Invalid PDF upload size.");
      const bytes = await object.Body.transformToByteArray();
      if (bytes.length !== object.ContentLength)
        throw new Error("Invalid PDF upload size.");
      return bytes;
    },
    async delete(key) {
      await client().send(
        new DeleteObjectCommand({ Bucket: bucket(), Key: key }),
      );
    },
  };
}
