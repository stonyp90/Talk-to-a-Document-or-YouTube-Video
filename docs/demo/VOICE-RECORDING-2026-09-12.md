# Recorded voice conversation — 12 September 2026

**Draft pending renewed capture.** This complete live take predates the final
playback-status correction. The app now keeps its Answering indicator active
until queued audio finishes; the recording must be renewed after Docker is
restored and the final browser checks pass. No audio or response was fabricated
to conceal that difference.

The selected website clip is `apps/web/public/demo/voice-conversation.mp4`:
59.44 seconds, 1440 × 1080, H.264 video and AAC audio. English and French WebVTT
captions and a JPEG poster accompany it. The site offers it under How it works →
Watch a real conversation. Opening the disclosure creates the player; closing it
stops playback and removes the player. Nothing autoplays or downloads as video
on the initial visit.

## What is real

- The local production build on port 3300 and its actual interface.
- Server-side PDF extraction, including the complete visible source preview.
- OpenAI transcription of “Upload” and “Let's talk”, followed by the application's
  normal deterministic action handlers.
- Two source-grounded questions, their actual OpenAI Realtime answers and audio,
  chronological streaming transcript, Mute and Stop.
- The complete take, with no edits to responses, no speed changes and no cuts.
- All observed WebRTC connections were closed after Stop.

The caller is generated macOS Samantha audio injected as a microphone fixture.
It is not a recording of Tony and does not certify a physical microphone, speaker,
phone or Bluetooth device. The audio mix contains the caller and the received
OpenAI audio track; native browser speech-synthesis confirmations are not in the
mix. No recognition result, provider response, credential or UI state was mocked.
English captions follow the spoken words; French captions translate them. Timing
is based on capture marks and provider playback events, with sentence blocks
split for readability rather than word-level forced alignment.

The synthetic PDF contains this entire text:

> Short breaks restore attention. Take a five-minute pause after each focus session.

The first question asks what it says about attention. The follow-up asks how to
apply it at work. Ursly's suggestion of a 25–30 minute timer is advice in the
answer, not a duration stated by the source.

## Evidence and reproduction

Run `node --import tsx scripts/demo/record-voice.mjs` against a live local stack.
Set `DEMO_ORIGIN` and `DEMO_OUTPUT` to select another origin or output directory.
The recorder refuses mock mode. It observes the real data channel and combines
actual inbound audio with the caller fixture. It waits for
`output_audio_buffer.stopped`, because `response.done` means generation finished,
not that the listener has heard the entire response.

The selected take's raw evidence is in
`output/verification/onboarding/evidence.json`, with raw browser video, the audio
mix, a screenshot and transcript beside it. This directory is intentionally
excluded from Git and Docker build contexts. The selected public media contain
only the synthetic attention note and its demonstration conversation.

A preceding take, `output/verification/voice-demo-final/evidence.json`, separately
proves natural interruption: incoming speech at 20.422 s caused an
`output_audio_buffer.cleared` event, followed by a successful second answer.
That take is retained as verification evidence; the website uses the complete
uninterrupted conversation.

This short onboarding asset is not the assessment's separate 10–15 minute
technical walkthrough. `WALKTHROUGH.md` remains the script for that deliverable.
