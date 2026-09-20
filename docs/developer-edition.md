# Ursly Developer Edition

Status: plan, dictated by the owner on 2026-09-19 and 2026-09-20. Nothing in
sections 3 to 7 is built yet unless marked **built**.

## 1. Positioning

Ursly is a **communication interface**. Not a chatbot, not a transcription
tool: the layer between people and their systems, where the body, the voice and
the eyes replace the keyboard.

The developer pitch, in the order a developer needs to hear it:

1. **Talking is about twenty times faster than typing a ticket.** A room of ten
   enrolled people is ten parallel input channels, because each voice is
   recognised separately.
2. **Your voice is your credential.** Banks already authenticate callers by
   voice; Ursly does it for the people who operate infrastructure.
3. **One voice, every cloud.** Once authenticated, the same sentence reaches
   AWS, Azure and GCP through the permissions in section 5.
4. **It talks back before the bill does.** Ursly watches spend in real time and
   interrupts: "stop, that cluster has cost 400 dollars since this morning".
5. **Nothing is hidden.** Every datum Ursly holds about you is listed, scoped
   and revocable (sections 4 and 5).

## 2. The voice prompt (**built**)

The prompt is not a document anyone copies. It is assembled at session start in
`packages/core/src/domain/voiceControls.ts` (`voiceControlGuidance`) and sent
with the realtime session, together with four tools the model may call:

| Tool | The caller says something like | Effect |
| --- | --- | --- |
| `set_voice_output` | "arrête de parler", "just give me the text" | audio cut at once, answers continue in writing |
| `set_voice_speed` | "plus vite", "slow down" | pace changes from the next turn (provider range 0.25 to 1.5) |
| `set_assistant_name` | "je vais t'appeler Nova" | name saved and used from then on |
| `express_mood` | nothing: the model hears it | the stage changes colour and rhythm (calm, joyful, curious, hesitant, frustrated, angry, urgent) |

The guidance tells the model to act on intent, never on a keyword; to mirror the
caller's register (joual, rural English, swearing as punctuation) without
correcting it; to switch language when the caller does; and to match tone to
mood, fixing the problem rather than apologising when the caller is angry.

## 3. Developer mode

A role, not a hidden switch. It unlocks:

- the admin console of section 4;
- product restraints made configurable: confirmations before actions, answer
  length, rate limits, which tools the assistant may call, the raw event stream
  of a session, the assembled prompt and the model in use;
- user-defined voice actions: a phrase or a gesture bound to a webhook, under
  the caller's own permissions.

What it cannot unlock: the safety rules of the underlying model provider, and
consent. Those are not Ursly's to remove.

## 4. Admin console: every datum, granular

One screen per data category, each showing what is held, where, for how long,
who received it, and a revoke/export/delete control. The categories come from
the inventory in section 8.

## 5. Permissions, modelled on IAM

- **Principals**: users, groups, service accounts. A person is a principal; so
  is their enrolled voice, which is a credential attached to it.
- **Resources**: sources, conversations, voice prints, tracking streams, cloud
  connections, spend budgets, custom actions. Addressed as
  `ursly:<org>:<type>/<id>`.
- **Actions**: `source:Read`, `conversation:Export`, `voice:Enroll`,
  `cloud:Invoke`, `budget:Override`, and so on, one per verb per resource type.
- **Policies**: JSON documents with `Effect`, `Action`, `Resource`,
  `Condition`. Deny wins. Conditions include the sense used (`voice`, `gesture`,
  `text`), speaker-verification confidence, time and location.
- **Everything configurable by any sense**: "give the ops group read access to
  the billing dashboards" is a policy edit, confirmed by a pinch.

Hexagonal placement: policy evaluation is pure domain code in `packages/core`;
storage and cloud identity federation are adapters. The HTTP surface is
published through the generated OpenAPI document like the rest of the API.

## 6. Faster than listening: chunked audio

Today a recording has to be heard from start to end before it can be answered.
The plan borrows multipart object storage:

1. Cut the audio at silences found by a voice activity detector into parts of
   20 to 40 seconds, with a short overlap.
2. Transcribe the parts in parallel, each with the speaker labels of enrolled
   voices.
3. Reassemble by timestamp, removing the overlap, exactly as multipart uploads
   are reassembled by part number.
