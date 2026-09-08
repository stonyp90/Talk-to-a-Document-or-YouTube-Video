# Local YouTube captions service

Uses [youtube-transcript-api](https://github.com/jdepoix/youtube-transcript-api) 1.2.4 to retrieve real public captions server-side without private credentials. English captions are preferred; otherwise the first available language is used. Text follows snippet order. Titles are honest video-ID labels, not fetched video metadata. Live failures never fall back to fixtures.

Build and run independently from the repository root:

```sh
docker build -t talk-transcript:local services/transcript
docker run --rm -p 127.0.0.1:3010:3010 -e TRANSCRIPT_MODE=live talk-transcript:local
curl http://localhost:3010/transcript/dQw4w9WgXcQ
```

Configure the application with `YOUTUBE_TRANSCRIPT_MODE=live` and `TRANSCRIPT_SERVICE_URL=http://transcript:3010` in Compose, or `http://localhost:3010` when running the application on the host. `YOUTUBE_TRANSCRIPT_MODE=mock` selects the application's in-process fixture instead. Service `TRANSCRIPT_MODE=mock` exercises the real HTTP boundary using deterministic fixtures; it does not retrieve captions. Both defaults are `live`. Compose may explicitly select mock for offline tests.

`GET /health` reports process health and mode, not upstream availability. `GET /transcript/{videoId}` accepts an 11-character ID and returns `{ "title": "YouTube video ...", "text": "..." }`.

Errors use `{ "error": { "code": "...", "message": "..." } }`:

| HTTP | Code               | Meaning                                                        |
| ---- | ------------------ | -------------------------------------------------------------- |
| 400  | INVALID_VIDEO_ID   | Invalid identifier                                             |
| 404  | NO_CAPTIONS        | Disabled, missing, or empty captions                           |
| 403  | CLOUD_BLOCKED      | YouTube rejected this network/IP; not proof of absent captions |
| 504  | TRANSCRIPT_TIMEOUT | Upstream request timed out                                     |
| 502  | UPSTREAM_ERROR     | Other provider failure, including inaccessible videos          |

`UPSTREAM_TIMEOUT_SECONDS=10` bounds each upstream HTTP request. Application `TRANSCRIPT_TIMEOUT_MS=20000` bounds the full service fetch, including response body consumption. The internal service may finish an in-flight upstream request after its caller disconnects. Bind it internally or on localhost; it is a demo adapter, not a public authenticated API.

`missing0000` produces NO_CAPTIONS in service mock mode. Other valid IDs produce the same deterministic transcript with an ID-specific label.

The Docker build runs Python unit tests. Re-run with `docker run --rm talk-transcript:local python -m unittest -v`. Application boundary tests: `npx vitest run packages/adapters/src/providers.test.ts`.

Verification on 2026-09-07: a live retrieval inside the Docker image for public video `dQw4w9WgXcQ` returned HTTP-equivalent status 200 with 2,089 caption characters and no credentials. This verifies this machine/network at that time; cloud providers may still receive CLOUD_BLOCKED. Unit tests and mock HTTP checks are separate from this live evidence.
