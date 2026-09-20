# Design Spec: Multimodal Immersive Experience

**Date:** 2026-09-18
**Status:** Approved for implementation
**Scope:** 6 workstreams covering authentication, video/media, voice visualization, motion design, testing, and integration

---

## 1. Problem Statement

The current application has several limitations relative to industry best-in-class:

- **Video is too small** — inline players constrained to 960px max width, no Fullscreen API usage
- **VoiceOrb is too small** — 120px circle with basic audio reactivity; not immersive enough
- **No facial/biometric authentication** — email OTP only; user wants WebAuthn/Passkey (Face ID, Touch ID, Windows Hello)
- **Sections lack multimodal richness** — text-only sections without simultaneous audio narration or background video
- **Motion is CSS-only** — no scroll-driven animations, no parallax, no Awwwards-quality motion
- **No coverage measurement** — 107 unit tests exist but no coverage reporting or visual regression testing

---

## 2. Workstream Overview

| WS | Name | Key Deliverable | Dependencies |
|----|------|----------------|--------------|
| WS1 | WebAuthn/Passkey Auth | Face ID / Touch ID / Windows Hello sign-in | None |
| WS2 | Fullscreen Video + Multimodal Sections | Fullscreen API + audio narration + background video per section | None |
| WS3 | VoiceOrb Enlarged + Advanced Effects | 200-300px orb with particles, ripples, depth | None |
| WS4 | GSAP Motion Design | ScrollTrigger, View Transitions, micro-interactions | None |
| WS5 | Comprehensive Testing | Coverage reporting, visual regression, performance budgets | WS1-WS4 (tests for each) |
| WS6 | Integration & Polish | Design tokens, i18n, a11y, performance | WS1-WS5 |

**Execution strategy:** Phase 0 (foundations) → Phase 1 (WS1-WS4 in parallel via sub-agents) → Phase 2 (WS5 + WS6 integration)

---

## 3. WS1 — WebAuthn/Passkey Authentication

### 3.1 Architecture

The existing hexagonal auth architecture (domain → application → adapters) already has clean port boundaries. WebAuthn slots in as a new adapter behind the existing `AccountStorePort` and a new `WebAuthnPort`.

### 3.2 Domain Layer

**New file:** `packages/core/src/domain/webauthn.ts`

- `CredentialDescriptor` type: `{ id: string, transports: string[] }`
- `WebAuthnChallenge` type: `{ challenge: string, userId: string, timeout: number }`
- `PasskeySession` type: `{ credentialId: string, accountId: string, createdAt: number }`

### 3.3 Application Layer

**New port:** `packages/core/src/application/ports.ts` — add `WebAuthnPort`:

```typescript
interface WebAuthnPort {
  generateRegistrationOptions(userId: string, email: string): Promise<RegistrationOptions>;
  verifyRegistration(response: unknown): Promise<CredentialDescriptor>;
  generateAuthenticationOptions(credentialId?: string): Promise<AuthenticationOptions>;
  verifyAuthentication(response: unknown): Promise<{ credentialId: string }>;
}
```

**New use case:** `packages/core/src/application/passkeys.ts`

- `registerPasskey(accountId, email, credentialResponse)` — verify + store credential
- `authenticateWithPasskey(credentialResponse)` — verify + open session
- `listPasskeys(accountId)` — show registered credentials
- `revokePasskey(accountId, credentialId)` — remove a credential

### 3.4 Adapter Layer

**New adapter:** `packages/adapters/src/webauthn.ts`

- Uses `@simplewebauthn/server` for server-side verification
- RP ID: configurable via `WEBAUTHN_RP_ID` env var (defaults to `ursly.io`)
- Origin: configurable via `WEBAUTHN_ORIGIN` env var
- Stores credentials in `AccountStorePort` (new methods on the interface)

**New API routes:**

- `POST /api/auth/passkey/register-options` — returns registration challenge
- `POST /api/auth/passkey/register` — verifies and stores credential
- `POST /api/auth/passkey/auth-options` — returns authentication challenge
- `POST /api/auth/passkey/auth` — verifies and opens session
- `GET /api/auth/passkeys` — lists user's passkeys
- `DELETE /api/auth/passkeys/:id` — revokes a passkey

### 3.5 Client Layer

**Web:** `apps/web/src/lib/passkey.ts`

