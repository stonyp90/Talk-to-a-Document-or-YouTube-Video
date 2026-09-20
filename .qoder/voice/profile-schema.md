# Voice Profile Schema

Defines the structure of a shareable voice profile.
All profiles must conform to this schema.

## Required fields

| Field | Type | Description |
|---|---|---|
| `name` | string | Profile display name |
| `speaker` | string | Who this profile represents |
| `locale` | string | BCP 47 locale tag (e.g., fr-CA, en-US) |
| `register` | string | Communication register (formal, natural, casual) |
| `tone` | string | Tone description |

## Optional fields

| Field | Type | Description |
|---|---|---|
| `languages` | string[] | Languages spoken, in preference order |
| `code_switching` | object | When and how to switch languages |
| `interaction_style` | object | Conciseness, clarification behavior, user relationship |
| `voice_tts` | object | TTS-specific: accent, pace, intonation, emotional range |
| `boundaries` | string[] | Hard rules this profile enforces |
| `shareability` | string | License/sharing terms |

## Provider agnosticism

Profiles contain NO provider-specific configuration.
They describe behavior and characteristics, not API parameters.
Any TTS or LLM provider can implement a profile.

## Validation

A profile is valid if:
1. All required fields are present
2. Locale is a valid BCP 47 tag
3. Boundaries are non-empty
4. Shareability is explicitly stated
