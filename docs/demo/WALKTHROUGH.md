# Ursly — requirements-based recording plan

Status: prepared. Real YouTube retrieval now works locally on the new network; simulator voice capture still needs stabilization.
Target duration: 12 minutes. **Default presentation language: English**, with a brief optional French-language demonstration.

## Before recording

- Confirm both backend and caption service are in live mode.
- Verify PDF extraction on https://ursly.io.
- Verify real server-side YouTube captions, at least locally.
- Check audible output in a short recording, not just visible transcripts.
- Use a quiet environment; exclude ambient personal conversations.
- Keep mute/stop accessible as transcripts arrive.
- Close credential, billing, and personal-content pages.
- Identify the backend used in each flow. A local simulator does not prove a production phone binary works.

## Twelve-minute sequence

| Time | Visible action | Required evidence |
| --- | --- | --- |
| 00:00–00:40 | Introduce Ursly and PDF/YouTube inputs | Brand, interface, purpose |
| 00:40–02:00 | Import Talk to a Document.pdf on the public site and open preview | Real server extraction of five readable pages |
| 02:00–04:10 | Start voice and ask the PDF questions below | Connected state, recognized questions, audible answers and transcription |
| 04:10–05:00 | Mute, unmute, interrupt, stop, and type a question | Working controls and text fallback |
| 05:00–06:20 | Enter a captioned YouTube URL and inspect text | Actual server retrieval; identify local hosting if applicable |
| 06:20–08:20 | Start a new conversation about the video | Faithful summary, follow-up and grounded answer |
| 08:20–09:10 | Show mobile layout, optional French, then return to English | Readable interface, no overflow |
| 09:10–10:00 | Temporarily interrupt and restore the network | Honest connection state, useful error, retry |
| 10:00–12:00 | Explain architecture, hosting, security and repository tests | Next.js/React/TypeScript, extraction, WebRTC, ephemeral credentials, README and limits |

## PDF questions

1. “What are the two kinds of sources this application must accept?” Expected: PDF up to 25 MB and a YouTube URL with accessible captions/transcript.
2. “Does the YouTube workflow have to work in the cloud?” Expected: it must work, but local demonstration is allowed for cloud IP blocks; PDF must work deployed.
3. “How should the application protect the OpenAI API key?” Expected: never expose it to the client; use ephemeral credentials or an authenticated backend route for Realtime.
4. Follow-up/interruption: “In one sentence, what happens if I cannot use a microphone?” Expected: text-chat fallback.

Use these expectations to assess actual responses. Do not insert them as though the app had spoken them.

## YouTube questions

Verified video: https://www.youtube.com/watch?v=UF8uR6Z6KLc — Steve Jobs at Stanford. Server-side extraction produced 12,131 characters on September 8, 2026 after changing networks. The three stories concern connecting the dots, love and loss, and death. Read the captions before assessing responses.

1. “What is the main idea of this video? Give me a short explanation.”
2. “Which example in the video best illustrates that idea?”
3. “Can you explain that example more simply?”

Check every claim against the transcript. Adapt the question if the source has no relevant example. Manually copied captions or test fixtures do not validate real YouTube ingestion.

## Technical explanation

- Next.js serves the mobile web interface and API; React Native/Expo provides additional native clients.
- PDFs are uploaded privately and extracted server-side. The preview lets viewers check the model's source.
- Python retrieves YouTube captions. Disclose any cloud block and demonstrate real local success.
- The server holds the OpenAI key; clients receive ephemeral credentials for WebRTC.
- Extracted content is untrusted reference material, not executable instructions.
- Show setup, tests, and AI-assistance disclosure in the README. Disclose the 60,000-character context limit if still present.

## Editing and acceptance

Record app sound and questions. Any explanatory narration must be distinct from Ursly's voice. Do not dub missing answers, reconstruct conversations, or conceal a failing flow. Chapter cuts are acceptable; preserve interaction order.

Review the complete video for intelligible voice, source accuracy, readable text, synchronized audio/video, and absence of secrets or personal conversations. Unexecuted scenarios remain unverified. Do not label a partial video as the final acceptance deliverable.