- Uses `@simplewebauthn/browser` for `startRegistration()` and `startAuthentication()`
- `registerPasskey()` — calls register-options, runs browser prompt, posts result
- `authenticateWithPasskey()` — calls auth-options, runs browser prompt, posts result
- `isWebAuthnSupported()` — feature detection

**Web UI:** `apps/web/app/components/PasskeySignIn.tsx`

- Single-button sign-in: "Sign in with Face ID / Touch ID"
- Detects platform (Apple → "Face ID", other → "Touch ID" or "security key")
- Falls back to email OTP if WebAuthn not available
- Registration flow: after email OTP sign-in, offer "Save this device as passkey"

**Mobile:** `apps/mobile/src/PasskeyAuth.tsx`

- Uses `expo-local-authentication` for biometric prompt
- WebAuthn server-side flow same as web
- Fallback to email OTP

### 3.6 Auth Flow (Final)

```
First time on new device:
1. User taps "Sign in with Face ID"
2. If no passkey registered → fall back to email OTP
3. After email OTP success → offer "Save as passkey"
4. Browser/OS biometric prompt → credential stored

Returning user:
1. User taps "Sign in with Face ID"
2. OS biometric prompt (Face ID / Touch ID / Windows Hello)
3. WebAuthn assertion → server verifies → session opened
4. No email, no code, no password

Fallback (no biometric support):
1. Email OTP flow (existing)
```

### 3.7 Tests

- Unit: registration options generation, verification logic, credential storage
- Unit: authentication options, assertion verification, session creation
- Integration: full registration + auth flow with mock WebAuthn
- E2E: sign in with passkey, fallback to OTP, revoke passkey
- Edge: device not supported, credential deleted server-side, timeout, retry

---

## 4. WS2 — Fullscreen Video + Multimodal Sections

### 4.1 Fullscreen API

**New utility:** `apps/web/src/lib/fullscreen.ts`

```typescript
function requestFullscreen(element: HTMLElement): Promise<void>
function exitFullscreen(): Promise<void>
function isFullscreen(): boolean
function onFullscreenChange(callback: () => void): () => void
```

- Wraps vendor-prefixed APIs (`webkitRequestFullscreen`, etc.)
- Returns no-op on unsupported browsers

### 4.2 Video Player Upgrades

**IntroGate** (`apps/web/app/components/IntroGate.tsx`):

- Add fullscreen button (icon: expand) in custom controls
- Double-tap/click to toggle fullscreen
- Keyboard: `F` key toggles fullscreen
- In fullscreen: video fills screen, custom controls overlay at bottom with auto-hide
- Mobile: pinch-to-zoom gesture support

**ConversationDemo** (`apps/web/app/components/ConversationDemo.tsx`):

- Add custom fullscreen control (currently relies on native controls only)
- Same fullscreen UX as IntroGate

**Motion Camera** (`apps/web/app/components/MotionActions.tsx`):

- Replace CSS-only "fullscreen" with real Fullscreen API
- Camera preview fills screen in fullscreen mode

**Mobile video** (`apps/mobile/src/IntroVideo.tsx`):

- Already has native controls with fullscreen; add explicit fullscreen button
- Landscape auto-rotate on fullscreen enter

### 4.3 Multimodal Sections

Each landing page section gets three simultaneous modalities:

**A. Background Video/Animation**

- Each section has an optional background video or CSS/Canvas animation
- Videos: muted, autoplay, loop, `object-fit: cover`, low opacity (0.1-0.2)
- Respects `prefers-reduced-motion` → static gradient fallback
- Lazy-loaded with `IntersectionObserver`

**Section backgrounds:**

| Section | Background |
|---------|-----------|
| Arrival (hero) | Galaxy3D (existing) + particle field |
| Platform | Subtle gradient mesh animation |
| Pricing | PricingExplainer travellers (existing) |
| How It Works | Waveform animation (audio-themed) |
| Applications | Device rotation showcase |
| Architecture | Network node graph animation |

**B. Audio Narration**

- Each section has optional narration text (separate from section copy — shorter, spoken-style)
- `SectionNarration` component: play/pause button per section + global narration controls
- Uses existing `speechVoice.ts` TTS with scored voice selection
- Narration auto-pauses when scrolling to a new section
- Global narration bar at bottom: play/pause, section skip, volume, progress

**C. Text Content**

- Existing text content remains unchanged
- Text is readable over background video via overlay gradient or glass effect
- No layout shift when background loads

