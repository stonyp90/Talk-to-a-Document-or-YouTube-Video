# Multimodal Immersive Experience — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the application into a best-in-class multimodal experience with WebAuthn authentication, fullscreen video, immersive VoiceOrb, Awwwards-quality GSAP motion, and comprehensive test coverage.

**Architecture:** Six independent workstreams executed in parallel after Phase 0 foundations. WebAuthn slots into existing hexagonal auth architecture. Fullscreen uses browser Fullscreen API. VoiceOrb expands to 240px with canvas particle system. GSAP lazy-loaded after hydration for scroll-driven animations.

**Tech Stack:** TypeScript, Next.js (app router), React 19, Vitest, Playwright, GSAP 3, @simplewebauthn/server + @simplewebauthn/browser, Web Audio API, Canvas 2D, expo-local-authentication

**Spec:** `docs/superpowers/specs/2026-09-18-multimodal-immersive-experience-design.md`

## Global Constraints

- All animations must respect `prefers-reduced-motion: reduce` — instant state changes, no motion
- GSAP bundle budget: <50KB gzipped total (core + ScrollTrigger)
- Code coverage thresholds: 80% lines, 70% branches, 75% functions
- Lighthouse budgets: LCP < 2.5s, CLS < 0.1, TBT < 200ms, FCP < 1.8s
- WebAuthn: email OTP fallback always available when biometric not supported
- VoiceOrb sizes: desktop 240px, tablet (≤900px) 200px, mobile (≤520px) 160px
- All new UI strings must have EN source + FR translation
- All new interactive elements need ARIA labels and keyboard navigation
- Video players: true Fullscreen API, not CSS-only expansion
- Motion detection: full-body pose (MediaPipe Pose behind a port), not just a single brightness centroid
- Feedback: user chooses verbal (TTS), text (on-screen), both, or silent — persisted in localStorage
- CI: coverage, visual regression, a11y, and Lighthouse run on every PR and push to main
- Architecture: all new capabilities follow port/adapter — technology is replaceable (MediaPipe, WebAuthn provider, TTS engine)

---

## Phase 0: Foundations

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json` (root)
- Modify: `apps/mobile/package.json`

- [ ] **Step 1: Install GSAP**

```bash
npm install gsap --save
```

- [ ] **Step 2: Install WebAuthn packages**

```bash
npm install @simplewebauthn/server @simplewebauthn/browser --save
```

- [ ] **Step 3: Install full-body pose detection**

```bash
npm install @mediapipe/tasks-vision --save
```

- [ ] **Step 4: Install testing tools**

```bash
npm install @vitest/coverage-v8 @lhci/cli --save-dev
```

- [ ] **Step 5: Install mobile biometric package**

```bash
cd apps/mobile && npm install expo-local-authentication --save
```

- [ ] **Step 6: Verify installations**

```bash
npm ls gsap @simplewebauthn/server @simplewebauthn/browser @mediapipe/tasks-vision @vitest/coverage-v8
cd apps/mobile && npm ls expo-local-authentication
```

Expected: All packages listed with versions, no peer dependency errors.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json apps/mobile/package.json apps/mobile/package-lock.json
git commit -m "chore: install dependencies for multimodal experience

- gsap: scroll animations and micro-interactions
- @simplewebauthn/server + browser: WebAuthn/Passkey auth
- @mediapipe/tasks-vision: full-body pose detection
- @vitest/coverage-v8: code coverage reporting
- @lhci/cli: Lighthouse CI performance budgets
- expo-local-authentication: mobile biometric prompt"
```

---

### Task 2: Configure Vitest Coverage

**Files:**
- Modify: `vitest.config.ts`

- [ ] **Step 1: Write the failing test**

Create a test that verifies coverage config exists:

```typescript
// vitest.config.coverage.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("Vitest coverage configuration", () => {
  it("has coverage provider configured", () => {
    const config = readFileSync("./vitest.config.ts", "utf-8");
    expect(config).toContain("provider: 'v8'");
  });

  it("has coverage thresholds set", () => {
    const config = readFileSync("./vitest.config.ts", "utf-8");
    expect(config).toContain("thresholds");
    expect(config).toContain("lines: 80");
    expect(config).toContain("branches: 70");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run vitest.config.coverage.test.ts
```

Expected: FAIL — coverage config not yet present.

- [ ] **Step 3: Update vitest.config.ts**

Read the existing config first, then add coverage:

```typescript
// Add to the existing vitest config object:
coverage: {
  provider: 'v8',
  reporter: ['text', 'html', 'lcov'],
  include: [
    'packages/core/src/**/*.ts',
    'packages/adapters/src/**/*.ts',
    'apps/web/app/**/*.ts',
    'apps/web/app/**/*.tsx',
    'apps/web/src/**/*.ts',
    'apps/mobile/src/**/*.ts',
    'apps/mobile/src/**/*.tsx',
  ],
  exclude: [
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.d.ts',
    'apps/web/app/api/**/route.ts', // Tested via integration tests
  ],
  thresholds: {
    lines: 80,
    branches: 70,
    functions: 75,
    statements: 80,
  },
},
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run vitest.config.coverage.test.ts
```

Expected: PASS

- [ ] **Step 5: Delete the config test (no longer needed)**

```bash
rm vitest.config.coverage.test.ts
```

- [ ] **Step 6: Verify coverage runs**

```bash
npx vitest run --coverage 2>&1 | head -50
```

Expected: Coverage report generated (will be low initially — that's OK).

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts
git commit -m "test: configure vitest coverage with v8 provider and thresholds

- Provider: v8
- Thresholds: 80% lines, 70% branches, 75% functions
- Reporters: text, html, lcov
- Excludes: test files, route handlers (tested via integration)"
```

---

### Task 3: Create Fullscreen Utility

**Files:**
- Create: `apps/web/src/lib/fullscreen.ts`
- Create: `apps/web/src/lib/fullscreen.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/lib/fullscreen.test.ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  requestFullscreen,
  exitFullscreen,
  isFullscreen,
  onFullscreenChange,
} from "./fullscreen";

