# Ursly Differentiation Analysis

## Core differentiators

### 1. Parallel media segmentation
- Split video/audio at frame level, process segments in parallel
- More segments = faster processing (scales with cores)
- No quality loss: stream copy, not re-encode
- Competitors process sequentially — we process in parallel

### 2. Human interface, not human-computer
- 5 senses: voice, motion, gaze, emotion, touch
- Not just keyboard + mouse
- Competitors: chat interfaces. Ursly: full human interface.

### 3. Non-verbal realtime
- Voice, motion, gaze processed in real-time
- Not post-processed, not batch
- Competitors: async. Ursly: realtime.

### 4. Model agnostic
- Every technology replaceable (port-in/adapter-out)
- Not locked to OpenAI, Anthropic, or any single provider
- Competitors: vendor lock-in. Ursly: provider-agnostic.

### 5. Emotion detection
- Reads emotional state from voice, face, body
- Adapts responses to user's emotional context
- Competitors: text-only sentiment. Ursly: multimodal emotion.

### 6. Shareable voice profiles
- Custom voice profiles that can be shared between users
- Provider-agnostic profile schema
- Competitors: fixed TTS voices. Ursly: custom, shareable profiles.

### 7. Privacy-first distribution
- Free social sharing (zero CAC), paid privacy
- The app IS the distribution channel
- Competitors: ad-funded or subscription-only. Ursly: privacy as product.

## Technical moat

| Capability | Ursly | Competitors |
|---|---|---|
| Parallel media processing | Yes (frame-level) | Sequential |
| Realtime non-verbal input | Yes (voice + motion + gaze) | Text only or voice only |
| Emotion detection | Multimodal | Text sentiment only |
| Model agnostic | Yes (hexagonal) | Vendor locked |
| Shareable voice profiles | Yes | Fixed voices |
| Privacy as feature | Core product | Afterthought |
| Keyboardless operation | Full support | Keyboard required |

## Messaging

- "Human interface solution" — not "human-computer interaction"
- "The keyboard is dead" — all 5 senses
- "Dialect adaptation" — French Canadian, Chinese, English natively
- "Interface to action" — every motion/animation serves this concept
