# Ursly Product Index

On-demand reference. Load only the clauses relevant to the current task.
This project is Ursly / Talk to a Document — NOT Nota.

## Pillars (task must map to at least one)

1. **Human Gateway** — the product is the entry point between humans and machines
2. **Human Interface** — a full human interface solution, not human-computer interaction
3. **Emotion Detector** — real-time emotional and non-verbal signal processing
4. **Non-Verbal Interface in Realtime** — voice, motion, gaze, biometric inputs
5. **Model Aggregator Interface** — provider-agnostic, every technology replaceable

POC is phase 1. Phases 2/3 are not automatic requirements for every feature.

## Clauses

### Voice (sections 1.1, 1.2)
- Intention over keyword — understand what the user means, not just what they say
- Voice interruption handling
- Distance and ambient noise adaptation
- Speaker profiles and multi-speaker support
- Language and locale detection (auto-detect, including French/English/Chinese and dialects)
- **Permission gate**: any change to voice collection or training requires explicit review of permissions, consent, and retention. No real collection during tests without authorization.

### Journeys and integrations (section 1.3)
- voice-to-action and motion-to-action unified
- Keyboard path preserved (not removed)
- brain-to-action in beta
- PDF import and YouTube link support
- Targets: web + iOS/Android simulators. Verify targets actually present — do not confuse web emulation with native app. Signal missing/untestable targets.

### Architecture (section 1.4)
- Port-in / adapter-out (hexagonal)
- Technology agnostic — every component replaceable
- Single-responsibility models

### Interface (sections 1.4, 2.1–2.3)
- Full-screen immersion — no chrome, no fills, outlines only
- Body movement as input
- Interactive layers
- Verbal/text feedback at user's choice
- Minimal text
- Colors, animations, user feedback — read approved tokens and components from the repo; signal missing rules rather than inventing compliance
- Smooth entrance animations, honest indicators, no emoji

### Permissions and consent
- Voice/gaze/biometric data collection requires explicit consent review
- No real data collection in tests without authorization
- Proof of consent must exist before any collection

### Evidence and proofs
- Runner produces proofs, not agent text
- Proofs linked to tested content, uncommitted changes, base main, and relevant versions
- Modifications invalidate concerned results
- Missing/stale proof = BLOCKED
