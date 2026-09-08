import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { MAX_PDF_BYTES, validatePdf } from "../domain/ingestion";
import { extractPdfText } from "./ingestion";

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

export async function prepareUpload(file: {
  name: string;
  type: string;
  size: number;
}) {
  validatePdf(file);
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
}
export async function extractUpload(key: string, name: string) {
  if (!/^uploads\/[a-f0-9-]{36}\.pdf$/.test(key))
    throw new Error("Invalid upload reference.");
  const s3 = client();
  const Bucket = bucket();
  try {
    const object = await s3.send(new GetObjectCommand({ Bucket, Key: key }));
    if (
      !object.Body ||
      !object.ContentLength ||
      object.ContentLength > MAX_PDF_BYTES
    )
      throw new Error("Invalid PDF upload size.");
    const bytes = await object.Body.transformToByteArray();
    return await extractPdfText({
      name,
      type: "application/pdf",
      size: bytes.length,
      arrayBuffer: async () =>
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer,
    });
  } finally {
    await s3.send(new DeleteObjectCommand({ Bucket, Key: key }));
  }
}