### 4.4 Narration Architecture

**New domain type:** `packages/core/src/domain/narration.ts`

- `NarrationScript` type: `{ sectionId: string, text: string, durationEstimate: number }`
- Scripts defined per section, per language

**New component:** `apps/web/app/components/SectionNarration.tsx`

- Play/pause per section
- Highlights current sentence as narration plays
- Auto-scrolls to section when narration starts

**New component:** `apps/web/app/components/NarrationBar.tsx`

- Fixed bottom bar (like a media player)
- Shows: current section name, play/pause, prev/next section, volume, progress
- Dismissible
- Keyboard shortcuts: Space (play/pause), Left/Right (prev/next section)

### 4.5 Tests

- Unit: fullscreen utility (request, exit, toggle, unsupported browser)
- Unit: narration state machine (play, pause, section transition)
- Component: IntroGate fullscreen button, NarrationBar controls
- E2E: fullscreen enter/exit on each player, narration play through sections
- Edge: fullscreen denied by browser, TTS voice not available, reduced-motion

---

## 5. WS3 — VoiceOrb Enlarged + Advanced Effects

### 5.1 Size Increase

- Current: 120px diameter
- New: 240px diameter (2x), configurable via CSS custom property `--orb-size`
- Ring width scales proportionally
- Canvas resolution increases to match (devicePixelRatio-aware)

### 5.2 Particle System

**New module:** `apps/web/src/lib/orbParticles.ts`

- Canvas-based particle system (no WebGL — keeps it lightweight)
- 50-100 particles orbiting the core
- Particle behavior driven by audio amplitude:
  - Idle: slow orbit, low opacity
  - Listening: particles accelerate toward core, brightness increases
  - Speaking: particles burst outward, color shifts to `--orb-speaking`
- Particle trail effect via canvas `globalAlpha` fade

### 5.3 Ripple Effects

- Concentric ripple rings emanate from core on speech onset
- 3 ripples max, staggered 200ms apart
- Each ripple: expands from orb edge, fades over 800ms
- CSS `box-shadow` animation for performance (not canvas)

### 5.4 Depth Layers

```
Layer 0: Background glow (radial gradient, 1.5x orb size)
Layer 1: Particle canvas (full orb area)
Layer 2: Outer ring (CSS border + box-shadow)
Layer 3: Inner core (CSS gradient + breathing animation)
Layer 4: Frequency bars (canvas, 48 bars around inner edge)
Layer 5: Specular highlight (CSS, top-left offset)
```

Each layer animates independently for parallax depth.

### 5.5 State Transitions

- `idle → listening`: 300ms ease-out, particles accelerate, ring brightens
- `listening → speaking`: 200ms ease-in, color shift to pink, particles burst
- `speaking → idle`: 500ms ease-out, particles decelerate, color returns
- All transitions respect `prefers-reduced-motion` → instant state change, no animation

### 5.6 Responsive Behavior

- Desktop: 240px
- Tablet (≤900px): 200px
- Mobile (≤520px): 160px
- All sizes maintain particle count proportional to area

### 5.7 Tests

- Unit: particle system (spawn, update, audio reactivity)
- Unit: state transition timing
- Component: renders at correct size, responds to audio input
- Visual: screenshot comparison at each state (idle, listening, speaking)
- Edge: reduced-motion, canvas not supported, audio context blocked

---

## 6. WS4 — GSAP Motion Design (Awwwards Quality)

### 6.1 Dependencies

- Add `gsap` package (includes ScrollTrigger, ScrollSmoother optional)
- Lazy-loaded: `const gsap = await import('gsap')` per section
- Tree-shaken: only import used plugins

### 6.2 ScrollTrigger Animations

**Per-section entrance animations:**

```
Each section on scroll into view:
- Opacity: 0 → 1 (fade in)
- Y translate: 60px → 0 (rise up)
- Scale: 0.95 → 1 (subtle zoom)
- Duration: 0.8s, ease: "power3.out"
- Stagger children: 0.1s per child element
```

**Parallax backgrounds:**

- Background videos/animations move at 0.5x scroll speed
- Creates depth illusion between content and background

**Progress indicators:**

- Scroll progress bar in nav (existing `--nav-progress` CSS var)
- Section progress dots on side (optional, desktop only)

### 6.3 View Transitions