4. Store parts content-addressed and compressed (Opus), transcripts beside
   them, so an identical part is never processed or stored twice. Lifecycle
   rules move cold audio to cheaper storage and delete what no policy retains.

An orchestrator owns the queue, retries a failed part alone, and streams
partial results so the first answer arrives before the last part is done.

## 7. The daily improvement loop

`.github/workflows/tech-radar.yml` already runs every morning and opens an issue
with findings on voice activity detection and non-verbal analysis. To close the
loop:

- widen the scan to repositories and forums, ranked by adoption, not novelty;
- fan a question out to several models, score the answers against user
  feedback, and keep the ranking per task and per budget;
- turn an accepted finding into a pull request, deploy it to a canary
  (`infrastructure/scripts/canary-smoke.mjs`, `canary-rollback.mjs` exist),
  promote linearly, roll back on regression;
- feedback in every sense: a thumbs gesture, a sigh, a sentence, a click.
  Collected on the free tier; paying users get the updates without being
  studied;
- the learned rankings, prompts and evaluation sets are the proprietary
  intelligence. They stay in a Canadian region, under the owner's control.

Training on what the internet publishes is limited to what its licences allow;
training on users is limited to what they agreed to.

## 8. Data inventory

From a code audit on 2026-09-20. This is what the admin console of section 4
has to show, and what the permissions of section 5 have to govern.

| Category | What is held | Where, how long | Leaves Ursly to | Consent today |
| --- | --- | --- | --- | --- |
| Identity | email, hashed sign-in code, session token | process memory; code 10 min, session 14 days | AWS SES (email) | none beyond typing it |
| Usage | units spent per account, rolling 24 h | process memory | nobody | n/a |
| Sources | PDF bytes; extracted text and file name; YouTube id, title, transcript | S3 upload 1 day; session 1 h in memory or 1 day in S3 | OpenAI (full text in the prompt), transcript service, YouTube embed | none |
| Video search | the spoken query | not stored | YouTube Data API | none |
| Conversation | typed questions, answers, spoken-turn captions (last 12 turns) | with the session | OpenAI | none |
| Live voice | microphone stream, captions | not stored by Ursly | OpenAI Realtime; Chrome's recogniser sends audio to Google in the fallback path | browser prompt and a deliberate start |
| Voice print | lent-voice recording | browser memory only, never uploaded by the web app; CLI enrolment goes to OpenAI | OpenAI (CLI only) | two deliberate presses and a consent phrase: the only real consent flow |
| Caller mood | calm, joyful, curious, hesitant, frustrated, angry, urgent, inferred from the voice | React state, not stored | inferred by OpenAI | **none, and no opt-out yet** |
| Camera | 20x15 luminance grid, motion, gaze, dwell; face and pose on mobile are simulated | never leaves the page | nobody | browser prompt and a deliberate start |
| Device motion | accelerometer tilt | memory | nobody | permission wrapper |
| Feedback | rating, comment, source id, account id, plan | unbounded in-process map, no expiry | nobody | none |
| Preferences | mode, theme, intro seen, voice speed, assistant name, custom voice triggers | localStorage / AsyncStorage | assistant name goes into the prompt | none |
| Network | caller address for rate limiting (IPv6 by /64); client address to a Google STUN server | memory; CloudWatch logs 7 days | Google (STUN) | none |

No analytics or telemetry SDK is present, and no cookie banner, privacy policy
or terms of service exists in the product.

### What the audit says has to come first

1. **No permission model exists.** Authorisation is "signed in or not" plus a
   spend cap; the plan is hardcoded to free. Section 5 starts from zero.
2. **Accounts, sessions and usage live in process memory.** A restart signs
   everyone out and a second instance doubles every cap. Voice authentication
   and spend alerts need a real store before anything else.
3. **Mood inference needs a disclosure and an off switch** before it ships. It
   is the one derived signal about a person with no consent surface.
4. **The feedback store needs a bound and a retention period.**
5. **Lending a voice is not connected to enrolment.** Speaker recognition, the
   base of the ten-people-in-a-room claim, is not reachable from the app yet.
6. **Terms and a privacy notice** covering the table above, taught the way the
   rest of the interface is: shown, and accepted with one deliberate gesture.