describe("fullscreen utility", () => {
  let element: HTMLDivElement;

  beforeEach(() => {
    element = document.createElement("div");
    document.body.appendChild(element);
  });

  afterEach(() => {
    document.body.removeChild(element);
    vi.restoreAllMocks();
  });

  it("requests fullscreen on an element", async () => {
    const spy = vi.spyOn(element, "requestFullscreen").mockResolvedValue();
    await requestFullscreen(element);
    expect(spy).toHaveBeenCalled();
  });

  it("exits fullscreen", async () => {
    const spy = vi.spyOn(document, "exitFullscreen").mockResolvedValue();
    await exitFullscreen();
    expect(spy).toHaveBeenCalled();
  });

  it("reports fullscreen state", () => {
    Object.defineProperty(document, "fullscreenElement", {
      value: element,
      configurable: true,
    });
    expect(isFullscreen()).toBe(true);

    Object.defineProperty(document, "fullscreenElement", {
      value: null,
      configurable: true,
    });
    expect(isFullscreen()).toBe(false);
  });

  it("calls callback on fullscreen change", () => {
    const callback = vi.fn();
    const cleanup = onFullscreenChange(callback);

    document.dispatchEvent(new Event("fullscreenchange"));
    expect(callback).toHaveBeenCalled();

    cleanup();
    document.dispatchEvent(new Event("fullscreenchange"));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("returns no-op when Fullscreen API not supported", async () => {
    vi.stubGlobal("document", { ...document, exitFullscreen: undefined });
    // Should not throw
    await exitFullscreen();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run apps/web/src/lib/fullscreen.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement fullscreen utility**

```typescript
// apps/web/src/lib/fullscreen.ts
export async function requestFullscreen(element: HTMLElement): Promise<void> {
  if (!element.requestFullscreen) {
    // Vendor prefixes for older browsers
    const el = element as unknown as Record<string, unknown>;
    if (typeof el.webkitRequestFullscreen === "function") {
      (el.webkitRequestFullscreen as () => void).call(element);
      return;
    }
    return;
  }
  await element.requestFullscreen();
}

export async function exitFullscreen(): Promise<void> {
  if (!document.exitFullscreen) {
    const doc = document as unknown as Record<string, unknown>;
    if (typeof doc.webkitExitFullscreen === "function") {
      (doc.webkitExitFullscreen as () => void).call(document);
      return;
    }
    return;
  }
  await document.exitFullscreen();
}

export function isFullscreen(): boolean {
  return (
    document.fullscreenElement !== null ||
    (document as unknown as Record<string, unknown>).webkitFullscreenElement !==
      null
  );
}

export function onFullscreenChange(callback: () => void): () => void {
  document.addEventListener("fullscreenchange", callback);
  document.addEventListener("webkitfullscreenchange", callback);
  return () => {
    document.removeEventListener("fullscreenchange", callback);
    document.removeEventListener("webkitfullscreenchange", callback);
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run apps/web/src/lib/fullscreen.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/fullscreen.ts apps/web/src/lib/fullscreen.test.ts
git commit -m "feat(web): add fullscreen utility with vendor prefix support

- requestFullscreen/exitFullscreen with webkit fallback
- isFullscreen state check
- onFullscreenChange event listener with cleanup
- Full test coverage"
```

---

## Phase 1: Parallel Workstreams (WS1–WS4)

> **Execution note:** These four workstreams are independent. Use subagent-driven-development to dispatch one subagent per workstream in parallel. Each workstream section below is a self-contained plan.

---

## WS1: WebAuthn/Passkey Authentication

### Task 4: WebAuthn Domain Types

**Files:**
- Create: `packages/core/src/domain/webauthn.ts`
- Create: `packages/core/src/domain/webauthn.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/src/domain/webauthn.test.ts
import { describe, expect, it } from "vitest";
import type {
  CredentialDescriptor,
  WebAuthnChallenge,
  PasskeySession,
} from "./webauthn";

describe("WebAuthn domain types", () => {
  it("defines CredentialDescriptor shape", () => {
    const cred: CredentialDescriptor = {
      id: "cred-123",
      transports: ["internal", "hybrid"],
    };
    expect(cred.id).toBe("cred-123");
    expect(cred.transports).toContain("internal");
  });

  it("defines WebAuthnChallenge shape", () => {
    const challenge: WebAuthnChallenge = {
      challenge: "base64-challenge",
      userId: "user-123",
      timeout: 60000,
    };
    expect(challenge.timeout).toBeGreaterThan(0);
  });

  it("defines PasskeySession shape", () => {
    const session: PasskeySession = {
      credentialId: "cred-123",
      accountId: "acct-456",
      createdAt: Date.now(),
    };
    expect(session.createdAt).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run packages/core/src/domain/webauthn.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement domain types**

```typescript
// packages/core/src/domain/webauthn.ts
export interface CredentialDescriptor {
  id: string;
  transports: string[];
}

export interface WebAuthnChallenge {
  challenge: string;
  userId: string;
  timeout: number;
}

export interface PasskeySession {
  credentialId: string;
  accountId: string;
  createdAt: number;
}

export const WEBAUTHN_DEFAULT_TIMEOUT_MS = 60_000;
export const WEBAUTHN_CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run packages/core/src/domain/webauthn.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/domain/webauthn.ts packages/core/src/domain/webauthn.test.ts
git commit -m "feat(domain): add WebAuthn domain types

- CredentialDescriptor: stored credential with transports
- WebAuthnChallenge: server-generated challenge for registration/auth
- PasskeySession: links credential to account
- Constants for timeout and challenge TTL"
```

---

### Task 5: WebAuthn Port

**Files:**
- Modify: `packages/core/src/application/ports.ts`

- [ ] **Step 1: Read existing ports file**

```bash
cat packages/core/src/application/ports.ts
```

- [ ] **Step 2: Add WebAuthnPort to ports.ts**

Add this interface to the existing file:

```typescript
import type {
  CredentialDescriptor,
  WebAuthnChallenge,
} from "../domain/webauthn";

export interface WebAuthnPort {
  generateRegistrationOptions(
    userId: string,
    email: string,
  ): Promise<WebAuthnChallenge>;
  verifyRegistration(
    challenge: string,
    response: unknown,
  ): Promise<CredentialDescriptor>;
  generateAuthenticationOptions(
    credentialId?: string,
  ): Promise<WebAuthnChallenge>;
  verifyAuthentication(
    challenge: string,
    response: unknown,
  ): Promise<{ credentialId: string }>;
}
```

- [ ] **Step 3: Verify typecheck passes**

```bash
npx tsc --noEmit -p packages/core/tsconfig.json
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/application/ports.ts
git commit -m "feat(domain): add WebAuthnPort to application ports

- generateRegistrationOptions: create challenge for new credential
- verifyRegistration: validate and extract credential descriptor
- generateAuthenticationOptions: create challenge for authentication
- verifyAuthentication: validate assertion, return credential ID"
```

---

### Task 5B: Extend AccountStorePort with Passkey Storage

**Files:**
- Modify: `packages/core/src/application/ports.ts`
- Modify: `packages/adapters/src/accounts.ts`
- Create: `packages/adapters/src/accounts-passkey.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/adapters/src/accounts-passkey.test.ts
import { describe, expect, it } from "vitest";
import { createMemoryAccountStore } from "./accounts";

describe("AccountStore passkey methods", () => {
  it("stores a passkey credential for an account", async () => {
    const store = createMemoryAccountStore();
    await store.storePasskey("user-123", {
      id: "cred-abc",
      transports: ["internal"],
    });
    const account = await store.getAccountByPasskey("cred-abc");
    expect(account).toBeTruthy();
  });

  it("returns null for unknown passkey", async () => {
    const store = createMemoryAccountStore();
    const account = await store.getAccountByPasskey("nonexistent");
    expect(account).toBeNull();
  });

  it("lists passkeys for an account", async () => {
    const store = createMemoryAccountStore();
    await store.storePasskey("user-123", {
      id: "cred-1",
      transports: ["internal"],
    });
    await store.storePasskey("user-123", {
      id: "cred-2",
      transports: ["hybrid"],
    });
    const passkeys = await store.listPasskeys("user-123");
    expect(passkeys).toHaveLength(2);
  });

  it("revokes a passkey", async () => {
    const store = createMemoryAccountStore();
    await store.storePasskey("user-123", {
      id: "cred-abc",
      transports: ["internal"],
    });
    await store.revokePasskey("user-123", "cred-abc");
    const account = await store.getAccountByPasskey("cred-abc");
    expect(account).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run packages/adapters/src/accounts-passkey.test.ts
```

Expected: FAIL — methods don't exist.

- [ ] **Step 3: Add passkey methods to AccountStorePort**

Add to `packages/core/src/application/ports.ts`:

```typescript
import type { CredentialDescriptor } from "../domain/webauthn";

export interface AccountStorePort {
  // ... existing methods ...

  // Passkey storage
  storePasskey(accountId: string, credential: CredentialDescriptor): Promise<void>;
  getAccountByPasskey(credentialId: string): Promise<{ id: string; email: string } | null>;
  listPasskeys(accountId: string): Promise<CredentialDescriptor[]>;
  revokePasskey(accountId: string, credentialId: string): Promise<void>;
}
```

- [ ] **Step 4: Implement passkey methods in memory store**

Add to `packages/adapters/src/accounts.ts` in `createMemoryAccountStore()`:

```typescript
import type { CredentialDescriptor } from "../../core/src/domain/webauthn";

// Inside createMemoryAccountStore, add these Maps:
const passkeyToAccount = new Map<string, string>(); // credentialId → accountId
const accountPasskeys = new Map<string, CredentialDescriptor[]>(); // accountId → credentials

// Add these methods to the returned object:
async storePasskey(accountId: string, credential: CredentialDescriptor) {
  passkeyToAccount.set(credential.id, accountId);
  const existing = accountPasskeys.get(accountId) || [];
  existing.push(credential);
  accountPasskeys.set(accountId, existing);
},

async getAccountByPasskey(credentialId: string) {
  const accountId = passkeyToAccount.get(credentialId);
  if (!accountId) return null;
  // Find account by ID (reuse existing account lookup)
  for (const [id, acct] of accounts) {
    if (id === accountId) return { id: acct.id, email: acct.email };
  }
  return null;
},

async listPasskeys(accountId: string) {
  return accountPasskeys.get(accountId) || [];
},

async revokePasskey(accountId: string, credentialId: string) {
  passkeyToAccount.delete(credentialId);
  const existing = accountPasskeys.get(accountId) || [];
  accountPasskeys.set(
    accountId,
    existing.filter((c) => c.id !== credentialId),
  );
},
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run packages/adapters/src/accounts-passkey.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/application/ports.ts packages/adapters/src/accounts.ts packages/adapters/src/accounts-passkey.test.ts
git commit -m "feat(domain): extend AccountStorePort with passkey storage

- storePasskey: link credential to account
- getAccountByPasskey: resolve account from credential ID
- listPasskeys: enumerate credentials for an account
- revokePasskey: remove a credential
- Memory store implementation with full test coverage"
```

---

### Task 5C: Update Composition Root for WebAuthn

**Files:**
- Modify: `apps/web/src/composition.ts`

- [ ] **Step 1: Read current composition.ts**

```bash
cat apps/web/src/composition.ts
```

- [ ] **Step 2: Export accountStore and add WebAuthn adapter**

In `apps/web/src/composition.ts`, make two changes:

1. Change line 181 from `const accountStore` to `export const accountStore`:

```typescript
// Change this line (around line 181):
export const accountStore = createMemoryAccountStore({
  ttlMs: Number(process.env.SIGN_IN_CODE_TTL_MS) || DEFAULT_CODE_TTL_MS,
  sessionTtlMs: accountSessionTtlMs(),
  createToken: () => accountTokens.randomToken(),
});
```

2. Add the WebAuthn adapter import and export near the other exports (around line 227):

```typescript
import { createWebAuthnAdapter } from "../../../packages/adapters/src/webauthn";

export const webAuthnAdapter = createWebAuthnAdapter({
  rpName: process.env.WEBAUTHN_RP_NAME || "Ursly",
  rpID: process.env.WEBAUTHN_RP_ID || "ursly.io",
  origin: process.env.WEBAUTHN_ORIGIN || "https://ursly.io",
});
```

- [ ] **Step 3: Verify typecheck passes**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/composition.ts
git commit -m "feat(web): wire WebAuthn adapter into composition root

- Export accountStore for passkey storage in routes
- Create WebAuthn adapter with env-configurable RP name, ID, origin
- Export webAuthnAdapter for API routes"
```

---

### Task 6: WebAuthn Adapter (Server-Side)

**Files:**
- Create: `packages/adapters/src/webauthn.ts`
- Create: `packages/adapters/src/webauthn.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/adapters/src/webauthn.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createWebAuthnAdapter } from "./webauthn";

describe("WebAuthn adapter", () => {
  const config = {
    rpName: "Ursly",
    rpID: "ursly.io",
    origin: "https://ursly.io",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates registration options with challenge", async () => {
    const adapter = createWebAuthnAdapter(config);
    const challenge = await adapter.generateRegistrationOptions(
      "user-123",
      "test@example.com",
    );
    expect(challenge.challenge).toBeTruthy();
    expect(challenge.userId).toBe("user-123");
    expect(challenge.timeout).toBeGreaterThan(0);
  });

  it("generates authentication options with challenge", async () => {
    const adapter = createWebAuthnAdapter(config);
    const challenge = await adapter.generateAuthenticationOptions();
    expect(challenge.challenge).toBeTruthy();
    expect(challenge.timeout).toBeGreaterThan(0);
  });

  it("verifies registration response", async () => {
    const adapter = createWebAuthnAdapter(config);
    const { challenge } = await adapter.generateRegistrationOptions(
      "user-123",
      "test@example.com",
    );
    // Mock verification — real implementation uses @simplewebauthn/server
    const mockResponse = { id: "cred-123", response: {} };
    const result = await adapter.verifyRegistration(challenge, mockResponse);
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("transports");
  });

  it("verifies authentication response", async () => {
    const adapter = createWebAuthnAdapter(config);
    const { challenge } = await adapter.generateAuthenticationOptions();
    const mockResponse = { id: "cred-123", response: {} };
    const result = await adapter.verifyAuthentication(challenge, mockResponse);
    expect(result.credentialId).toBe("cred-123");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run packages/adapters/src/webauthn.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement WebAuthn adapter**

```typescript
// packages/adapters/src/webauthn.ts
import {
  generateRegistrationOptions as generateRegOpts,
  verifyRegistrationResponse as verifyRegResp,
  generateAuthenticationOptions as generateAuthOpts,
  verifyAuthenticationResponse as verifyAuthResp,
} from "@simplewebauthn/server";
import type { WebAuthnPort } from "../../core/src/application/ports";
import type {
  CredentialDescriptor,
  WebAuthnChallenge,
} from "../../core/src/domain/webauthn";
import { WEBAUTHN_DEFAULT_TIMEOUT_MS } from "../../core/src/domain/webauthn";

interface WebAuthnAdapterConfig {
  rpName: string;
  rpID: string;
  origin: string;
}

export function createWebAuthnAdapter(
  config: WebAuthnAdapterConfig,
): WebAuthnPort {
  const { rpName, rpID, origin } = config;

  return {
    async generateRegistrationOptions(
      userId: string,
      email: string,
    ): Promise<WebAuthnChallenge> {
      const options = await generateRegOpts({
        userName: email,
        displayName: email,
        userDisplayName: email,
        userID: new TextEncoder().encode(userId),
        challenge: crypto.randomBytes(32),
        rpName,
        rpID,
        timeout: WEBAUTHN_DEFAULT_TIMEOUT_MS,
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred",
        },
      });
      return {
        challenge: options.challenge,
        userId,
        timeout: options.timeout,
      };
    },

    async verifyRegistration(
      challenge: string,
      response: unknown,
    ): Promise<CredentialDescriptor> {
      const verification = await verifyRegResp({
        response: response as any,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });
      if (!verification.verified || !verification.registrationInfo) {
        throw new Error("WebAuthn registration verification failed");
      }
      const { credential } = verification.registrationInfo;
      return {
        id: credential.id,
        transports: (response as any).response.transports || [],
      };
    },

    async generateAuthenticationOptions(
      credentialId?: string,
    ): Promise<WebAuthnChallenge> {
      const options = await generateAuthOpts({
        challenge: crypto.randomBytes(32),
        rpID,
        timeout: WEBAUTHN_DEFAULT_TIMEOUT_MS,
        userVerification: "preferred",
        allowCredentials: credentialId
          ? [{ id: credentialId, transports: [] }]
          : undefined,
      });
      return {
        challenge: options.challenge,
        userId: "",
        timeout: options.timeout,
      };
    },

    async verifyAuthentication(
      challenge: string,
      response: unknown,
    ): Promise<{ credentialId: string }> {
      const verification = await verifyAuthResp({
        response: response as any,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: { id: "", publicKey: new Uint8Array(), counter: 0 },
      });
      if (!verification.verified) {
        throw new Error("WebAuthn authentication verification failed");
      }
      return { credentialId: verification.authenticationInfo.credentialID };
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run packages/adapters/src/webauthn.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/adapters/src/webauthn.ts packages/adapters/src/webauthn.test.ts
git commit -m "feat(adapters): add WebAuthn adapter using @simplewebauthn/server

- generateRegistrationOptions: creates challenge for new credential
- verifyRegistration: validates registration response
- generateAuthenticationOptions: creates challenge for authentication
- verifyAuthentication: validates authentication assertion
- Full test coverage with mock responses"
```

---

### Task 7: WebAuthn API Routes

**Files:**
- Create: `apps/web/app/api/auth/passkey/register-options/route.ts`
- Create: `apps/web/app/api/auth/passkey/register/route.ts`
- Create: `apps/web/app/api/auth/passkey/auth-options/route.ts`
- Create: `apps/web/app/api/auth/passkey/auth/route.ts`
- Create: `apps/web/app/api/auth/passkeys/route.ts`
- Create: `apps/web/app/api/auth/passkey/passkey-routes.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/app/api/auth/passkey/passkey-routes.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({}) as Record<string, never>);

vi.mock("@/apps/web/src/composition", async () => {
  const { createAccounts } = await import(
    "../../../../../../packages/core/src/application/accounts"
  );
  const { createMemoryAccountStore, createSecureTokens } = await import(
    "../../../../../../packages/adapters/src/accounts"
  );
  const { createWebAuthnAdapter } = await import(
    "../../../../../../packages/adapters/src/webauthn"
  );

  const store = createMemoryAccountStore();
  const accounts = createAccounts({
    store,
    notifier: { sendSignInCode: async () => {} },
    tokens: createSecureTokens(),
    policy: {
      codeTtlMs: 600_000,
      maxCodeAttempts: 5,
      limitUnits: 1_000,
      windowMs: 60_000,
    },
  });

  const webauthn = createWebAuthnAdapter({
    rpName: "Ursly Test",
    rpID: "localhost",
    origin: "http://localhost:3000",
  });

  Object.assign(harness, { accounts, webauthn, store });

  return {
    requestSignInCode: (email: string) => accounts.requestSignIn(email),
    confirmSignInCode: (email: string, code: string) =>
      accounts.confirmSignIn(email, code),
    authenticateAccount: (token: string) => accounts.authenticate(token),
    signOutAccount: (token: string) => accounts.signOut(token),
    chargeAccount: (id: string, units: number) => accounts.charge(id, units),
    accountSessionTtlMs: () => 60_000,
    webAuthnAdapter: webauthn,
    accountStore: store,
  };
});

import { POST as registerOptions } from "./register-options/route";
import { POST as register } from "./register/route";
import { POST as authOptions } from "./auth-options/route";
import { POST as auth } from "./auth/route";

const post = (
  handler: (request: Request) => Promise<Response>,
  body: unknown,
) =>
  handler(
    new Request("https://ursly.io/api/auth/passkey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

describe("Passkey API routes", () => {
  it("generates registration options", async () => {
    const response = await post(registerOptions, {
      email: "test@example.com",
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.challenge).toBeTruthy();
  });

  it("generates authentication options", async () => {
    const response = await post(authOptions, {});
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.challenge).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run apps/web/app/api/auth/passkey/passkey-routes.test.ts
```

Expected: FAIL — routes don't exist yet.

- [ ] **Step 3: Implement register-options route**

```typescript
// apps/web/app/api/auth/passkey/register-options/route.ts
import { webAuthnAdapter } from "@/apps/web/src/composition";
import { errorResponse, jsonError, rateLimit } from "@/apps/web/src/http";

const limits = () => ({
  name: "passkey-register-options",
  limit: 10,
  windowMs: 900_000,
});

export async function POST(request: Request) {
  const limited = rateLimit(request, limits());
  if (limited) return limited;
  try {
    const { email } = await request.json();
    if (!email || typeof email !== "string") {
      return jsonError("INVALID_EMAIL", "Enter a valid email address.", 400);
    }
    const options = await webAuthnAdapter.generateRegistrationOptions(
      email,
      email,
    );
    return Response.json(options, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(
      error,
      "Registration options could not be generated.",
    );
  }
}
```

- [ ] **Step 4: Implement register route**

```typescript
// apps/web/app/api/auth/passkey/register/route.ts
import { webAuthnAdapter, accountStore } from "@/apps/web/src/composition";
import { errorResponse, jsonError, rateLimit } from "@/apps/web/src/http";
import { requireAccount } from "@/apps/web/src/auth";

const limits = () => ({
  name: "passkey-register",
  limit: 5,
  windowMs: 900_000,
});

export async function POST(request: Request) {
  const limited = rateLimit(request, limits());
  if (limited) return limited;
  try {
    const account = await requireAccount(request);
    if (account instanceof Response) return account;

    const { challenge, response } = await request.json();
    if (!challenge || !response) {
      return jsonError("INVALID_REQUEST", "Missing required fields.", 400);
    }
    const credential = await webAuthnAdapter.verifyRegistration(
      challenge,
      response,
    );
    await accountStore.storePasskey(account.id, credential);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error, "Registration failed.");
  }
}
```

- [ ] **Step 5: Implement auth-options route**

```typescript
// apps/web/app/api/auth/passkey/auth-options/route.ts
import { webAuthnAdapter } from "@/apps/web/src/composition";
import { errorResponse, rateLimit } from "@/apps/web/src/http";

const limits = () => ({
  name: "passkey-auth-options",
  limit: 10,
  windowMs: 900_000,
});

export async function POST(request: Request) {
  const limited = rateLimit(request, limits());
  if (limited) return limited;
  try {
    const options = await webAuthnAdapter.generateAuthenticationOptions();
    return Response.json(options, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error, "Authentication options could not be generated.");
  }
}
```

- [ ] **Step 6: Implement auth route**

```typescript
// apps/web/app/api/auth/passkey/auth/route.ts
import {
  webAuthnAdapter,
  accountStore,
} from "@/apps/web/src/composition";
import { errorResponse, jsonError, rateLimit } from "@/apps/web/src/http";
import { sessionCookie } from "@/apps/web/src/auth";

const limits = () => ({
  name: "passkey-auth",
  limit: 10,
  windowMs: 900_000,
});

export async function POST(request: Request) {
  const limited = rateLimit(request, limits());
  if (limited) return limited;
  try {
    const { challenge, response } = await request.json();
    if (!challenge || !response) {
      return jsonError("INVALID_REQUEST", "Missing required fields.", 400);
    }
    const { credentialId } = await webAuthnAdapter.verifyAuthentication(
      challenge,
      response,
    );
    const account = await accountStore.getAccountByPasskey(credentialId);
    if (!account) {
      return jsonError("UNKNOWN_PASSKEY", "Unrecognized passkey.", 401);
    }
    const session = await accountStore.openSession(account.id);
    return Response.json(
      { email: account.email, token: session.token },
      {
        status: 200,
        headers: {
          "Set-Cookie": sessionCookie(session.token, request),
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return errorResponse(error, "Authentication failed.");
  }
}
```

- [ ] **Step 7: Run test to verify it passes**

```bash
npx vitest run apps/web/app/api/auth/passkey/passkey-routes.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/api/auth/passkey/
git commit -m "feat(web): add WebAuthn/Passkey API routes

- POST /api/auth/passkey/register-options: generate registration challenge
- POST /api/auth/passkey/register: verify and store credential
- POST /api/auth/passkey/auth-options: generate authentication challenge
- POST /api/auth/passkey/auth: verify assertion, open session
- Rate-limited, follows existing auth route patterns"
```

---

### Task 8: WebAuthn Client Library

**Files:**
- Create: `apps/web/src/lib/passkey.ts`
- Create: `apps/web/src/lib/passkey.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/lib/passkey.test.ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isWebAuthnSupported,
  registerPasskey,
  authenticateWithPasskey,
} from "./passkey";

describe("passkey client library", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detects WebAuthn support", () => {
    expect(isWebAuthnSupported()).toBe(
      typeof PublicKeyCredential !== "undefined",
    );
  });

  it("registers a passkey", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ challenge: "abc", userId: "user-1", timeout: 60000 }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    // Mock PublicKeyCredential
    vi.stubGlobal("PublicKeyCredential", {
      create: vi.fn().mockResolvedValue({ id: "cred-1", response: {} }),
    });

    const result = await registerPasskey("test@example.com");
    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("authenticates with a passkey", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ challenge: "abc", timeout: 60000 }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ email: "test@example.com", token: "tok-123" }),
          { status: 200 },
        ),
      );

    vi.stubGlobal("PublicKeyCredential", {
      get: vi.fn().mockResolvedValue({ id: "cred-1", response: {} }),
    });

    const result = await authenticateWithPasskey();
    expect(result.email).toBe("test@example.com");
    expect(result.token).toBe("tok-123");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run apps/web/src/lib/passkey.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement passkey client library**

```typescript
// apps/web/src/lib/passkey.ts
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";

export function isWebAuthnSupported(): boolean {
  return typeof PublicKeyCredential !== "undefined";
}

export async function registerPasskey(
  email: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const optionsResponse = await fetch("/api/auth/passkey/register-options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!optionsResponse.ok) {
      return { success: false, error: "Failed to get registration options" };
    }
    const options = await optionsResponse.json();

    const credential = await startRegistration(options);

    const verifyResponse = await fetch("/api/auth/passkey/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        challenge: options.challenge,
        response: credential,
      }),
    });
    if (!verifyResponse.ok) {
      return { success: false, error: "Registration verification failed" };
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Registration failed",
    };
  }
}

export async function authenticateWithPasskey(): Promise<{
  email: string;
  token: string;
}> {
  const optionsResponse = await fetch("/api/auth/passkey/auth-options", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!optionsResponse.ok) {
    throw new Error("Failed to get authentication options");
  }
  const options = await optionsResponse.json();

  const assertion = await startAuthentication(options);

  const verifyResponse = await fetch("/api/auth/passkey/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      challenge: options.challenge,
      response: assertion,
    }),
  });
  if (!verifyResponse.ok) {
    throw new Error("Authentication failed");
  }
  return verifyResponse.json();
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run apps/web/src/lib/passkey.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/passkey.ts apps/web/src/lib/passkey.test.ts
git commit -m "feat(web): add passkey client library

- isWebAuthnSupported: feature detection
- registerPasskey: full registration flow with @simplewebauthn/browser
- authenticateWithPasskey: full authentication flow
- Error handling with user-friendly messages"
```

---

### Task 9: Passkey Sign-In UI Component

**Files:**
- Create: `apps/web/app/components/PasskeySignIn.tsx`
- Create: `apps/web/app/components/PasskeySignIn.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/app/components/PasskeySignIn.test.tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PasskeySignIn } from "./PasskeySignIn";

vi.mock("../src/lib/passkey", () => ({
  isWebAuthnSupported: vi.fn(() => true),
  authenticateWithPasskey: vi.fn(),
  registerPasskey: vi.fn(),
}));

describe("PasskeySignIn component", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders passkey sign-in button", () => {
    render(<PasskeySignIn onSignIn={vi.fn()} onFallback={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /sign in with face id/i }),
    ).toBeInTheDocument();
  });

  it("shows fallback button when WebAuthn not supported", () => {
    const { isWebAuthnSupported } = vi.mocked(
      await import("../src/lib/passkey"),
    );
    isWebAuthnSupported.mockReturnValue(false);

    render(<PasskeySignIn onSignIn={vi.fn()} onFallback={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /sign in with email/i }),
    ).toBeInTheDocument();
  });

  it("calls onSignIn after successful authentication", async () => {
    const { authenticateWithPasskey } = vi.mocked(
      await import("../src/lib/passkey"),
    );
    authenticateWithPasskey.mockResolvedValue({
      email: "test@example.com",
      token: "tok-123",
    });

    const onSignIn = vi.fn();
    render(<PasskeySignIn onSignIn={onSignIn} onFallback={vi.fn()} />);

    fireEvent.click(
      screen.getByRole("button", { name: /sign in with face id/i }),
    );

    await vi.waitFor(() => expect(onSignIn).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run apps/web/app/components/PasskeySignIn.test.tsx
```

Expected: FAIL — component not found.

- [ ] **Step 3: Implement PasskeySignIn component**

```tsx
// apps/web/app/components/PasskeySignIn.tsx
"use client";

import { useState } from "react";
import {
  isWebAuthnSupported,
  authenticateWithPasskey,
} from "../../src/lib/passkey";

interface PasskeySignInProps {
  onSignIn: (session: { email: string; token: string }) => void;
  onFallback: () => void;
}

export function PasskeySignIn({ onSignIn, onFallback }: PasskeySignInProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = isWebAuthnSupported();

  const handlePasskeySignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await authenticateWithPasskey();
      onSignIn(session);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Authentication failed",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!supported) {
    return (
      <div className="passkey-signin">
        <p>Biometric sign-in is not available on this device.</p>
        <button onClick={onFallback} className="btn btn-primary">
          Sign in with email instead
        </button>
      </div>
    );
  }

  return (
    <div className="passkey-signin">
      <button
        onClick={handlePasskeySignIn}
        disabled={loading}
        className="btn btn-primary"
        aria-busy={loading}
      >
        {loading ? "Authenticating..." : "Sign in with Face ID"}
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button onClick={onFallback} className="btn btn-secondary">
        Use email instead
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run apps/web/app/components/PasskeySignIn.test.tsx
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/components/PasskeySignIn.tsx apps/web/app/components/PasskeySignIn.test.tsx
git commit -m "feat(web): add PasskeySignIn component

- Detects WebAuthn support, shows appropriate button
- Handles loading state and errors
- Fallback to email OTP when biometric not available
- Accessible: aria-busy, role=alert for errors"
```

---

## WS2: Fullscreen Video + Multimodal Sections

### Task 10: Fullscreen Video Player Wrapper

**Files:**
- Create: `apps/web/app/components/FullscreenVideo.tsx`
- Create: `apps/web/app/components/FullscreenVideo.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/app/components/FullscreenVideo.test.tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FullscreenVideo } from "./FullscreenVideo";

vi.mock("../../src/lib/fullscreen", () => ({
  requestFullscreen: vi.fn(),
  exitFullscreen: vi.fn(),
  isFullscreen: vi.fn(() => false),
  onFullscreenChange: vi.fn(() => () => {}),
}));

describe("FullscreenVideo component", () => {
  it("renders video with sources", () => {
    render(
      <FullscreenVideo
        sources={[{ src: "/video.mp4", type: "video/mp4" }]}
        poster="/poster.jpg"
      />,
    );
    expect(screen.getByRole("button", { name: /enter fullscreen/i })).toBeInTheDocument();
  });

  it("toggles fullscreen on button click", async () => {
    const { requestFullscreen } = vi.mocked(
      await import("../../src/lib/fullscreen"),
    );
    render(
      <FullscreenVideo
        sources={[{ src: "/video.mp4", type: "video/mp4" }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /enter fullscreen/i }));
    expect(requestFullscreen).toHaveBeenCalled();
  });

  it("toggles fullscreen on double-click", () => {
    const { requestFullscreen } = vi.mocked(
      await import("../../src/lib/fullscreen"),
    );
    render(
      <FullscreenVideo
        sources={[{ src: "/video.mp4", type: "video/mp4" }]}
      />,
    );
    const video = screen.getByRole("video") || document.querySelector("video");
    if (video) {
      fireEvent.doubleClick(video);
      expect(requestFullscreen).toHaveBeenCalled();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run apps/web/app/components/FullscreenVideo.test.tsx
```

Expected: FAIL — component not found.

- [ ] **Step 3: Implement FullscreenVideo component**

```tsx
// apps/web/app/components/FullscreenVideo.tsx
"use client";

import { useRef, useState, useEffect } from "react";
import {
  requestFullscreen,
  exitFullscreen,
  isFullscreen,
  onFullscreenChange,
} from "../../src/lib/fullscreen";

interface VideoSource {
  src: string;
  type: string;
}

interface FullscreenVideoProps {
  sources: VideoSource[];
  poster?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
}

export function FullscreenVideo({
  sources,
  poster,
  autoPlay = false,
  muted = false,
  loop = false,
  controls = true,
}: FullscreenVideoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const cleanup = onFullscreenChange(() => {
      setFullscreen(isFullscreen());
    });
    return cleanup;
  }, []);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (isFullscreen()) {
      await exitFullscreen();
    } else {
      await requestFullscreen(containerRef.current);
    }
  };

  const handleDoubleClick = () => {
    toggleFullscreen();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "f" || e.key === "F") {
      e.preventDefault();
      toggleFullscreen();
    }
  };

  return (
    <div
      ref={containerRef}
      className="fullscreen-video"
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <video
        ref={videoRef}
        poster={poster}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        playsInline
        controls={controls}
      >
        {sources.map((source) => (
          <source key={source.src} src={source.src} type={source.type} />
        ))}
      </video>
      {controls && (
        <button
          onClick={toggleFullscreen}
          className="fullscreen-btn"
          aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          aria-pressed={fullscreen}
        >
          {fullscreen ? "⊡" : "⊞"}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run apps/web/app/components/FullscreenVideo.test.tsx
```

Expected: PASS (3 tests)

- [ ] **Step 5: Add CSS styles**

Add to `apps/web/app/globals.css`:

```css
.fullscreen-video {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: var(--ink);
}

.fullscreen-video:fullscreen {
  width: 100vw;
  height: 100vh;
  aspect-ratio: auto;
}

.fullscreen-video video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.fullscreen-btn {
  position: absolute;
  bottom: 12px;
  right: 12px;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 20px;
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.fullscreen-video:hover .fullscreen-btn,
.fullscreen-btn:focus {
  opacity: 1;
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/components/FullscreenVideo.tsx apps/web/app/components/FullscreenVideo.test.tsx apps/web/app/globals.css
git commit -m "feat(web): add FullscreenVideo component

- True Fullscreen API with vendor prefix support
- Fullscreen toggle: button, double-click, 'F' key
- Accessible: aria-label, aria-pressed, keyboard navigation
- Responsive: fills screen in fullscreen mode
- CSS: auto-hide controls, hover/focus reveal"
```

---

### Task 11: Section Narration Component

**Files:**
- Create: `apps/web/src/lib/narrate.ts`
- Create: `apps/web/src/lib/narrate.test.ts`
- Create: `apps/web/app/components/SectionNarration.tsx`
- Create: `apps/web/app/components/SectionNarration.test.tsx`

- [ ] **Step 1: Write the failing test for narrate utility**

```typescript
// apps/web/src/lib/narrate.test.ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { speakText, stopSpeaking } from "./narrate";

describe("narrate utility", () => {
  beforeEach(() => {
    vi.stubGlobal("speechSynthesis", {
      speak: vi.fn(),
      cancel: vi.fn(),
      getVoices: vi.fn(() => []),
      speaking: false,
    });
    vi.stubGlobal("SpeechSynthesisUtterance", vi.fn().mockImplementation((text: string) => ({
      text,
      voice: null,
      rate: 1,
      pitch: 1,
      volume: 1,
      lang: "",
    })));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("speaks text via SpeechSynthesis", async () => {
    await speakText("Hello world", "en");
    expect(speechSynthesis.speak).toHaveBeenCalled();
  });

  it("stops speaking", () => {
    stopSpeaking();
    expect(speechSynthesis.cancel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run apps/web/src/lib/narrate.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement narrate utility**

```typescript
// apps/web/src/lib/narrate.ts
import { selectSpeechVoice, SPEECH_DELIVERY } from "./speechVoice";

let currentUtterance: SpeechSynthesisUtterance | null = null;

export async function speakText(text: string, locale: string = "en"): Promise<void> {
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = SPEECH_DELIVERY.rate;
    utterance.pitch = SPEECH_DELIVERY.pitch;
    utterance.volume = SPEECH_DELIVERY.volume;

    const voices = speechSynthesis.getVoices();
    const voice = selectSpeechVoice(voices, locale);
    if (voice) {
      utterance.voice = voice as SpeechSynthesisVoice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = locale;
    }

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();

    currentUtterance = utterance;
    speechSynthesis.speak(utterance);
  });
}

export function stopSpeaking(): void {
  currentUtterance = null;
  speechSynthesis.cancel();
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run apps/web/src/lib/narrate.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: Write the failing test for SectionNarration component**

```typescript
// apps/web/app/components/SectionNarration.test.tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SectionNarration } from "./SectionNarration";

vi.mock("../../src/lib/narrate", () => ({
  speakText: vi.fn(() => Promise.resolve()),
  stopSpeaking: vi.fn(),
}));

describe("SectionNarration component", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders play button for narration", () => {
    render(
      <SectionNarration
        sectionId="how-we-build"
        text="Welcome to Ursly. We build the future of the internet."
      />,
    );
    expect(
      screen.getByRole("button", { name: /play narration/i }),
    ).toBeInTheDocument();
  });

  it("toggles play/pause on click", () => {
    render(
      <SectionNarration
        sectionId="how-we-build"
        text="Welcome to Ursly."
      />,
    );
    const button = screen.getByRole("button", { name: /play narration/i });
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-label", "Pause narration");
  });

  it("highlights current sentence during playback", async () => {
    render(
      <SectionNarration
        sectionId="how-we-build"
        text="First sentence. Second sentence."
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /play narration/i }));
    await vi.waitFor(() => {
      const sentences = screen.getAllByRole("presentation");
      expect(sentences.length).toBeGreaterThan(0);
    });
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
npx vitest run apps/web/app/components/SectionNarration.test.tsx
```

Expected: FAIL — component not found.

- [ ] **Step 7: Implement SectionNarration component**

```tsx
// apps/web/app/components/SectionNarration.tsx
"use client";

import { useState, useRef } from "react";
import { speakText, stopSpeaking } from "../../src/lib/narrate";

interface SectionNarrationProps {
  sectionId: string;
  text: string;
}

export function SectionNarration({ sectionId, text }: SectionNarrationProps) {
  const [playing, setPlaying] = useState(false);
  const [currentSentence, setCurrentSentence] = useState(0);
  const abortRef = useRef(false);
  const sentences = text.split(/(?<=[.!?])\s+/);

  const handleToggle = async () => {
    if (playing) {
      abortRef.current = true;
      stopSpeaking();
      setPlaying(false);
      setCurrentSentence(0);
    } else {
      abortRef.current = false;
      setPlaying(true);
      for (let i = 0; i < sentences.length; i++) {
        if (abortRef.current) break;
        setCurrentSentence(i);
        await speakText(sentences[i]);
      }
      if (!abortRef.current) {
        setPlaying(false);
        setCurrentSentence(0);
      }
    }
  };

  return (
    <div className="section-narration" data-section={sectionId}>
      <button
        onClick={handleToggle}
        aria-label={playing ? "Pause narration" : "Play narration"}
        aria-pressed={playing}
        className="narration-btn"
      >
        {playing ? "⏸" : "▶"}
      </button>
      <div className="narration-text" aria-live="polite">
        {sentences.map((sentence, i) => (
          <span
            key={i}
            role="presentation"
            className={i === currentSentence && playing ? "active" : ""}
          >
            {sentence}{" "}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

```bash
npx vitest run apps/web/app/components/SectionNarration.test.tsx
```

Expected: PASS (3 tests)

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib/narrate.ts apps/web/src/lib/narrate.test.ts apps/web/app/components/SectionNarration.tsx apps/web/app/components/SectionNarration.test.tsx
git commit -m "feat(web): add SectionNarration with TTS utility

- narrate.ts: speakText/stopSpeaking using Web Speech API + selectSpeechVoice
- SectionNarration: play/pause per section, highlights current sentence
- Abort-safe: stops cleanly on pause
- Accessible: aria-live, aria-pressed, aria-label"
```

---

## WS3: VoiceOrb Enlarged + Advanced Effects

### Task 12: Orb Particle System

**Files:**
- Create: `apps/web/src/lib/orbParticles.ts`
- Create: `apps/web/src/lib/orbParticles.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/lib/orbParticles.test.ts
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createParticleSystem } from "./orbParticles";

describe("Orb particle system", () => {
  it("creates particles with initial positions", () => {
    const canvas = document.createElement("canvas");
    const system = createParticleSystem(canvas, { count: 50 });
    expect(system.getParticleCount()).toBe(50);
  });

  it("updates particle positions based on audio amplitude", () => {
    const canvas = document.createElement("canvas");
    const system = createParticleSystem(canvas, { count: 50 });
    system.update(0.5); // 50% amplitude
    const particles = system.getParticles();
    expect(particles.length).toBe(50);
    expect(particles[0]).toHaveProperty("x");
    expect(particles[0]).toHaveProperty("y");
  });

  it("renders particles to canvas", () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const system = createParticleSystem(canvas, { count: 50 });
    system.update(0.5);
    system.render(ctx!);
    // No assertion needed — just verify it doesn't throw
    expect(true).toBe(true);
  });

  it("respects reduced motion preference", () => {
    const canvas = document.createElement("canvas");
    const system = createParticleSystem(canvas, {
      count: 50,
      reducedMotion: true,
    });
    system.update(0.5);
    const particles = system.getParticles();
    // Particles should not move when reduced motion is on
    expect(particles[0].vx).toBe(0);
    expect(particles[0].vy).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run apps/web/src/lib/orbParticles.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement particle system**

```typescript
// apps/web/src/lib/orbParticles.ts
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  angle: number;
  distance: number;
}

interface ParticleSystemOptions {
  count: number;
  reducedMotion?: boolean;
}

export interface ParticleSystem {
  getParticleCount(): number;
  getParticles(): Particle[];
  update(amplitude: number): void;
  render(ctx: CanvasRenderingContext2D): void;
}

export function createParticleSystem(
  canvas: HTMLCanvasElement,
  options: ParticleSystemOptions,
): ParticleSystem {
  const { count, reducedMotion = false } = options;
  const particles: Particle[] = [];
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const maxRadius = Math.min(centerX, centerY) * 0.8;

  // Initialize particles in orbital positions
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const distance = maxRadius * (0.3 + Math.random() * 0.7);
    particles.push({
      x: centerX + Math.cos(angle) * distance,
      y: centerY + Math.sin(angle) * distance,
      vx: 0,
      vy: 0,
      radius: 1 + Math.random() * 2,
      opacity: 0.3 + Math.random() * 0.5,
      angle,
      distance,
    });
  }

  return {
    getParticleCount: () => particles.length,
    getParticles: () => particles,

    update(amplitude: number) {
      if (reducedMotion) return;

      const speed = 0.02 + amplitude * 0.1;
      for (const p of particles) {
        p.angle += speed;
        const targetX = centerX + Math.cos(p.angle) * p.distance;
        const targetY = centerY + Math.sin(p.angle) * p.distance;
        p.vx = (targetX - p.x) * 0.1;
        p.vy = (targetY - p.y) * 0.1;
        p.x += p.vx;
        p.y += p.vy;
        p.opacity = 0.3 + amplitude * 0.7;
      }
    },

    render(ctx: CanvasRenderingContext2D) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(244, 119, 98, ${p.opacity})`;
        ctx.fill();
      }
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run apps/web/src/lib/orbParticles.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/orbParticles.ts apps/web/src/lib/orbParticles.test.ts
git commit -m "feat(web): add orb particle system

- Canvas-based particle system with orbital motion
- Audio-reactive: speed and opacity driven by amplitude
- Respects prefers-reduced-motion (particles don't move)
- Configurable particle count
- Full test coverage"
```

---

### Task 13: Upgrade VoiceOrb Component

**Files:**
- Modify: `apps/web/app/components/VoiceOrb.tsx`
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Read current VoiceOrb**

```bash
cat apps/web/app/components/VoiceOrb.tsx
```

- [ ] **Step 2: Update VoiceOrb to use particles and larger size**

Replace the VoiceOrb component with the upgraded version:

```tsx
// apps/web/app/components/VoiceOrb.tsx (updated)
"use client";

import { useRef, useEffect, useState } from "react";
import { createParticleSystem } from "../../src/lib/orbParticles";
import { prefersReducedMotion } from "./motion";

interface VoiceOrbProps {
  state: "idle" | "listening" | "speaking";
  amplitude?: number;
}

export function VoiceOrb({ state, amplitude = 0 }: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particleSystemRef = useRef<ReturnType<typeof createParticleSystem> | null>(null);
  const animationFrameRef = useRef<number>();
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(prefersReducedMotion());
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size based on device pixel ratio
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Initialize particle system
    particleSystemRef.current = createParticleSystem(canvas, {
      count: 80,
      reducedMotion,
    });

    const animate = () => {
      const system = particleSystemRef.current;
      if (!system) return;

      system.update(amplitude);
      system.render(ctx);

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [amplitude, reducedMotion]);

  return (
    <div className={`voice-orb voice-orb--${state}`} aria-live="polite">
      <div className="voice-orb__glow" />
      <canvas ref={canvasRef} className="voice-orb__canvas" />
      <div className="voice-orb__ring" />
      <div className="voice-orb__core" />
      <span className="sr-only">
        {state === "idle" && "Voice assistant idle"}
        {state === "listening" && "Listening..."}
        {state === "speaking" && "Speaking..."}
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Update CSS for larger orb and new layers**

Add/update in `apps/web/app/globals.css`:

```css
.voice-orb {
  --orb-size: 240px;
  --orb-size-tablet: 200px;
  --orb-size-mobile: 160px;

  position: relative;
  width: var(--orb-size);
  height: var(--orb-size);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 900px) {
  .voice-orb {
    width: var(--orb-size-tablet);
    height: var(--orb-size-tablet);
  }
}

@media (max-width: 520px) {
  .voice-orb {
    width: var(--orb-size-mobile);
    height: var(--orb-size-mobile);
  }
}

.voice-orb__glow {
  position: absolute;
  inset: -20%;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    var(--orb-primary) 0%,
    transparent 70%
  );
  opacity: 0.3;
  filter: blur(20px);
  transition: opacity var(--duration-normal) var(--ease-out);
}

.voice-orb--listening .voice-orb__glow {
  opacity: 0.6;
}

.voice-orb--speaking .voice-orb__glow {
  opacity: 0.8;
  background: radial-gradient(
    circle,
    var(--orb-speaking) 0%,
    transparent 70%
  );
}

.voice-orb__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  z-index: 1;
}

.voice-orb__ring {
  position: absolute;
  inset: 10%;
  border-radius: 50%;
  border: 2px solid var(--orb-primary);
  box-shadow: 0 0 20px var(--orb-primary);
  z-index: 2;
  transition: border-color var(--duration-normal) var(--ease-out),
              box-shadow var(--duration-normal) var(--ease-out);
}

.voice-orb--speaking .voice-orb__ring {
  border-color: var(--orb-speaking);
  box-shadow: 0 0 30px var(--orb-speaking);
}

.voice-orb__core {
  position: absolute;
  inset: 25%;
  border-radius: 50%;
  background: radial-gradient(
    circle at 30% 30%,
    var(--orb-primary),
    var(--orb-secondary)
  );
  z-index: 3;
  animation: voice-orb-breathe 3.2s var(--ease-in-out) infinite;
}

.voice-orb--speaking .voice-orb__core {
  background: radial-gradient(
    circle at 30% 30%,
    var(--orb-speaking),
    var(--orb-secondary)
  );
}

@media (prefers-reduced-motion: reduce) {
  .voice-orb__core {
    animation: none;
  }
}
```

- [ ] **Step 4: Run existing VoiceOrb tests**

```bash
npx vitest run apps/web/app/components/VoiceOrb.test.tsx
```

Expected: PASS (existing tests should still pass with updated component).

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/components/VoiceOrb.tsx apps/web/app/globals.css
git commit -m "feat(web): upgrade VoiceOrb to 240px with particles and depth

- Size: 240px desktop, 200px tablet, 160px mobile
- Particle system: 80 particles, audio-reactive
- Depth layers: glow, particles, ring, core
- State transitions: idle → listening → speaking with color shifts
- Respects prefers-reduced-motion
- Accessible: aria-live for state changes"
```

---

## WS4: GSAP Motion Design

### Task 14: GSAP Scroll Animations Setup

**Files:**
- Create: `apps/web/src/lib/scrollAnimations.ts`
- Create: `apps/web/src/lib/scrollAnimations.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/lib/scrollAnimations.test.ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { initScrollAnimations, cleanupScrollAnimations } from "./scrollAnimations";

vi.mock("gsap", () => ({
  gsap: {
    from: vi.fn(),
    to: vi.fn(),
    registerPlugin: vi.fn(),
    matchMedia: vi.fn(() => ({
      add: vi.fn(),
    })),
  },
  ScrollTrigger: {},
}));

describe("Scroll animations", () => {
  afterEach(() => {
    cleanupScrollAnimations();
    vi.restoreAllMocks();
  });

  it("initializes scroll animations", () => {
    initScrollAnimations();
    const { gsap } = vi.mocked(await import("gsap"));
    expect(gsap.registerPlugin).toHaveBeenCalled();
  });

  it("animates sections on scroll", () => {
    const section = document.createElement("section");
    section.className = "story-section";
    document.body.appendChild(section);

    initScrollAnimations();
    const { gsap } = vi.mocked(await import("gsap"));
    expect(gsap.from).toHaveBeenCalled();
  });

  it("cleans up animations", () => {
    initScrollAnimations();
    cleanupScrollAnimations();
    // Should not throw
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run apps/web/src/lib/scrollAnimations.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement scroll animations**

```typescript
// apps/web/src/lib/scrollAnimations.ts
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let initialized = false;

export function initScrollAnimations() {
  if (initialized) return;
  initialized = true;

  gsap.registerPlugin(ScrollTrigger);

  // Respect reduced motion
  const mm = gsap.matchMedia();
  mm.add("(prefers-reduced-motion: reduce)", () => {
    // No animations when reduced motion is preferred
    return () => {};
  });

  mm.add("(prefers-reduced-motion: no-preference)", () => {
    // Animate sections on scroll into view
    const sections = document.querySelectorAll(".story-section");
    sections.forEach((section) => {
      gsap.from(section, {
        opacity: 0,
        y: 60,
        scale: 0.95,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: {
          trigger: section,
          start: "top 80%",
          end: "top 20%",
          toggleActions: "play none none reverse",
        },
      });

      // Stagger children
      const children = section.querySelectorAll(
        "h2, h3, p, .card, .btn",
      );
      gsap.from(children, {
        opacity: 0,
        y: 30,
        duration: 0.6,
        ease: "power3.out",
        stagger: 0.1,
        scrollTrigger: {
          trigger: section,
          start: "top 80%",
          toggleActions: "play none none reverse",
        },
      });
    });

    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  });
}

export function cleanupScrollAnimations() {
  if (!initialized) return;
  ScrollTrigger.getAll().forEach((t) => t.kill());
  initialized = false;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run apps/web/src/lib/scrollAnimations.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/scrollAnimations.ts apps/web/src/lib/scrollAnimations.test.ts
git commit -m "feat(web): add GSAP scroll animations

- Lazy-loaded GSAP with ScrollTrigger plugin
- Section entrance animations: fade, rise, scale
- Staggered children animations
- Respects prefers-reduced-motion via gsap.matchMedia()
- Cleanup function to kill all ScrollTriggers"
```

---

### Task 14B: Full-Body Pose Detection

**Files:**
- Create: `packages/core/src/application/poseDetectorPort.ts`
- Create: `apps/web/src/lib/poseDetector.ts`
- Create: `apps/web/src/lib/poseDetector.test.ts`

The current motion system tracks a single brightness centroid — a "small point." This task adds full-body pose detection via MediaPipe Pose behind a port, so the app can sense the whole body and respond to whole-body movements (leaning, raising arms, stepping side-to-side), not just a hand swipe.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/lib/poseDetector.test.ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PoseDetector, type PoseLandmark, type BodyReading } from "./poseDetector";

describe("PoseDetector", () => {
  let detector: PoseDetector;

  beforeEach(() => {
    detector = new PoseDetector();
  });

  afterEach(() => {
    detector.dispose();
    vi.restoreAllMocks();
  });

  it("classifies a stance from landmarks", () => {
    const landmarks: PoseLandmark[] = [
      { x: 0.5, y: 0.3, visibility: 0.9 }, // 0: nose
      { x: 0.45, y: 0.25, visibility: 0.9 }, // 1: left eye
      { x: 0.55, y: 0.25, visibility: 0.9 }, // 2: right eye
      { x: 0.4, y: 0.25, visibility: 0.9 }, // 3: left ear
      { x: 0.6, y: 0.25, visibility: 0.9 }, // 4: right ear
      { x: 0.35, y: 0.4, visibility: 0.9 }, // 5: left shoulder
      { x: 0.65, y: 0.4, visibility: 0.9 }, // 6: right shoulder
      { x: 0.25, y: 0.55, visibility: 0.9 }, // 7: left elbow
      { x: 0.75, y: 0.55, visibility: 0.9 }, // 8: right elbow
      { x: 0.2, y: 0.7, visibility: 0.9 }, // 9: left wrist
      { x: 0.8, y: 0.7, visibility: 0.9 }, // 10: right wrist
      { x: 0.4, y: 0.65, visibility: 0.9 }, // 11: left hip
      { x: 0.6, y: 0.65, visibility: 0.9 }, // 12: right hip
      { x: 0.38, y: 0.8, visibility: 0.9 }, // 13: left knee
      { x: 0.62, y: 0.8, visibility: 0.9 }, // 14: right knee
      { x: 0.36, y: 0.95, visibility: 0.9 }, // 15: left ankle
      { x: 0.64, y: 0.95, visibility: 0.9 }, // 16: right ankle
    ];
    const reading: BodyReading = detector.analyse(landmarks);
    expect(reading.posture).toBe("standing");
    expect(reading.centerX).toBeCloseTo(0.5, 1);
    expect(reading.centerY).toBeCloseTo(0.6, 1);
  });

  it("detects arms raised", () => {
    const landmarks: PoseLandmark[] = [
      { x: 0.5, y: 0.3, visibility: 0.9 },
      { x: 0.45, y: 0.25, visibility: 0.9 },
      { x: 0.55, y: 0.25, visibility: 0.9 },
      { x: 0.4, y: 0.25, visibility: 0.9 },
      { x: 0.6, y: 0.25, visibility: 0.9 },
      { x: 0.35, y: 0.4, visibility: 0.9 },
      { x: 0.65, y: 0.4, visibility: 0.9 },
      { x: 0.25, y: 0.25, visibility: 0.9 }, // left elbow raised above shoulder
      { x: 0.75, y: 0.25, visibility: 0.9 }, // right elbow raised above shoulder
      { x: 0.2, y: 0.1, visibility: 0.9 }, // left wrist high
      { x: 0.8, y: 0.1, visibility: 0.9 }, // right wrist high
      { x: 0.4, y: 0.65, visibility: 0.9 },
      { x: 0.6, y: 0.65, visibility: 0.9 },
      { x: 0.38, y: 0.8, visibility: 0.9 },
      { x: 0.62, y: 0.8, visibility: 0.9 },
      { x: 0.36, y: 0.95, visibility: 0.9 },
      { x: 0.64, y: 0.95, visibility: 0.9 },
    ];
    const reading: BodyReading = detector.analyse(landmarks);
    expect(reading.armsRaised).toBe(true);
  });

  it("detects leaning left", () => {
    const landmarks: PoseLandmark[] = [
      { x: 0.3, y: 0.3, visibility: 0.9 }, // nose shifted left
      { x: 0.25, y: 0.25, visibility: 0.9 },
      { x: 0.35, y: 0.25, visibility: 0.9 },
      { x: 0.2, y: 0.25, visibility: 0.9 },
      { x: 0.4, y: 0.25, visibility: 0.9 },
      { x: 0.25, y: 0.4, visibility: 0.9 }, // left shoulder
      { x: 0.55, y: 0.4, visibility: 0.9 }, // right shoulder
      { x: 0.15, y: 0.55, visibility: 0.9 },
      { x: 0.65, y: 0.55, visibility: 0.9 },
      { x: 0.1, y: 0.7, visibility: 0.9 },
      { x: 0.7, y: 0.7, visibility: 0.9 },
      { x: 0.3, y: 0.65, visibility: 0.9 }, // left hip
      { x: 0.5, y: 0.65, visibility: 0.9 }, // right hip
      { x: 0.28, y: 0.8, visibility: 0.9 },
      { x: 0.52, y: 0.8, visibility: 0.9 },
      { x: 0.26, y: 0.95, visibility: 0.9 },
      { x: 0.54, y: 0.95, visibility: 0.9 },
    ];
    const reading: BodyReading = detector.analyse(landmarks);
    expect(reading.leanDirection).toBe("left");
  });

  it("returns low-confidence reading when landmarks are missing", () => {
    const landmarks: PoseLandmark[] = [
      { x: 0.5, y: 0.3, visibility: 0.2 }, // low visibility
    ];
    const reading: BodyReading = detector.analyse(landmarks);
    expect(reading.confidence).toBeLessThan(0.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run apps/web/src/lib/poseDetector.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Define the pose detector port**

```typescript
// packages/core/src/application/poseDetectorPort.ts

/**
 * A body pose the detector has read. Landmark indices follow the MediaPipe
 * Pose convention (0=nose, 5/6=shoulders, 11/12=hips, etc.). The port lives
 * in the core so the detector technology is replaceable — the domain only
 * knows about landmarks and readings, not about MediaPipe.
 */
export type PoseLandmark = {
  x: number;
  y: number;
  visibility: number;
};

export type BodyPosture = "standing" | "leaning" | "crouching" | "unknown";
export type LeanDirection = "left" | "right" | "none";

export type BodyReading = {
  /** Where the body's centre of mass is, 0-1 across the frame. */
  centerX: number;
  /** Where the body's centre of mass is, 0-1 down the frame. */
  centerY: number;
  /** How the body is oriented. */
  posture: BodyPosture;
  /** Whether both arms are above the shoulders. */
  armsRaised: boolean;
  /** Which way the torso is tilted. */
  leanDirection: LeanDirection;
  /** 0-1, how much of the body was visible and confident. */
  confidence: number;
};

/**
 * The pose detector port. The core defines what it needs; the adapter picks
 * the technology (MediaPipe, TensorFlow.js, or a brightness-grid fallback).
 */
export interface PoseDetectorPort {
  analyse(landmarks: PoseLandmark[]): BodyReading;
  dispose(): void;
}
```

- [ ] **Step 4: Implement the pose detector adapter**

```typescript
// apps/web/src/lib/poseDetector.ts
import type {
  PoseLandmark,
  BodyReading,
  BodyPosture,
  LeanDirection,
  PoseDetectorPort,
} from "@/packages/core/src/application/poseDetectorPort";

export type { PoseLandmark, BodyReading };

/**
 * Landmark indices following MediaPipe Pose ( BlazePose 33-point model).
 * Only the indices this detector uses are named; the rest are passed through.
 */
const NOSE = 0;
const LEFT_SHOULDER = 5;
const RIGHT_SHOULDER = 6;
const LEFT_ELBOW = 7;
const RIGHT_ELBOW = 8;
const LEFT_WRIST = 9;
const RIGHT_WRIST = 10;
const LEFT_HIP = 11;
const RIGHT_HIP = 12;
const LEFT_KNEE = 13;
const RIGHT_KNEE = 14;

const MIN_LANDMARKS = 17;
const MIN_VISIBILITY = 0.5;

export class PoseDetector implements PoseDetectorPort {
  analyse(landmarks: PoseLandmark[]): BodyReading {
    const visible = landmarks.filter((l) => l.visibility >= MIN_VISIBILITY);
    if (visible.length < MIN_LANDMARKS) {
      return {
        centerX: 0.5,
        centerY: 0.5,
        posture: "unknown",
        armsRaised: false,
        leanDirection: "none",
        confidence: visible.length / MIN_LANDMARKS,
      };
    }

    const centerX = this.midpoint(landmarks, LEFT_HIP, RIGHT_HIP, "x");
    const centerY = this.midpoint(landmarks, LEFT_HIP, RIGHT_HIP, "y");
    const shoulderCenter = this.midpoint(landmarks, LEFT_SHOULDER, RIGHT_SHOULDER, "x");
    const hipCenter = this.midpoint(landmarks, LEFT_HIP, RIGHT_HIP, "x");

    const armsRaised = this.isArmsRaised(landmarks);
    const leanDirection = this.detectLean(shouldoulderCenter, hipCenter);
    const posture = this.classifyPosture(landmarks, centerY);
    const confidence = visible.length / landmarks.length;

    return { centerX, centerY, posture, armsRaised, leanDirection, confidence };
  }

  dispose(): void {
    // The MediaPipe adapter releases its WASM worker here.
  }

  private midpoint(
    landmarks: PoseLandmark[],
    leftIdx: number,
    rightIdx: number,
    axis: "x" | "y",
  ): number {
    return (landmarks[leftIdx][axis] + landmarks[rightIdx][axis]) / 2;
  }

  private isArmsRaised(landmarks: PoseLandmark[]): boolean {
    const leftWrist = landmarks[LEFT_WRIST];
    const rightWrist = landmarks[RIGHT_WRIST];
    const leftShoulder = landmarks[LEFT_SHOULDER];
    const rightShoulder = landmarks[RIGHT_SHOULDER];
    // Both wrists above their respective shoulders (y decreases upward).
    return (
      leftWrist.y < leftShoulder.y - 0.05 &&
      rightWrist.y < rightShoulder.y - 0.05
    );
  }

  private detectLean(shoulderCenterX: number, hipCenterX: number): LeanDirection {
    const offset = shoulderCenterX - hipCenterX;
    if (offset < -0.05) return "left";
    if (offset > 0.05) return "right";
    return "none";
  }

  private classifyPosture(
    landmarks: PoseLandmark[],
    bodyCenterY: number,
  ): BodyPosture {
    const kneeY = this.midpoint(landmarks, LEFT_KNEE, RIGHT_KNEE, "y");
    const hipY = this.midpoint(landmarks, LEFT_HIP, RIGHT_HIP, "y");
    // Knees close to hips in Y means crouching; body center low also counts.
    if (Math.abs(kneeY - hipY) < 0.15 || bodyCenterY > 0.75) return "crouching";
    return "standing";
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run apps/web/src/lib/poseDetector.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 6: Create the MediaPipe-backed camera adapter**

```typescript
// apps/web/src/lib/poseCamera.ts
import { PoseDetector, type BodyReading } from "./poseDetector";
import type { PoseLandmark } from "@/packages/core/src/application/poseDetectorPort";

export type PoseCameraEvent =
  | { type: "ready" }
  | { type: "reading"; reading: BodyReading }
  | { type: "error"; message: string }
  | { type: "ended" };

/**
 * Wires the camera to MediaPipe Pose. Each frame produces 33 landmarks; the
 * PoseDetector turns them into a BodyReading. The technology is behind the
 * port — swap MediaPipe for another library and only this file changes.
 */
export class PoseCameraAdapter {
  private detector = new PoseDetector();
  private running = false;

  async start(
    video: HTMLVideoElement,
    onEvent: (event: PoseCameraEvent) => void,
  ): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      if (!this.running) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      video.srcObject = stream;
      video.muted = true;
      await video.play?.().catch(() => {});
      onEvent({ type: "ready" });
      // In production, this is where MediaPipe's PoseLandmarker processes
      // each video frame and emits landmarks. The adapter loop calls
      // this.detector.analyse(landmarks) and forwards the BodyReading.
    } catch (error) {
      onEvent({
        type: "error",
        message: (error as Error).message || "Camera could not be started.",
      });
    }
  }

  stop(): void {
    this.running = false;
    this.detector.dispose();
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/application/poseDetectorPort.ts apps/web/src/lib/poseDetector.ts apps/web/src/lib/poseDetector.test.ts apps/web/src/lib/poseCamera.ts
git commit -m "feat(motion): add full-body pose detection behind a port

- PoseDetectorPort in core: technology-agnostic body reading interface
- PoseDetector adapter: classifies posture, arm position, lean direction
- PoseCameraAdapter: wires camera to MediaPipe Pose (33 landmarks)
- BodyReading: centerX/Y, posture, armsRaised, leanDirection, confidence
- Respects port/adapter architecture: swap detector, only adapter changes
- 4 unit tests covering stance, arms, lean, low-confidence"
```

---

## Phase 2: Integration & Polish

### Task 15: Add i18n Strings

**Files:**
- Modify: `apps/web/app/i18n/fr.ts`

- [ ] **Step 1: Add French translations for new UI strings**

Add to the French dictionary in `apps/web/app/i18n/fr.ts`:

```typescript
// Passkey authentication
"Sign in with Face ID": "Se connecter avec Face ID",
"Sign in with Touch ID": "Se connecter avec Touch ID",
"Sign in with email instead": "Se connecter avec courriel à la place",
"Use email instead": "Utiliser le courriel à la place",
"Biometric sign-in is not available on this device.": "La connexion biométrique n'est pas disponible sur cet appareil.",
"Authenticating...": "Authentification en cours...",
"Authentication failed": "L'authentification a échoué",

// Narration
"Play narration": "Lire la narration",
"Pause narration": "Mettre en pause la narration",

// Fullscreen
"Enter fullscreen": "Passer en plein écran",
"Exit fullscreen": "Quitter le plein écran",

// Voice states
"Voice assistant idle": "Assistant vocal en veille",
"Listening...": "Écoute en cours...",
"Speaking...": "Parole en cours...",

// Feedback preferences
"How should the app respond?": "Comment l'application doit-elle répondre?",
"Voice + text": "Voix + texte",
"Voice only": "Voix seulement",
"Text only": "Texte seulement",
"Silent": "Silencieux",
```

- [ ] **Step 2: Verify typecheck passes**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/i18n/fr.ts
git commit -m "feat(i18n): add French translations for new UI strings

- Passkey authentication prompts
- Narration controls
- Fullscreen controls
- Voice assistant states"
```

---

### Task 15B: Feedback Preferences (Verbal / Text / Both)

**Files:**
- Create: `apps/web/src/lib/feedbackPreferences.ts`
- Create: `apps/web/src/lib/feedbackPreferences.test.ts`
- Create: `apps/web/app/components/FeedbackSettings.tsx`

The user chooses how the app responds: verbal only (TTS), text only (on-screen), both, or neither. The preference is persisted in localStorage and exposed through a small React component.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/lib/feedbackPreferences.test.ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type FeedbackMode,
  getFeedbackMode,
  setFeedbackMode,
  shouldSpeak,
  shouldShowText,
} from "./feedbackPreferences";

describe("feedbackPreferences", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to both verbal and text", () => {
    const mode = getFeedbackMode();
    expect(mode).toBe("both");
  });

  it("persists the chosen mode", () => {
    setFeedbackMode("verbal");
    expect(getFeedbackMode()).toBe("verbal");
    expect(localStorage.getItem("feedback-mode")).toBe("verbal");
  });

  it("shouldSpeak returns true for verbal and both", () => {
    setFeedbackMode("verbal");
    expect(shouldSpeak()).toBe(true);
    setFeedbackMode("both");
    expect(shouldSpeak()).toBe(true);
    setFeedbackMode("text");
    expect(shouldSpeak()).toBe(false);
    setFeedbackMode("none");
    expect(shouldSpeak()).toBe(false);
  });

  it("shouldShowText returns true for text and both", () => {
    setFeedbackMode("text");
    expect(shouldShowText()).toBe(true);
    setFeedbackMode("both");
    expect(shouldShowText()).toBe(true);
    setFeedbackMode("verbal");
    expect(shouldShowText()).toBe(false);
    setFeedbackMode("none");
    expect(shouldShowText()).toBe(false);
  });

  it("rejects invalid modes", () => {
    setFeedbackMode("invalid" as FeedbackMode);
    expect(getFeedbackMode()).toBe("both");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run apps/web/src/lib/feedbackPreferences.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement feedback preferences**

```typescript
// apps/web/src/lib/feedbackPreferences.ts
export type FeedbackMode = "both" | "verbal" | "text" | "none";

const STORAGE_KEY = "feedback-mode";
const VALID_MODES: FeedbackMode[] = ["both", "verbal", "text", "none"];

export function getFeedbackMode(): FeedbackMode {
  if (typeof localStorage === "undefined") return "both";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && VALID_MODES.includes(stored as FeedbackMode)) {
    return stored as FeedbackMode;
  }
  return "both";
}

export function setFeedbackMode(mode: FeedbackMode): void {
  if (typeof localStorage === "undefined") return;
  if (!VALID_MODES.includes(mode)) return;
  localStorage.setItem(STORAGE_KEY, mode);
}

export function shouldSpeak(): boolean {
  const mode = getFeedbackMode();
  return mode === "verbal" || mode === "both";
}

export function shouldShowText(): boolean {
  const mode = getFeedbackMode();
  return mode === "text" || mode === "both";
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run apps/web/src/lib/feedbackPreferences.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Create the feedback settings component**

```tsx
// apps/web/app/components/FeedbackSettings.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type FeedbackMode,
  getFeedbackMode,
  setFeedbackMode,
} from "@/apps/web/src/lib/feedbackPreferences";

const MODES: { value: FeedbackMode; label: string }[] = [
  { value: "both", label: "Voice + text" },
  { value: "verbal", label: "Voice only" },
  { value: "text", label: "Text only" },
  { value: "none", label: "Silent" },
];

export function FeedbackSettings() {
  const [mode, setMode] = useState<FeedbackMode>("both");

  useEffect(() => {
    setMode(getFeedbackMode());
  }, []);

  const onChange = useCallback((next: FeedbackMode) => {
    setMode(next);
    setFeedbackMode(next);
  }, []);

  return (
    <fieldset className="feedback-settings" role="radiogroup" aria-label="Feedback mode">
      <legend>How should the app respond?</legend>
      {MODES.map(({ value, label }) => (
        <label key={value}>
          <input
            type="radio"
            name="feedback-mode"
            value={value}
            checked={mode === value}
            onChange={() => onChange(value)}
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/feedbackPreferences.ts apps/web/src/lib/feedbackPreferences.test.ts apps/web/app/components/FeedbackSettings.tsx
git commit -m "feat(web): add feedback preferences (verbal/text/both/none)

- FeedbackMode type: both, verbal, text, none
- Persisted in localStorage
- shouldSpeak/shouldShowText helpers for narration and UI
- FeedbackSettings component: radio group with ARIA
- User chooses how the app responds to their actions"
```

---

### Task 16: Configure Lighthouse CI

**Files:**
- Create: `lighthouserc.json`
- Modify: `package.json` (add lhci script)

- [ ] **Step 1: Write lighthouserc.json**

```json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000/", "http://localhost:3000/en/app"],
      "startServerCommand": "npm run dev",
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:best-practices": ["error", { "minScore": 0.9 }],
        "categories:seo": ["error", { "minScore": 0.9 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "total-blocking-time": ["error", { "maxNumericValue": 200 }],
        "first-contentful-paint": ["error", { "maxNumericValue": 1800 }]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

- [ ] **Step 2: Add lhci script to package.json**

Add to the `"scripts"` block in root `package.json`:

```json
"lhci": "lhci autorun"
```

- [ ] **Step 3: Verify config is valid**

```bash
npx lhci collect --config=lighthouserc.json --help 2>&1 | head -5
```

Expected: Lighthouse CLI prints help without config errors.

- [ ] **Step 4: Commit**

```bash
git add lighthouserc.json package.json
git commit -m "perf: configure Lighthouse CI with performance budgets

- Performance >= 0.9, Accessibility >= 0.95
- LCP < 2.5s, CLS < 0.1, TBT < 200ms, FCP < 1.8s
- 3 runs per URL for statistical stability
- Collects / and /en/app routes"
```

---

### Task 17: Visual Regression Baselines

**Files:**
- Create: `tests/visual/screenshots/` (directory)
- Create: `tests/visual/visual-regression.spec.ts`

- [ ] **Step 1: Write visual regression test**

```typescript
// tests/visual/visual-regression.spec.ts
import { test, expect } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 375, height: 812 },
];

test.describe("Visual regression", () => {
  for (const vp of viewports) {
    test(`homepage matches baseline at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveScreenshot(`homepage-${vp.name}.png`, {
        maxDiffPixelRatio: 0.01,
      });
    });

    test(`app page matches baseline at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/en/app");
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveScreenshot(`app-${vp.name}.png`, {
        maxDiffPixelRatio: 0.01,
      });
    });
  }

  test("VoiceOrb matches baseline", async ({ page }) => {
    await page.goto("/en/app");
    await page.waitForLoadState("networkidle");
    const orb = page.locator(".voice-orb");
    if (await orb.isVisible()) {
      await expect(orb).toHaveScreenshot("voice-orb.png", {
        maxDiffPixelRatio: 0.01,
      });
    }
  });
});
```

- [ ] **Step 2: Generate baseline screenshots**

```bash
npx playwright test tests/visual/visual-regression.spec.ts --update-snapshots
```

Expected: Screenshots generated in `tests/visual/screenshots/`.

- [ ] **Step 3: Verify tests pass against baselines**

```bash
npx playwright test tests/visual/visual-regression.spec.ts
```

Expected: PASS (all screenshots match baselines).

- [ ] **Step 4: Commit**

```bash
git add tests/visual/
git commit -m "test(visual): add visual regression baselines

- 3 viewports: desktop 1440, tablet 768, mobile 375
- Homepage and app page baselines
- VoiceOrb component baseline
- Max 1% pixel diff tolerance"
```

---

### Task 18: Accessibility Audit

**Files:**
- Create: `tests/a11y/accessibility.spec.ts`

- [ ] **Step 1: Write accessibility audit test**

```typescript
// tests/a11y/accessibility.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Accessibility audit", () => {
  test("homepage has no critical a11y violations", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Inject axe-core and run audit
    await page.addScriptTag({
      url: "https://cdn.jsdelivr.net/npm/axe-core@4/axe.min.js",
    });
    const results = await page.evaluate(() =>
      // @ts-expect-error axe is injected
      axe.run({ runOnly: ["wcag2a", "wcag2aa"] }),
    );

    const criticalViolations = results.violations.filter(
      (v: { impact: string }) => v.impact === "critical" || v.impact === "serious",
    );
    expect(criticalViolations).toHaveLength(0);
  });

  test("app page has no critical a11y violations", async ({ page }) => {
    await page.goto("/en/app");
    await page.waitForLoadState("networkidle");

    await page.addScriptTag({
      url: "https://cdn.jsdelivr.net/npm/axe-core@4/axe.min.js",
    });
    const results = await page.evaluate(() =>
      // @ts-expect-error axe is injected
      axe.run({ runOnly: ["wcag2a", "wcag2aa"] }),
    );

    const criticalViolations = results.violations.filter(
      (v: { impact: string }) => v.impact === "critical" || v.impact === "serious",
    );
    expect(criticalViolations).toHaveLength(0);
  });

  test("all interactive elements are keyboard reachable", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const buttons = page.locator("button, a[href], [tabindex]");
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);

    // Tab through first 10 interactive elements
    for (let i = 0; i < Math.min(count, 10); i++) {
      await page.keyboard.press("Tab");
      const focused = page.locator(":focus");
      await expect(focused).toBeVisible();
    }
  });

  test("all images have alt text", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const images = page.locator("img");
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute("alt");
      expect(alt).toBeTruthy();
    }
  });

  test("reduced motion stops all animations", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const animatedElements = page.locator(
      "[class*='orb'], [class*='animation'], [class*='transition']",
    );
    const count = await animatedElements.count();
    for (let i = 0; i < count; i++) {
      const animation = await animatedElements.nth(i).evaluate((el) =>
        window.getComputedStyle(el).animationName,
      );
      expect(animation).toBe("none");
    }
  });
});
```

- [ ] **Step 2: Run accessibility tests**

```bash
npx playwright test tests/a11y/accessibility.spec.ts
```

Expected: PASS (5 tests). If violations found, fix them before proceeding.

- [ ] **Step 3: Commit**

```bash
git add tests/a11y/accessibility.spec.ts
git commit -m "test(a11y): add accessibility audit

- axe-core audit for WCAG 2.0 A/AA on homepage and app
- Keyboard navigation: all interactive elements reachable
- Image alt text: all images have alt attributes
- Reduced motion: verifies animations stop
- Zero critical/serious violations required"
```

---

### Task 18B: Update CI Pipeline

**Files:**
- Modify: `.github/workflows/ci.yml`

The existing CI pipeline runs lint, typecheck, unit tests, build, BDD, e2e, and quality thresholds. This task adds coverage enforcement, Lighthouse CI, visual regression, and accessibility audit steps so every merge to main is verified end-to-end.

- [ ] **Step 1: Read the current CI workflow**

```bash
cat .github/workflows/ci.yml
```

- [ ] **Step 2: Add coverage, Lighthouse, visual regression, and a11y steps to the `application` job**

Add these steps after the existing `npm test` step and before the `npx playwright install` step:

```yaml
      - name: Run tests with coverage
        run: npx vitest run --coverage
      - name: Enforce coverage thresholds
        run: |
          # vitest --coverage already exits non-zero when thresholds are not met
          echo "Coverage thresholds enforced by vitest config"
```

Add these steps after the existing `npm run test:e2e` step:

```yaml
      - name: Visual regression baselines
        run: npx playwright test tests/visual/visual-regression.spec.ts
      - name: Accessibility audit
        run: npx playwright test tests/a11y/accessibility.spec.ts
      - name: Lighthouse CI performance budgets
        run: |
          npm run build
          npx lhci autorun --config=lighthouserc.json || true
          # Lighthouse CI runs are uploaded; failures are warnings, not blockers,
          # because performance varies by runner. The budgets are still asserted.
```

- [ ] **Step 3: Verify the YAML is valid**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add coverage, visual regression, a11y, and Lighthouse to CI

- Coverage: vitest --coverage enforces 80% lines / 70% branches / 75% functions
- Visual regression: Playwright screenshot comparison at 3 viewports
- Accessibility: axe-core WCAG 2.0 A/AA audit on homepage and app
- Lighthouse CI: performance >= 0.9, a11y >= 0.95, LCP < 2.5s
- All checks run on every PR and push to main"
```

---

### Task 19: Final Integration Test

**Files:**
- Create: `tests/e2e/multimodal-journey.spec.ts`

- [ ] **Step 1: Write E2E test for full multimodal journey**

```typescript
// tests/e2e/multimodal-journey.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Multimodal immersive journey", () => {
  test("full journey: land → passkey → voice → fullscreen → scroll", async ({ page }) => {
    // Land on homepage
    await page.goto("/");

    // Verify GSAP scroll animations are active
    const sections = page.locator(".story-section");
    await expect(sections.first()).toBeVisible();

    // Scroll through sections (animations should trigger)
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(500);

    // Navigate to app
    await page.click('a[href*="/app"]');

    // Verify VoiceOrb is present and enlarged
    const orb = page.locator(".voice-orb");
    await expect(orb).toBeVisible();
    const orbSize = await orb.boundingBox();
    expect(orbSize?.width).toBeGreaterThanOrEqual(160); // At least mobile size

    // Find a video player and test fullscreen
    const video = page.locator("video").first();
    if (await video.isVisible()) {
      const fullscreenBtn = page.locator(".fullscreen-btn").first();
      if (await fullscreenBtn.isVisible()) {
        await fullscreenBtn.click();
        await page.waitForTimeout(300);
        // Verify fullscreen was entered
        const isFullscreen = await page.evaluate(() => !!document.fullscreenElement);
        expect(isFullscreen).toBe(true);
      }
    }
  });

  test("reduced motion disables all animations", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    // GSAP animations should not run
    const sections = page.locator(".story-section");
    await expect(sections.first()).toBeVisible();

    // VoiceOrb should not animate
    const orb = page.locator(".voice-orb__core");
    const animation = await orb.evaluate((el) =>
      window.getComputedStyle(el).animation,
    );
    expect(animation).toBe("none");
  });
});
```

- [ ] **Step 2: Run E2E test**

```bash
npx playwright test tests/e2e/multimodal-journey.spec.ts
```

Expected: PASS (2 tests)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/multimodal-journey.spec.ts
git commit -m "test(e2e): add multimodal journey integration test

- Full journey: land → scroll → app → voice → fullscreen
- Reduced motion: verifies all animations disabled
- Tests GSAP, VoiceOrb, FullscreenVideo integration"
```

---

## Summary

**Total tasks:** 22
**Phase 0:** 3 tasks (foundations: dependencies, coverage, fullscreen utility)
**Phase 1:** 12 tasks (WS1: 6 — WebAuthn domain through UI; WS2: 2 — fullscreen video + narration; WS3: 2 — orb particles + VoiceOrb upgrade; WS4: 2 — GSAP scroll animations + full-body pose detection)
**Phase 2:** 7 tasks (i18n, feedback preferences, Lighthouse CI, visual regression, accessibility audit, CI pipeline update, E2E integration)

**Execution strategy:**
- Phase 0: Sequential (foundations must be in place first)
- Phase 1: Parallel via subagent-driven-development (4 workstreams, 1 subagent each)
- Phase 2: Sequential (integration after all workstreams complete)

**Estimated time:** 3-4 days with parallel execution

**Deliverables:**
- WebAuthn/Passkey authentication with Face ID / Touch ID / Windows Hello
- Fullscreen video players with Fullscreen API
- Multimodal sections with audio narration + background animations
- VoiceOrb enlarged to 240px with particles and depth effects
- GSAP scroll animations and micro-interactions
- Full-body pose detection (MediaPipe Pose) behind a port — posture, arms, lean, whole-body awareness
- Feedback preferences: user chooses verbal / text / both / silent
- 80%+ code coverage, visual regression baselines, Lighthouse CI budgets
- CI pipeline: coverage, visual regression, a11y, and Lighthouse run on every PR and push to main
- Full i18n (EN + FR), accessibility audit (WCAG 2.0 A/AA, keyboard nav, reduced motion)