- Use View Transitions API where supported (Chrome 111+, Safari 18+)
- Fallback: crossfade animation for unsupported browsers
- Transitions between: landing ↔ app page, section ↔ section
- Morphing elements: brand mark, VoiceOrb persist across transitions

### 6.4 Micro-interactions

**Buttons:**

- Hover: scale 1.02, shadow deepen, 150ms spring
- Active/press: scale 0.98, 100ms
- Focus: ring animation (expanding border)

**Cards:**

- Hover: lift 4px, shadow expand, border glow
- Tilt effect on mouse position (subtle, ±2deg)

**Mode switcher:**

- Sliding indicator with spring physics
- Content crossfade between modes

### 6.5 SVG Morphing

- VoiceMark bars: morph between waveform patterns on state change
- Brand mark: subtle breathing animation via path morphing
- Icons: morph between states (play ↔ pause, expand ↔ collapse)

### 6.6 Scroll-Pinned Sections

- Arrival hero: pins while Galaxy3D completes one rotation
- How It Works: pins while ConversationDemo plays through
- Architecture: pins while diagram assembles

Pin duration: 50-100vh per section (configurable)

### 6.7 Reduced Motion Strategy

```typescript
gsap.matchMedia().add("(prefers-reduced-motion: reduce)", () => {
  // All animations become instant opacity fades
  // No parallax, no pin, no morph
  // Content still appears, just without motion
});
```

### 6.8 Performance Budget

- GSAP core: ~30KB gzipped (lazy-loaded)
- ScrollTrigger plugin: ~15KB gzipped
- Total motion budget: <50KB additional JS
- All animations run on compositor thread (transform, opacity only)
- No layout thrashing

### 6.9 Tests

- Unit: scroll trigger registration, animation timing
- Component: section entrance animation fires on intersection
- E2E: scroll through landing page, verify animations trigger
- Visual: screenshot at key scroll positions
- Edge: reduced-motion disables all GSAP, GSAP load failure → graceful CSS fallback

---

## 7. WS5 — Comprehensive Testing

### 7.1 Coverage Reporting

**Add to Vitest config:**

```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'html', 'lcov'],
  thresholds: {
    lines: 80,
    branches: 70,
    functions: 75,
    statements: 80
  }
}
```

**CI integration:** coverage report uploaded as artifact, thresholds enforced

### 7.2 Visual Regression Testing

**Playwright screenshots:**

- Baseline screenshots for each major page/section at desktop + mobile
- Diff threshold: 0.1% pixel difference
- Updated via `--update-snapshots` flag
- Stored in `tests/visual/baselines/`

**Key visual checkpoints:**

- Landing page: each section at full scroll
- Workspace: each mode (voice, motion, text)
- VoiceOrb: each state (idle, listening, speaking)
- SignInGate: email step, code step, passkey prompt
- Fullscreen: each video player in fullscreen mode

### 7.3 Performance Budgets

**Lighthouse CI:**

- Add `@lhci/cli` to dev dependencies
- Config: `lighthouserc.json` with assertions:
  - LCP < 2.5s
  - CLS < 0.1
  - TBT < 200ms
  - FCP < 1.8s
- Runs in CI on every PR against `https://ursly.io`

### 7.4 Edge Case Coverage Per Workstream

| WS | Edge Cases |
|----|-----------|
| WS1 | WebAuthn not supported, credential deleted, timeout, biometric failure, multiple passkeys |
| WS2 | Fullscreen denied, TTS voice missing, video load failure, narration interrupted by scroll |
| WS3 | Canvas unsupported, audio context blocked, reduced-motion, tab backgrounded |
| WS4 | GSAP load failure, scroll trigger on fast scroll, view transitions unsupported |

### 7.5 E2E Cross-Workstream Scenarios

1. **Full journey:** Land → passkey sign-in → voice command → fullscreen video → scroll through sections with narration
2. **Motion journey:** Land → OTP sign-in → switch to motion mode → gesture navigation → fullscreen camera
3. **Reduced motion:** Land with `prefers-reduced-motion` → all sections render without animation → narration still works
4. **Mobile:** Land on mobile → passkey via Face ID → fullscreen intro video → voice orb enlarged

---

## 8. WS6 — Integration & Polish

### 8.1 Design Token Updates

**New tokens in `globals.css`:**

```css
--orb-size: 240px;
--orb-size-tablet: 200px;
--orb-size-mobile: 160px;
--orb-particle-count: 80;
--section-bg-opacity: 0.15;
--narration-bar-height: 56px;
```

