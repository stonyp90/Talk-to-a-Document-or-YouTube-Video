# Infrastructure/server integration contract

Agreed routes (application implementation owned by the main agent):

1. `POST /api/uploads` takes `{name,type,size}`. Validate PDF MIME, nonempty file,
   and maximum **25 * 1024 * 1024 bytes** before signing. Return `{url,fields,key}`.
   Generate an unguessable `uploads/<random-id>.pdf` key; never use a caller's
   path or file name as the object key. Issue a short-lived presigned S3 POST
   with exact key/content type and `content-length-range` limited to 25 MiB.
2. Browser posts multipart fields plus file **directly to returned S3 URL**.
3. `POST /api/uploads/extract` takes `{key,name}`, validates the key prefix and
   server-issued upload authorization, checks stored object size/content type,
   reads from S3, verifies PDF magic, extracts text, and returns `{source}`.
   Delete the object after extraction, including failures. Bucket lifecycle is
   a one-day backstop, not proof of immediate deletion.

Never send 25 MiB PDF bytes through API Gateway/Lambda: synchronous Lambda
invocation limits are 6 MB and binary base64 encoding further reduces effective
capacity. Keep metadata requests and extracted-text responses bounded. Current
Lambda timeout is 28 seconds to fit the API integration window; extraction must
fail with a useful error before that deadline. Long-running extraction needs an
asynchronous job API; it is not provided by this stack.

Local environment:

| Variable | Value / purpose |
| --- | --- |
| `UPLOAD_BUCKET` | `talk-to-a-document-uploads` |
| `OBJECT_STORE_ENDPOINT` | `http://object-store:9000`, server reads/deletes |
| `OBJECT_STORE_PUBLIC_ENDPOINT` | `http://localhost:9002`, signing/browser POST |
| `AWS_ACCESS_KEY_ID` | `local-minio` (development only) |
| `AWS_SECRET_ACCESS_KEY` | `local-minio-password` (development only) |
| `OBJECT_STORE_ACCESS_KEY` | `local-minio`, application S3 client override |
| `OBJECT_STORE_SECRET_KEY` | `local-minio-password`, application S3 client override |
| `AWS_REGION` | `us-east-1` |
| `AWS_S3_FORCE_PATH_STYLE` | `true` |

Sign using the public endpoint; do not rewrite a URL after signing. Use separate
S3 clients for public signing and internal reads. Simulators/devices whose
localhost differs from the host need the public endpoint set to a reachable
host address (Android emulator normally uses `10.0.2.2`). Keep it environment
configurable. AWS omits endpoint overrides and uses the Lambda role credentials.
The AWS role permits only GetObject/PutObject/DeleteObject under `uploads/*`.

`OPENAI_SECRET_ARN` contains the exact Secrets Manager ARN. The application must
load its JSON `OPENAI_API_KEY` server-side; infrastructure does not inject the
secret value. Secrets use the default Secrets Manager KMS key; a customer KMS
key would also need scoped decrypt permissions in role and boundary.

Transcript: Compose sets app `YOUTUBE_TRANSCRIPT_MODE=live` and
`TRANSCRIPT_SERVICE_URL=http://transcript:3010`. Service `TRANSCRIPT_MODE=mock`
is the offline default; `TRANSCRIPT_MODE=live` retrieves real captions. GET
`/transcript/{videoId}` returns `{title,text}` or structured service errors.
AWS deploys this service as a second Lambda behind `/transcript/{videoId}`.
WebRTC mock remains explicitly in-process; there is no unused pretend WebRTC
network service. Live WebRTC/Hume and microphone evidence are release gates.
