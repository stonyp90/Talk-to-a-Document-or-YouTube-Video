# 12-minute demonstration script

This is a recording script, not a completed video. Record live voice only after
the live verification gate passes; do not present mock output as live AI.

## 0:00–1:00 — Product and mobile layout

Open the public deployment (or clearly label localhost). Set the viewport to
390 × 844. Explain the two source types and show the disabled conversation
controls before ingestion. State which services are live and which are mocked,
including whether the live discussion channel is open or the typed path is
falling back to request/response; the line under the conversation says which.

## 1:00–3:00 — PDF ingestion

Choose a multi-page selectable-text PDF under 25 MB. Show the upload completing,
expand/collapse the preview, and compare both page excerpts with the source.
Explain direct temporary object storage, server-side parsing, deletion after
processing, and the 60,000-character conversation context limit. Demonstrate
an invalid file and the recoverable error. Repeat PDF upload on the public URL
to establish the PDF's required deployed-ingestion behavior.

## 3:00–4:30 — YouTube ingestion

With `TRANSCRIPT_MODE=live`, enter a video URL with accessible captions. Compare
the returned captions with the video. If AWS is blocked by YouTube, show the
actual error, switch to the local live captions service, and explain the cloud
IP limitation. A deterministic mock transcript is useful for tests but does not
satisfy this live demonstration.

## 4:30–7:00 — Live voice

With a server-side OpenAI key configured and `PROVIDER_MODE=live`, click Start
Voice Chat, grant microphone access, speak a source-specific question, and
capture both the spoken answer and incremental transcript. Ask a follow-up in
the same session. Interrupt the assistant by speaking. Demonstrate mute,
unmute, and Stop; confirm the microphone indicator clears. Do not reveal the
server key or the ephemeral session credential in the recording.

## 7:00–8:00 — Fallback and network failure

Deny microphone permission and ask a typed question. Show the answer arriving in
fragments over the open channel rather than in one block, and say why that
matters: a reader waits on the first words, not on the last. Then stop the `chat`
service mid-discussion. Show the status line reporting the channel closed, the
answer in flight reported as interrupted, the same question answered through the
HTTP fallback, and the channel reopening on its own when the service returns.
Demonstrate an offline or failed request, the error state, and retry after
connectivity returns. Distinguish automated fault injection from any actual
live-network test.

## 8:00–10:00 — Architecture and local iteration

Show the UI/domain/server boundaries, Python captions adapter, and native
companion. Explain React/TypeScript, WebRTC peer-to-provider media, short-lived
credentials from the server, and source text as untrusted context. Show the live
channel as a second composition root over the same use cases: the protocol in the
domain, one application channel, and two transports behind it, a long-lived Node
socket locally and a gateway function where nothing can hold a socket open. Say
why conversations moved to object storage, which is that the two are separate
processes and both have to resolve the same id. Show Compose and hot reload.
Explain container Lambda's pay-per-use suitability for an intermittent demo
versus an always-running ECS task. Actual total cost depends
on traffic, region, storage, and model usage; there is no promise of zero cost.

## 10:00–12:00 — Tests, delivery, and disclosure

Run unit tests and local Gherkin/browser acceptance checks. Show a real failing
assertion if illustrating regression detection; never use placeholder steps as
passing tests. Show the CI required check and the tested-SHA deployment workflow,
GitHub OIDC trust restrictions, scoped IAM, and Secrets Manager configuration.
Report external gates still pending. Explain AI assistance and the verification
performed. Finish with the public repository, deployment, and recording URLs.

## Recording release checklist

- [ ] Public GitHub repository and main revision verified.
- [ ] Public AWS URL and deployed PDF smoke test verified.
- [ ] Real caption retrieval demonstrated (local is acceptable).
- [ ] Real two-way audio, interruption, and follow-up recorded.
- [ ] Streamed typed answer, a dropped channel, and the HTTP fallback recorded.
- [ ] Audio recording includes both microphone and assistant playback.
- [ ] No credentials, private documents, or unrelated desktop content visible.
- [ ] Duration is between 10 and 15 minutes.
- [ ] Upload destination and public-sharing choice confirmed by project owner.