### 8.2 i18n

All new UI strings added to both EN source and FR dictionary:

- Passkey prompts: "Sign in with Face ID", "Save this device as passkey", etc.
- Narration controls: "Play narration", "Pause narration", section names
- Fullscreen: "Enter fullscreen", "Exit fullscreen"
- GSAP: no user-facing strings (animation only)

### 8.3 Accessibility

- Passkey buttons: `aria-label` with platform-specific text
- Narration: `aria-live="polite"` for current sentence, `aria-controls` for play/pause
- Fullscreen: `aria-pressed` on fullscreen button, focus trap in fullscreen mode
- VoiceOrb: `aria-live="polite"` for state changes ("Listening...", "Speaking...")
- All GSAP animations: `aria-hidden="true"` on decorative elements

### 8.4 Performance

- GSAP: dynamic import, loaded after hydration
- Background videos: `preload="none"`, loaded on section intersection
- Narration: TTS voices loaded on demand
- VoiceOrb particles: `requestAnimationFrame` with visibility check (pause when tab hidden)
- Fullscreen video: `preload="auto"` only when fullscreen entered

---

## 9. File Inventory (New Files)

### Domain / Core
- `packages/core/src/domain/webauthn.ts`
- `packages/core/src/domain/narration.ts`
- `packages/core/src/application/passkeys.ts`
- `packages/core/src/application/ports.ts` (modified: add WebAuthnPort)

### Adapters
- `packages/adapters/src/webauthn.ts`

### Web App
- `apps/web/src/lib/fullscreen.ts`
- `apps/web/src/lib/passkey.ts`
- `apps/web/src/lib/orbParticles.ts`
- `apps/web/app/components/PasskeySignIn.tsx`
- `apps/web/app/components/SectionNarration.tsx`
- `apps/web/app/components/NarrationBar.tsx`
- `apps/web/app/components/SectionBackground.tsx`

### Mobile App
- `apps/mobile/src/PasskeyAuth.tsx`

### API Routes
- `apps/web/app/api/auth/passkey/register-options/route.ts`
- `apps/web/app/api/auth/passkey/register/route.ts`
- `apps/web/app/api/auth/passkey/auth-options/route.ts`
- `apps/web/app/api/auth/passkey/auth/route.ts`
- `apps/web/app/api/auth/passkeys/route.ts`

### Tests (per workstream, ~30+ new test files)
- Coverage config updates
- Visual regression baselines
- Lighthouse CI config

---

## 10. Dependencies to Add

| Package | Purpose | Size (gzipped) |
|---------|---------|----------------|
| `gsap` | Scroll animations, morphing, micro-interactions | ~45KB |
| `@simplewebauthn/server` | WebAuthn server-side verification | ~25KB |
| `@simplewebauthn/browser` | WebAuthn client-side helpers | ~8KB |
| `@vitest/coverage-v8` | Code coverage reporting | dev only |
| `@lhci/cli` | Lighthouse CI performance budgets | dev only |
| `expo-local-authentication` | Mobile biometric prompt | mobile only |

---

## 11. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| WebAuthn not supported on all browsers | Some users can't sign in | Email OTP fallback always available |
| GSAP bundle size | Slower initial load | Lazy-loaded after hydration, <50KB budget |
| Background videos + narration + GSAP | Performance regression | Lighthouse CI enforces budgets, reduced-motion kills all motion |
| TTS voice quality varies by OS | Poor narration on some devices | Scored voice selection (existing), OpenAI TTS as premium option |
| Visual regression false positives | CI flakes | 0.1% threshold, manual review for borderline diffs |

---

## 12. Success Criteria

1. User can sign in with Face ID / Touch ID / Windows Hello in one tap
2. All video players support true fullscreen (browser Fullscreen API)
3. Every landing page section has simultaneous text + audio narration + background animation
4. VoiceOrb is 240px with particles, ripples, and depth layers
5. Scroll animations, parallax, and micro-interactions throughout the landing page
6. Code coverage ≥80% lines, ≥70% branches
7. Visual regression baselines for all major views
8. Lighthouse scores: LCP < 2.5s, CLS < 0.1
9. All animations respect `prefers-reduced-motion`
10. Zero regressions in existing 107 unit tests, 15 E2E specs, 23 BDD features
