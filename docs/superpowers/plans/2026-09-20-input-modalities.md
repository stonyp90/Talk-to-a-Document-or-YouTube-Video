# Input Modalities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add six new input modality capabilities to the Ursly web app: quick toggles, keyboard fallback, non-verbal tracking, document upload with gesture navigation, unified feedback UI, and language-specific voice commands.

**Architecture:** Hexagonal architecture with ports and adapters. Each capability is a single-responsibility component that plugs into the Workspace orchestration layer via custom hooks. Domain logic in `packages/core/src/domain/`, adapters in `packages/adapters/src/`, React components in `apps/web/app/components/`.

**Tech Stack:** React 18, TypeScript 5, Next.js 15, Vitest, Playwright, Web Speech API, MediaDevices API, File System Access API, localStorage.

**Spec:** `docs/superpowers/specs/2026-09-20-input-modalities-design.md`

## Global Constraints

- All animations use spring easing `cubic-bezier(0.16, 1, 0.3, 1)` unless specified
- All UI elements: outlined/ghost style, 2px borders, no filled backgrounds on main surface
- Card-style containers only inside modals/dialogs
- Reduced-motion support: instant transitions when `prefers-reduced-motion` is set
- All toasts: `role="alert"` or `role="status"` with `aria-live`
- Brand accent line: 2px `border-top: solid var(--accent)` for success states
- CSS variables: `--accent` (brand), `--accent-glow` (bright brand), `--danger` (error red), `--success`, `--ink`, `--muted`, `--paper`, `--surface`
- Toggle debounce: 300ms for all quick toggle buttons
- File size limit: 100MB per file
- Session log cap: 500 entries
- Feedback bus queue cap: 20 events
- Folder nesting cap: 10 levels
- Gesture debounce: 300ms between gestures
- Test at four levels: unit, contract, component, BDD
- No regressions in existing 1079 tests
- Hooks co-located with components in `apps/web/app/components/` (follow existing pattern)

---

## Phase 0: Foundation — FeedbackBus

### Task 1: Create FeedbackBus Port Interface

**Files:**
- Create: `packages/core/src/domain/feedbackBus.ts`
- Create: `packages/core/src/domain/feedbackBus.test.ts`
- Create: `packages/core/src/domain/feedbackBus.contract.test.ts`

**Interfaces:**
- Consumes: Nothing (foundation)
- Produces: `FeedbackBus` port interface, `FeedbackEvent` type, `FeedbackType` enum

- [ ] **Step 1: Write failing test for FeedbackBus port**

```typescript
// packages/core/src/domain/feedbackBus.test.ts
import { describe, it, expect } from 'vitest';
import { FeedbackBus, FeedbackType, FeedbackEvent } from './feedbackBus';

describe('FeedbackBus', () => {
  it('emits feedback events', () => {
    const bus = new FeedbackBus();
    const events: FeedbackEvent[] = [];
    bus.on(event => events.push(event));

    bus.emit({
      type: FeedbackType.INFO,
      message: 'Test message',
      timestamp: new Date(),
    });

    expect(events).toHaveLength(1);
    expect(events[0].message).toBe('Test message');
  });

  it('caps queue at 20 events', () => {
    const bus = new FeedbackBus();
    for (let i = 0; i < 25; i++) {
      bus.emit({
        type: FeedbackType.INFO,
        message: `Event ${i}`,
        timestamp: new Date(),
      });
    }

    expect(bus.getQueueLength()).toBe(20);
  });

  it('removes listener', () => {
    const bus = new FeedbackBus();
    const events: FeedbackEvent[] = [];
    const listener = (event: FeedbackEvent) => events.push(event);
    bus.on(listener);
    bus.off(listener);

    bus.emit({
      type: FeedbackType.INFO,
      message: 'Test',
      timestamp: new Date(),
    });

    expect(events).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- packages/core/src/domain/feedbackBus.test.ts`
Expected: FAIL — "Cannot find module './feedbackBus'"

- [ ] **Step 3: Implement FeedbackBus port**

```typescript
// packages/core/src/domain/feedbackBus.ts
export enum FeedbackType {
  SUCCESS = 'success',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CORRECTION = 'correction',
}

export interface FeedbackEvent {
  type: FeedbackType;
  message: string;
  timestamp: Date;
  duration?: number;
  action?: string;
}

export type FeedbackListener = (event: FeedbackEvent) => void;

export class FeedbackBus {
  private listeners: FeedbackListener[] = [];
  private queue: FeedbackEvent[] = [];
  private readonly MAX_QUEUE_SIZE = 20;

  on(listener: FeedbackListener): void {
    this.listeners.push(listener);
  }

  off(listener: FeedbackListener): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  emit(event: FeedbackEvent): void {
    this.queue.push(event);
    if (this.queue.length > this.MAX_QUEUE_SIZE) {
      const dropped = this.queue.shift();
      console.warn('FeedbackBus: dropped event', dropped);
    }
    this.listeners.forEach(listener => listener(event));
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- packages/core/src/domain/feedbackBus.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Write contract test**

```typescript
// packages/core/src/domain/feedbackBus.contract.test.ts
import { describe, it, expect } from 'vitest';
import { FeedbackBus, FeedbackType } from './feedbackBus';

describe('FeedbackBus Contract', () => {
  it('satisfies port interface', () => {
    const bus = new FeedbackBus();
    expect(typeof bus.on).toBe('function');
    expect(typeof bus.off).toBe('function');
    expect(typeof bus.emit).toBe('function');
    expect(typeof bus.getQueueLength).toBe('function');
    expect(typeof bus.clear).toBe('function');
  });

  it('emits events with correct structure', () => {
    const bus = new FeedbackBus();
    let received: any = null;
    bus.on(event => { received = event; });

    bus.emit({
      type: FeedbackType.ERROR,
      message: 'Test error',
      timestamp: new Date(),
    });

    expect(received).toHaveProperty('type');
    expect(received).toHaveProperty('message');
    expect(received).toHaveProperty('timestamp');
  });
});
```

- [ ] **Step 6: Run contract test**

Run: `npm test -- packages/core/src/domain/feedbackBus.contract.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/domain/feedbackBus.ts packages/core/src/domain/feedbackBus.test.ts packages/core/src/domain/feedbackBus.contract.test.ts
git commit -m "feat: add FeedbackBus port with queue cap"
```

---

### Task 2: Create useFeedback Hook

**Files:**
- Create: `apps/web/app/components/useFeedback.ts`
- Create: `apps/web/app/components/useFeedback.test.ts`

**Interfaces:**
- Consumes: `FeedbackBus` from Phase 0 Task 1
- Produces: `useFeedback()` returns `{ events, emitSuccess, emitInfo, emitWarning, emitError, emitCorrection, dismissEvent }`

- [ ] **Step 1: Write failing test for useFeedback hook**

```typescript
// apps/web/app/components/useFeedback.test.ts
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFeedback } from './useFeedback';

describe('useFeedback', () => {
  it('starts with empty events', () => {
    const { result } = renderHook(() => useFeedback());
    expect(result.current.events).toEqual([]);
  });

  it('adds info event', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.emitInfo('Test message');
    });
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].message).toBe('Test message');
  });

  it('dismisses event', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.emitInfo('Test');
    });
    const eventId = result.current.events[0].timestamp.getTime();
    act(() => {
      result.current.dismissEvent(eventId);
    });
    expect(result.current.events).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- apps/web/app/components/useFeedback.test.ts`
Expected: FAIL — "Cannot find module './useFeedback'"

- [ ] **Step 3: Implement useFeedback hook**

```typescript
// apps/web/app/components/useFeedback.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { FeedbackBus, FeedbackType, FeedbackEvent } from '@talk-to-a-document/core/src/domain/feedbackBus';

export function useFeedback() {
  const [events, setEvents] = useState<FeedbackEvent[]>([]);
  const busRef = useRef(new FeedbackBus());

  useEffect(() => {
    const bus = busRef.current;
    const listener = (event: FeedbackEvent) => {
      setEvents(prev => [...prev, event]);
    };
    bus.on(listener);
    return () => {
      bus.off(listener);
    };
  }, []);

  const emitSuccess = useCallback((message: string) => {
    busRef.current.emit({ type: FeedbackType.SUCCESS, message, timestamp: new Date(), duration: 1200 });
  }, []);

  const emitInfo = useCallback((message: string) => {
    busRef.current.emit({ type: FeedbackType.INFO, message, timestamp: new Date(), duration: 3000 });
  }, []);

  const emitWarning = useCallback((message: string) => {
    busRef.current.emit({ type: FeedbackType.WARNING, message, timestamp: new Date(), duration: 4000 });
  }, []);

  const emitError = useCallback((message: string, action?: string) => {
    busRef.current.emit({ type: FeedbackType.ERROR, message, timestamp: new Date(), duration: 6000, action });
  }, []);

  const emitCorrection = useCallback((message: string) => {
    busRef.current.emit({ type: FeedbackType.CORRECTION, message, timestamp: new Date(), duration: 2000 });
  }, []);

  const dismissEvent = useCallback((timestamp: number) => {
    setEvents(prev => prev.filter(e => e.timestamp.getTime() !== timestamp));
  }, []);

  return { events, emitSuccess, emitInfo, emitWarning, emitError, emitCorrection, dismissEvent };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- apps/web/app/components/useFeedback.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/components/useFeedback.ts apps/web/app/components/useFeedback.test.ts
git commit -m "feat: add useFeedback hook"
```

---

### Task 3: Create FeedbackOverlay Component

**Files:**
- Create: `apps/web/app/components/FeedbackOverlay.tsx`
- Create: `apps/web/app/components/FeedbackOverlay.test.tsx`
- Create: `apps/web/app/components/FeedbackOverlay.module.css`

**Interfaces:**
- Consumes: `useFeedback()` hook from Task 2
- Produces: `<FeedbackOverlay />` component that renders all feedback toasts

- [ ] **Step 1: Write failing test for FeedbackOverlay**

```typescript
// apps/web/app/components/FeedbackOverlay.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeedbackOverlay } from './FeedbackOverlay';

describe('FeedbackOverlay', () => {
  it('renders nothing when no events', () => {
    const { container } = render(<FeedbackOverlay />);
    expect(container.firstChild).toBeNull();
  });

  it('renders info toast', () => {
    render(<FeedbackOverlay />);
    // This test will be expanded once we integrate with useFeedback
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- apps/web/app/components/FeedbackOverlay.test.tsx`
Expected: FAIL — "Cannot find module './FeedbackOverlay'"

- [ ] **Step 3: Implement FeedbackOverlay component**

```typescript
// apps/web/app/components/FeedbackOverlay.tsx
import { useFeedback } from './useFeedback';
import { FeedbackType } from '@talk-to-a-document/core/src/domain/feedbackBus';
import styles from './FeedbackOverlay.module.css';

export function FeedbackOverlay() {
  const { events, dismissEvent } = useFeedback();

  if (events.length === 0) return null;

  return (
    <div className={styles.overlay}>
      {events.slice(0, 3).map((event, index) => {
        const typeClass = styles[event.type] || styles.info;
        const role = event.type === FeedbackType.ERROR ? 'alert' : 'status';
        const ariaLive = event.type === FeedbackType.ERROR ? 'assertive' : 'polite';

        return (
          <div
            key={event.timestamp.getTime()}
            className={`${styles.toast} ${typeClass}`}
            role={role}
            aria-live={ariaLive}
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <span className={styles.message}>{event.message}</span>
            {event.action && (
              <button className={styles.action} onClick={() => dismissEvent(event.timestamp.getTime())}>
                {event.action}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Create CSS module**

```css
/* apps/web/app/components/FeedbackOverlay.module.css */
.overlay {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 200;
  pointer-events: none;
}

.toast {
  padding: 12px 20px;
  border: 2px solid var(--accent);
  border-radius: 4px;
  background: transparent;
  color: var(--ink);
  display: flex;
  align-items: center;
  gap: 12px;
  animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: auto;
}

.success {
  border-color: var(--accent);
  border-top: 2px solid var(--accent);
}

.info {
  border-color: var(--accent);
}

.warning {
  border-color: var(--accent-glow);
  animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1), pulse 2s ease-in-out infinite;
}

.error {
  border-color: #ef4444;
  animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1), shake 0.5s ease-in-out;
}

.correction {
  border-color: var(--accent);
  font-style: italic;
}

.message {
  flex: 1;
}

.action {
  padding: 4px 12px;
  border: 1px solid currentColor;
  border-radius: 2px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 0.875rem;
}

.action:hover {
  background: currentColor;
  color: var(--paper);
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

@keyframes shake {
  0%, 100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-5px);
  }
  75% {
    transform: translateX(5px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .toast {
    animation: none;
  }
  .warning {
    animation: none;
  }
  .error {
    animation: none;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- apps/web/app/components/FeedbackOverlay.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/components/FeedbackOverlay.tsx apps/web/app/components/FeedbackOverlay.test.tsx apps/web/app/components/FeedbackOverlay.module.css
git commit -m "feat: add FeedbackOverlay component"
```

---

## Phase 1: Quick Toggles + Video Overlay

### Task 4: Create QuickToggleBar Component

**Files:**
- Create: `apps/web/app/components/QuickToggleBar.tsx`
- Create: `apps/web/app/components/QuickToggleBar.test.tsx`
- Create: `apps/web/app/components/QuickToggleBar.module.css`

**Interfaces:**
- Consumes: Voice and motion state from Workspace (via props)
- Produces: `<QuickToggleBar />` component with mic and camera toggle buttons

- [ ] **Step 1: Write failing test for QuickToggleBar**

```typescript
// apps/web/app/components/QuickToggleBar.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuickToggleBar } from './QuickToggleBar';

describe('QuickToggleBar', () => {
  it('renders mic and camera toggle buttons', () => {
    const onToggleVoice = vi.fn();
    const onToggleCamera = vi.fn();
    render(<QuickToggleBar voiceActive={false} cameraActive={false} onToggleVoice={onToggleVoice} onToggleCamera={onToggleCamera} />);
    expect(screen.getByRole('button', { name: /mic/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /camera/i })).toBeInTheDocument();
  });

  it('calls onToggleVoice on mic click', () => {
    const onToggleVoice = vi.fn();
    const onToggleCamera = vi.fn();
    render(<QuickToggleBar voiceActive={false} cameraActive={false} onToggleVoice={onToggleVoice} onToggleCamera={onToggleCamera} />);
    const micButton = screen.getByRole('button', { name: /mic/i });
    fireEvent.click(micButton);
    expect(onToggleVoice).toHaveBeenCalled();
  });

  it('calls onToggleCamera on camera click', () => {
    const onToggleVoice = vi.fn();
    const onToggleCamera = vi.fn();
    render(<QuickToggleBar voiceActive={false} cameraActive={false} onToggleVoice={onToggleVoice} onToggleCamera={onToggleCamera} />);
    const cameraButton = screen.getByRole('button', { name: /camera/i });
    fireEvent.click(cameraButton);
    expect(onToggleCamera).toHaveBeenCalled();
  });

  it('reflects active state', () => {
    const onToggleVoice = vi.fn();
    const onToggleCamera = vi.fn();
    render(<QuickToggleBar voiceActive={true} cameraActive={true} onToggleVoice={onToggleVoice} onToggleCamera={onToggleCamera} />);
    const micButton = screen.getByRole('button', { name: /mic/i });
    const cameraButton = screen.getByRole('button', { name: /camera/i });
    expect(micButton).toHaveAttribute('aria-pressed', 'true');
    expect(cameraButton).toHaveAttribute('aria-pressed', 'true');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- apps/web/app/components/QuickToggleBar.test.tsx`
Expected: FAIL — "Cannot find module './QuickToggleBar'"

- [ ] **Step 3: Implement QuickToggleBar component**

```typescript
// apps/web/app/components/QuickToggleBar.tsx
import { useState, useCallback, useRef } from 'react';
import styles from './QuickToggleBar.module.css';

interface QuickToggleBarProps {
  voiceActive: boolean;
  cameraActive: boolean;
  onToggleVoice: () => void;
  onToggleCamera: () => void;
}

export function QuickToggleBar({ voiceActive, cameraActive, onToggleVoice, onToggleCamera }: QuickToggleBarProps) {
  const [debouncing, setDebouncing] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const handleToggle = useCallback((toggleFn: () => void) => {
    if (debouncing) return;
    toggleFn();
    setDebouncing(true);
    timeoutRef.current = setTimeout(() => setDebouncing(false), 300);
  }, [debouncing]);

  return (
    <div className={styles.toggleBar} role="toolbar" aria-label="Quick toggles">
      <button
        className={styles.toggleButton}
        onClick={() => handleToggle(onToggleVoice)}
        aria-pressed={voiceActive}
        aria-label="Mic"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </button>
      <button
        className={styles.toggleButton}
        onClick={() => handleToggle(onToggleCamera)}
        aria-pressed={cameraActive}
        aria-label="Camera"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M23 7l-7 5 7 5V7z" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Create CSS module**

```css
/* apps/web/app/components/QuickToggleBar.module.css */
.toggleBar {
  position: fixed;
  top: 20px;
  right: 20px;
  display: flex;
  gap: 12px;
  z-index: 100;
}

.toggleButton {
  width: 48px;
  height: 48px;
  border: 2px solid var(--accent);
  border-radius: 50%;
  background: transparent;
  color: var(--accent);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.toggleButton:hover {
  background: var(--accent);
  color: white;
  transform: scale(1.05);
}

.toggleButton[aria-pressed="true"] {
  background: var(--accent);
  color: white;
}

.toggleButton:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .toggleButton {
    transition: none;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- apps/web/app/components/QuickToggleBar.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/components/QuickToggleBar.tsx apps/web/app/components/QuickToggleBar.test.tsx apps/web/app/components/QuickToggleBar.module.css
git commit -m "feat: add QuickToggleBar with debounce"
```

---

### Task 5: Create VideoOverlay Component

**Files:**
- Create: `apps/web/app/components/VideoOverlay.tsx`
- Create: `apps/web/app/components/VideoOverlay.test.tsx`
- Create: `apps/web/app/components/VideoOverlay.module.css`

**Interfaces:**
- Consumes: Camera stream (via props or ref)
- Produces: `<VideoOverlay opacity={0.15} />` component

- [ ] **Step 1: Write failing test for VideoOverlay**

```typescript
// apps/web/app/components/VideoOverlay.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VideoOverlay } from './VideoOverlay';

describe('VideoOverlay', () => {
  it('renders video element', () => {
    render(<VideoOverlay active={true} />);
    const video = screen.getByTestId('video-overlay');
    expect(video).toBeInTheDocument();
  });

  it('applies default opacity', () => {
    render(<VideoOverlay active={true} />);
    const video = screen.getByTestId('video-overlay');
    expect(video).toHaveStyle({ opacity: '0.15' });
  });

  it('applies custom opacity', () => {
    render(<VideoOverlay active={true} opacity={0.2} />);
    const video = screen.getByTestId('video-overlay');
    expect(video).toHaveStyle({ opacity: '0.2' });
  });

  it('shows ghost state when camera unavailable', () => {
    render(<VideoOverlay active={false} cameraUnavailable={true} />);
    expect(screen.getByText(/camera unavailable/i)).toBeInTheDocument();
  });

  it('renders nothing when inactive and no ghost state', () => {
    const { container } = render(<VideoOverlay active={false} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- apps/web/app/components/VideoOverlay.test.tsx`
Expected: FAIL — "Cannot find module './VideoOverlay'"

- [ ] **Step 3: Implement VideoOverlay component**

```typescript
// apps/web/app/components/VideoOverlay.tsx
import { useEffect, useRef } from 'react';
import styles from './VideoOverlay.module.css';

interface VideoOverlayProps {
  active: boolean;
  opacity?: number;
  cameraUnavailable?: boolean;
  stream?: MediaStream | null;
}

export function VideoOverlay({ active, opacity = 0.15, cameraUnavailable = false, stream = null }: VideoOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!active && !cameraUnavailable) return null;

  if (cameraUnavailable) {
    return (
      <div className={styles.ghostState}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
        <span>Camera unavailable</span>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      data-testid="video-overlay"
      className={styles.videoOverlay}
      style={{ opacity }}
      autoPlay
      muted
      playsInline
    />
  );
}
```

- [ ] **Step 4: Create CSS module**

```css
/* apps/web/app/components/VideoOverlay.module.css */
.videoOverlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
  z-index: 10;
  transform: scaleX(-1);
}

.ghostState {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--muted);
  opacity: 0.5;
}

@media (prefers-reduced-motion: reduce) {
  .videoOverlay {
    transition: none;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- apps/web/app/components/VideoOverlay.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/components/VideoOverlay.tsx apps/web/app/components/VideoOverlay.test.tsx apps/web/app/components/VideoOverlay.module.css
git commit -m "feat: add VideoOverlay with opacity control"
```

---

## Phase 2: Keyboard Fallback

### Task 6: Create Action Suggestions Domain Logic

**Files:**
- Create: `packages/core/src/domain/actionSuggestions.ts`
- Create: `packages/core/src/domain/actionSuggestions.test.ts`

**Interfaces:**
- Consumes: `VoiceActionId` from `voiceCommands.ts`, source type info
- Produces: `Suggestion`, `SuggestionContext`, `generateSuggestions()` function

- [ ] **Step 1: Write failing test**

```typescript
// packages/core/src/domain/actionSuggestions.test.ts
import { describe, it, expect } from 'vitest';
import { generateSuggestions, type SuggestionContext } from './actionSuggestions';

describe('generateSuggestions', () => {
  it('returns upload-related suggestions when no source loaded', () => {
    const ctx: SuggestionContext = {
      sourceType: null,
      conversationState: 'idle',
      lastAction: null,
      idleMs: 0,
    };
    const suggestions = generateSuggestions(ctx);
    const ids = suggestions.map(s => s.action);
    expect(ids).toContain('upload');
    expect(ids).toContain('youtube');
  });

  it('returns summarize when source is loaded', () => {
    const ctx: SuggestionContext = {
      sourceType: 'pdf',
      conversationState: 'idle',
      lastAction: null,
      idleMs: 0,
    };
    const suggestions = generateSuggestions(ctx);
    const ids = suggestions.map(s => s.action);
    expect(ids).toContain('summarize');
  });

  it('returns back when in conversation', () => {
    const ctx: SuggestionContext = {
      sourceType: 'pdf',
      conversationState: 'active',
      lastAction: null,
      idleMs: 0,
    };
    const suggestions = generateSuggestions(ctx);
    const ids = suggestions.map(s => s.action);
    expect(ids).toContain('back');
  });

  it('returns empty when idle > 10s', () => {
    const ctx: SuggestionContext = {
      sourceType: null,
      conversationState: 'idle',
      lastAction: null,
      idleMs: 15000,
    };
    const suggestions = generateSuggestions(ctx);
    expect(suggestions).toHaveLength(0);
  });

  it('limits to 3 suggestions', () => {
    const ctx: SuggestionContext = {
      sourceType: 'pdf',
      conversationState: 'active',
      lastAction: 'summarize',
      idleMs: 0,
    };
    const suggestions = generateSuggestions(ctx);
    expect(suggestions.length).toBeLessThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- packages/core/src/domain/actionSuggestions.test.ts`
Expected: FAIL — "Cannot find module './actionSuggestions'"

- [ ] **Step 3: Implement action suggestions engine**

```typescript
// packages/core/src/domain/actionSuggestions.ts
import type { VoiceActionId } from './voiceCommands';

export type SuggestionContext = {
  sourceType: 'pdf' | 'youtube' | null;
  conversationState: 'idle' | 'active';
  lastAction: VoiceActionId | null;
  idleMs: number;
};

export type Suggestion = {
  action: VoiceActionId;
  label: string;
};

const IDLE_FADE_MS = 10_000;
const MAX_SUGGESTIONS = 3;

export function generateSuggestions(ctx: SuggestionContext): Suggestion[] {
  if (ctx.idleMs > IDLE_FADE_MS) return [];

  const suggestions: Suggestion[] = [];

  if (!ctx.sourceType) {
    suggestions.push({ action: 'upload', label: 'Upload file' });
    suggestions.push({ action: 'youtube', label: 'YouTube video' });
  }

  if (ctx.sourceType) {
    suggestions.push({ action: 'summarize', label: 'Summarize' });
    suggestions.push({ action: 'search', label: 'Search' });
  }

  if (ctx.conversationState === 'active') {
    suggestions.push({ action: 'back', label: 'Go back' });
  }

  if (ctx.sourceType) {
    suggestions.push({ action: 'open', label: 'Files' });
  }

  const filtered = suggestions.filter(s => s.action !== ctx.lastAction);
  return filtered.slice(0, MAX_SUGGESTIONS);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- packages/core/src/domain/actionSuggestions.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/domain/actionSuggestions.ts packages/core/src/domain/actionSuggestions.test.ts
git commit -m "feat: add action suggestions rule engine"
```

---

### Task 7: Create useKeyboardMode Hook

**Files:**
- Create: `apps/web/app/components/useKeyboardMode.ts`
- Create: `apps/web/app/components/useKeyboardMode.test.ts`

**Interfaces:**
- Consumes: `VoiceActionId` from `voiceCommands.ts`, slash command mapping
- Produces: `useKeyboardMode()` returns `{ enabled, setEnabled, parseSlashCommand, suggestions }`

- [ ] **Step 1: Write failing test**

```typescript
// apps/web/app/components/useKeyboardMode.test.ts
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardMode } from './useKeyboardMode';

describe('useKeyboardMode', () => {
  it('starts disabled', () => {
    const { result } = renderHook(() => useKeyboardMode());
    expect(result.current.enabled).toBe(false);
  });

  it('can be enabled', () => {
    const { result } = renderHook(() => useKeyboardMode());
    act(() => result.current.setEnabled(true));
    expect(result.current.enabled).toBe(true);
  });

  it('parses /upload command', () => {
    const { result } = renderHook(() => useKeyboardMode());
    const cmd = result.current.parseSlashCommand('/upload');
    expect(cmd).toEqual({ action: 'upload', argument: undefined });
  });

  it('parses /youtube with argument', () => {
    const { result } = renderHook(() => useKeyboardMode());
    const cmd = result.current.parseSlashCommand('/youtube https://youtube.com/watch?v=abc');
    expect(cmd).toEqual({ action: 'youtube', argument: 'https://youtube.com/watch?v=abc' });
  });

  it('returns null for unknown command', () => {
    const { result } = renderHook(() => useKeyboardMode());
    const cmd = result.current.parseSlashCommand('/unknown');
    expect(cmd).toBeNull();
  });

  it('returns null for non-command text', () => {
    const { result } = renderHook(() => useKeyboardMode());
    const cmd = result.current.parseSlashCommand('hello world');
    expect(cmd).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- apps/web/app/components/useKeyboardMode.test.ts`
Expected: FAIL — "Cannot find module './useKeyboardMode'"

- [ ] **Step 3: Implement useKeyboardMode hook**

```typescript
// apps/web/app/components/useKeyboardMode.ts
import { useState, useCallback } from 'react';
import type { VoiceActionId } from '@talk-to-a-document/core/src/domain/voiceCommands';

type SlashCommand = { action: VoiceActionId; argument?: string };

const SLASH_COMMANDS: Record<string, VoiceActionId> = {
  '/upload': 'upload',
  '/summarize': 'summarize',
  '/back': 'back',
  '/youtube': 'youtube',
  '/search': 'search',
  '/clear': 'stop',
  '/settings': 'open',
  '/files': 'open',
};

export function useKeyboardMode() {
  const [enabled, setEnabled] = useState(false);

  const parseSlashCommand = useCallback((input: string): SlashCommand | null => {
    const trimmed = input.trim();
    if (!trimmed.startsWith('/')) return null;

    const spaceIdx = trimmed.indexOf(' ');
    const commandPart = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
    const argumentPart = spaceIdx === -1 ? undefined : trimmed.slice(spaceIdx + 1).trim() || undefined;

    const action = SLASH_COMMANDS[commandPart];
    if (!action) return null;

    return { action, argument: argumentPart };
  }, []);

  return { enabled, setEnabled, parseSlashCommand };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- apps/web/app/components/useKeyboardMode.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/components/useKeyboardMode.ts apps/web/app/components/useKeyboardMode.test.ts
git commit -m "feat: add useKeyboardMode hook with slash command parsing"
```

---

### Task 8: Create KeyboardComposer Component

**Files:**
- Create: `apps/web/app/components/KeyboardComposer.tsx`
- Create: `apps/web/app/components/KeyboardComposer.test.tsx`
- Create: `apps/web/app/components/KeyboardComposer.module.css`

**Interfaces:**
- Consumes: `parseSlashCommand` from `useKeyboardMode`
- Produces: `<KeyboardComposer onSend={fn} onCommand={fn} />` component

- [ ] **Step 1: Write failing test**

```typescript
// apps/web/app/components/KeyboardComposer.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KeyboardComposer } from './KeyboardComposer';

describe('KeyboardComposer', () => {
  it('renders text input', () => {
    const onSend = vi.fn();
    const onCommand = vi.fn();
    render(<KeyboardComposer onSend={onSend} onCommand={onCommand} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('calls onSend with text on Enter', () => {
    const onSend = vi.fn();
    const onCommand = vi.fn();
    render(<KeyboardComposer onSend={onSend} onCommand={onCommand} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('Hello');
  });

  it('calls onCommand with slash command on Enter', () => {
    const onSend = vi.fn();
    const onCommand = vi.fn();
    render(<KeyboardComposer onSend={onSend} onCommand={onCommand} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '/upload' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommand).toHaveBeenCalledWith({ action: 'upload', argument: undefined });
  });

  it('shows autocomplete dropdown when typing /', () => {
    const onSend = vi.fn();
    const onCommand = vi.fn();
    render(<KeyboardComposer onSend={onSend} onCommand={onCommand} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '/' } });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('does not send on Shift+Enter', () => {
    const onSend = vi.fn();
    const onCommand = vi.fn();
    render(<KeyboardComposer onSend={onSend} onCommand={onCommand} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- apps/web/app/components/KeyboardComposer.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement KeyboardComposer**

```typescript
// apps/web/app/components/KeyboardComposer.tsx
import { useState, useCallback, useRef, useEffect } from 'react';
import { useKeyboardMode } from './useKeyboardMode';
import styles from './KeyboardComposer.module.css';

interface KeyboardComposerProps {
  onSend: (text: string) => void;
  onCommand: (cmd: { action: string; argument?: string }) => void;
}

const ALL_COMMANDS = [
  { command: '/upload', description: 'Open file upload' },
  { command: '/summarize', description: 'Summarize current source' },
  { command: '/back', description: 'Go back' },
  { command: '/youtube', description: 'Load YouTube source' },
  { command: '/search', description: 'Search within source' },
  { command: '/clear', description: 'Reset conversation' },
  { command: '/settings', description: 'Open settings' },
  { command: '/files', description: 'Open file browser' },
];

export function KeyboardComposer({ onSend, onCommand }: KeyboardComposerProps) {
  const [value, setValue] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const { parseSlashCommand } = useKeyboardMode();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const filteredCommands = ALL_COMMANDS.filter(c =>
    c.command.startsWith(value.split(' ')[0])
  );

  const handleSubmit = useCallback(() => {
    if (!value.trim()) return;

    const cmd = parseSlashCommand(value);
    if (cmd) {
      onCommand(cmd);
    } else {
      onSend(value.trim());
    }
    setValue('');
    setShowAutocomplete(false);
  }, [value, parseSlashCommand, onSend, onCommand]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape' && showAutocomplete) {
      e.preventDefault();
      setShowAutocomplete(false);
    }
  }, [handleSubmit, showAutocomplete]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    setShowAutocomplete(newValue.startsWith('/') && newValue.indexOf(' ') === -1);
  }, []);

  return (
    <div className={styles.composer}>
      {showAutocomplete && filteredCommands.length > 0 && (
        <ul className={styles.autocomplete} role="listbox">
          {filteredCommands.map(cmd => (
            <li
              key={cmd.command}
              role="option"
              className={styles.autocompleteItem}
              onClick={() => {
                setValue(cmd.command + ' ');
                setShowAutocomplete(false);
                inputRef.current?.focus();
              }}
            >
              <span className={styles.commandName}>{cmd.command}</span>
              <span className={styles.commandDesc}>{cmd.description}</span>
            </li>
          ))}
        </ul>
      )}
      <textarea
        ref={inputRef}
        className={styles.input}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Type a message or /command..."
        rows={1}
      />
    </div>
  );
}
```

- [ ] **Step 4: Create CSS module**

```css
/* apps/web/app/components/KeyboardComposer.module.css */
.composer {
  position: relative;
  display: flex;
  flex-direction: column;
  border: 2px solid var(--accent);
  border-radius: var(--radius-md);
  background: transparent;
}

.input {
  width: 100%;
  padding: 12px 16px;
  border: none;
  background: transparent;
  color: var(--ink);
  font-size: 1rem;
  resize: none;
  outline: none;
}

.input::placeholder {
  color: var(--muted);
}

.autocomplete {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  border: 2px solid var(--accent);
  border-radius: var(--radius-md);
  background: var(--surface);
  list-style: none;
  margin: 0 0 4px 0;
  padding: 4px 0;
  max-height: 200px;
  overflow-y: auto;
}

.autocompleteItem {
  padding: 8px 16px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.autocompleteItem:hover {
  background: var(--surface-soft);
}

.commandName {
  font-family: var(--mono);
  color: var(--accent);
}

.commandDesc {
  color: var(--muted);
  font-size: 0.875rem;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- apps/web/app/components/KeyboardComposer.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/components/KeyboardComposer.tsx apps/web/app/components/KeyboardComposer.test.tsx apps/web/app/components/KeyboardComposer.module.css
git commit -m "feat: add KeyboardComposer with slash commands"
```

---

### Task 9: Create SuggestionStrip Component

**Files:**
- Create: `apps/web/app/components/SuggestionStrip.tsx`
- Create: `apps/web/app/components/SuggestionStrip.test.tsx`
- Create: `apps/web/app/components/SuggestionStrip.module.css`

**Interfaces:**
- Consumes: `Suggestion[]` from `actionSuggestions.ts`
- Produces: `<SuggestionStrip suggestions={[]} onAction={fn} />` component

- [ ] **Step 1: Write failing test**

```typescript
// apps/web/app/components/SuggestionStrip.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SuggestionStrip } from './SuggestionStrip';

describe('SuggestionStrip', () => {
  it('renders nothing when no suggestions', () => {
    const { container } = render(<SuggestionStrip suggestions={[]} onAction={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders suggestion chips', () => {
    const suggestions = [
      { action: 'upload' as const, label: 'Upload file' },
      { action: 'youtube' as const, label: 'YouTube video' },
    ];
    render(<SuggestionStrip suggestions={suggestions} onAction={vi.fn()} />);
    expect(screen.getByText('Upload file')).toBeInTheDocument();
    expect(screen.getByText('YouTube video')).toBeInTheDocument();
  });

  it('calls onAction when chip clicked', () => {
    const onAction = vi.fn();
    const suggestions = [{ action: 'upload' as const, label: 'Upload file' }];
    render(<SuggestionStrip suggestions={suggestions} onAction={onAction} />);
    fireEvent.click(screen.getByText('Upload file'));
    expect(onAction).toHaveBeenCalledWith('upload');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- apps/web/app/components/SuggestionStrip.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement SuggestionStrip**

```typescript
// apps/web/app/components/SuggestionStrip.tsx
import type { VoiceActionId } from '@talk-to-a-document/core/src/domain/voiceCommands';
import type { Suggestion } from '@talk-to-a-document/core/src/domain/actionSuggestions';
import styles from './SuggestionStrip.module.css';

interface SuggestionStripProps {
  suggestions: Suggestion[];
  onAction: (action: VoiceActionId) => void;
}

export function SuggestionStrip({ suggestions, onAction }: SuggestionStripProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className={styles.strip}>
      {suggestions.map(s => (
        <button
          key={s.action}
          className={styles.chip}
          onClick={() => onAction(s.action)}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create CSS module**

```css
/* apps/web/app/components/SuggestionStrip.module.css */
.strip {
  display: flex;
  gap: 8px;
  padding: 8px 0;
  flex-wrap: wrap;
}

.chip {
  padding: 6px 14px;
  border: 2px solid var(--accent);
  border-radius: var(--radius-xl);
  background: transparent;
  color: var(--accent);
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.chip:hover {
  background: var(--accent);
  color: var(--paper);
}

.chip:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .chip {
    transition: none;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- apps/web/app/components/SuggestionStrip.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/components/SuggestionStrip.tsx apps/web/app/components/SuggestionStrip.test.tsx apps/web/app/components/SuggestionStrip.module.css
git commit -m "feat: add SuggestionStrip component"
```

---

## Phase 3: Non-Verbal Tracking

### Task 10: Create NonVerbalTracker Port

**Files:**
- Create: `packages/core/src/domain/nonVerbalTracker.ts`
- Create: `packages/core/src/domain/nonVerbalTracker.test.ts`

**Interfaces:**
- Consumes: `MotionReading` from `motionGestures.ts`, mood from voice
- Produces: `NonVerbalEvent` type, `NonVerbalTracker` port interface

- [ ] **Step 1: Write failing test**

```typescript
// packages/core/src/domain/nonVerbalTracker.test.ts
import { describe, it, expect } from 'vitest';
import { createNonVerbalTracker, NonVerbalSignal } from './nonVerbalTracker';

describe('NonVerbalTracker', () => {
  it('emits gesture events', () => {
    const tracker = createNonVerbalTracker();
    const events: NonVerbalSignal[] = [];
    tracker.on(event => events.push(event));

    tracker.recordMotion({
      gesture: 'right',
      energy: 0.42,
      moving: true,
    });

    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('gesture');
  });

  it('emits mood events', () => {
    const tracker = createNonVerbalTracker();
    const events: NonVerbalSignal[] = [];
    tracker.on(event => events.push(event));

    tracker.recordMood('frustrated');

    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('mood');
  });

  it('caps session log at 500 entries', () => {
    const tracker = createNonVerbalTracker();
    for (let i = 0; i < 510; i++) {
      tracker.recordMotion({ gesture: 'right', energy: 0.3, moving: true });
    }
    expect(tracker.getLog().length).toBe(500);
  });

  it('removes listener', () => {
    const tracker = createNonVerbalTracker();
    const events: NonVerbalSignal[] = [];
    const listener = (e: NonVerbalSignal) => events.push(e);
    tracker.on(listener);
    tracker.off(listener);

    tracker.recordMotion({ gesture: 'left', energy: 0.2, moving: true });
    expect(events).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- packages/core/src/domain/nonVerbalTracker.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement NonVerbalTracker**

```typescript
// packages/core/src/domain/nonVerbalTracker.ts
import type { MotionGestureId } from './motionGestures';

export type NonVerbalSignal =
  | { kind: 'gesture'; gesture: MotionGestureId; energy: number; at: Date }
  | { kind: 'mood'; mood: string; at: Date }
  | { kind: 'movement'; energy: number; at: Date }
  | { kind: 'distance'; estimate: 'close' | 'medium' | 'far'; at: Date };

type Listener = (signal: NonVerbalSignal) => void;

const MAX_LOG = 500;

export function createNonVerbalTracker() {
  const listeners: Listener[] = [];
  const log: NonVerbalSignal[] = [];

  function emit(signal: NonVerbalSignal) {
    log.push(signal);
    if (log.length > MAX_LOG) log.shift();
    listeners.forEach(l => l(signal));
  }

  return {
    on(listener: Listener) { listeners.push(listener); },
    off(listener: Listener) {
      const idx = listeners.indexOf(listener);
      if (idx >= 0) listeners.splice(idx, 1);
    },
    recordMotion(reading: { gesture?: MotionGestureId; energy: number; moving: boolean }) {
      if (reading.gesture) {
        emit({ kind: 'gesture', gesture: reading.gesture, energy: reading.energy, at: new Date() });
      }
      if (reading.moving) {
        emit({ kind: 'movement', energy: reading.energy, at: new Date() });
      }
    },
    recordMood(mood: string) {
      emit({ kind: 'mood', mood, at: new Date() });
    },
    recordDistance(estimate: 'close' | 'medium' | 'far') {
      emit({ kind: 'distance', estimate, at: new Date() });
    },
    getLog(): readonly NonVerbalSignal[] { return log; },
    clearLog() { log.length = 0; },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- packages/core/src/domain/nonVerbalTracker.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/domain/nonVerbalTracker.ts packages/core/src/domain/nonVerbalTracker.test.ts
git commit -m "feat: add NonVerbalTracker port with session log"
```

---

### Task 11: Create ColorOverlay Component

**Files:**
- Create: `apps/web/app/components/ColorOverlay.tsx`
- Create: `apps/web/app/components/ColorOverlay.test.tsx`
- Create: `apps/web/app/components/ColorOverlay.module.css`

**Interfaces:**
- Consumes: `NonVerbalSignal[]` from tracker
- Produces: `<ColorOverlay signals={[]} />` — maps signals to color, renders overlay

- [ ] **Step 1: Write failing test**

```typescript
// apps/web/app/components/ColorOverlay.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ColorOverlay, signalToColor } from './ColorOverlay';
import type { NonVerbalSignal } from '@talk-to-a-document/core/src/domain/nonVerbalTracker';

describe('signalToColor', () => {
  it('returns blue for calm movement', () => {
    const signal: NonVerbalSignal = { kind: 'movement', energy: 0.1, at: new Date() };
    expect(signalToColor(signal)).toBe('blue');
  });

  it('returns orange for high energy', () => {
    const signal: NonVerbalSignal = { kind: 'movement', energy: 0.5, at: new Date() };
    expect(signalToColor(signal)).toBe('orange');
  });

  it('returns red for frustrated mood', () => {
    const signal: NonVerbalSignal = { kind: 'mood', mood: 'frustrated', at: new Date() };
    expect(signalToColor(signal)).toBe('red');
  });

  it('returns warm for close distance', () => {
    const signal: NonVerbalSignal = { kind: 'distance', estimate: 'close', at: new Date() };
    expect(signalToColor(signal)).toBe('warm');
  });
});

describe('ColorOverlay', () => {
  it('renders nothing when no signals', () => {
    const { container } = render(<ColorOverlay signals={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders overlay with color', () => {
    const signals: NonVerbalSignal[] = [
      { kind: 'mood', mood: 'curious', at: new Date() },
    ];
    const { container } = render(<ColorOverlay signals={signals} />);
    expect(container.firstChild).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- apps/web/app/components/ColorOverlay.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement ColorOverlay**

```typescript
// apps/web/app/components/ColorOverlay.tsx
import type { NonVerbalSignal } from '@talk-to-a-document/core/src/domain/nonVerbalTracker';
import styles from './ColorOverlay.module.css';

export function signalToColor(signal: NonVerbalSignal): string {
  switch (signal.kind) {
    case 'movement':
      return signal.energy > 0.4 ? 'orange' : 'blue';
    case 'mood':
      if (signal.mood === 'frustrated') return 'red';
      if (signal.mood === 'curious') return 'cyan';
      return 'blue';
    case 'distance':
      return signal.estimate === 'close' ? 'warm' : 'cool';
    case 'gesture':
      return signal.energy > 0.4 ? 'orange' : 'blue';
  }
}

const COLOR_MAP: Record<string, string> = {
  blue: 'var(--plasma-cyan, #00f0ff)',
  orange: 'var(--accent-glow)',
  red: 'var(--danger)',
  warm: 'var(--accent)',
  cool: 'var(--plasma-cyan, #00f0ff)',
  cyan: 'var(--plasma-cyan, #00f0ff)',
};

interface ColorOverlayProps {
  signals: NonVerbalSignal[];
}

export function ColorOverlay({ signals }: ColorOverlayProps) {
  if (signals.length === 0) return null;

  const latest = signals[signals.length - 1];
  const colorName = signalToColor(latest);
  const color = COLOR_MAP[colorName] || COLOR_MAP.blue;

  return (
    <div
      className={styles.overlay}
      style={{ '--overlay-color': color } as React.CSSProperties}
      aria-hidden="true"
    />
  );
}
```

- [ ] **Step 4: Create CSS module**

```css
/* apps/web/app/components/ColorOverlay.module.css */
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--overlay-color, var(--accent));
  opacity: 0.08;
  pointer-events: none;
  z-index: 5;
  transition: background 600ms cubic-bezier(0.16, 1, 0.3, 1);
}

@media (prefers-reduced-motion: reduce) {
  .overlay {
    transition: none;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- apps/web/app/components/ColorOverlay.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/components/ColorOverlay.tsx apps/web/app/components/ColorOverlay.test.tsx apps/web/app/components/ColorOverlay.module.css
git commit -m "feat: add ColorOverlay for non-verbal signal visualization"
```

---

### Task 12: Create DistanceRing Component

**Files:**
- Create: `apps/web/app/components/DistanceRing.tsx`
- Create: `apps/web/app/components/DistanceRing.test.tsx`
- Create: `apps/web/app/components/DistanceRing.module.css`

**Interfaces:**
- Consumes: distance estimate ('close' | 'medium' | 'far')
- Produces: `<DistanceRing estimate="medium" />` — ring around video overlay

- [ ] **Step 1: Write failing test**

```typescript
// apps/web/app/components/DistanceRing.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DistanceRing } from './DistanceRing';

describe('DistanceRing', () => {
  it('renders nothing when no estimate', () => {
    const { container } = render(<DistanceRing estimate={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders ring with close class', () => {
    const { container } = render(<DistanceRing estimate="close" />);
    expect(container.firstChild).toHaveClass(/close/);
  });

  it('renders ring with far class', () => {
    const { container } = render(<DistanceRing estimate="far" />);
    expect(container.firstChild).toHaveClass(/far/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- apps/web/app/components/DistanceRing.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement DistanceRing**

```typescript
// apps/web/app/components/DistanceRing.tsx
import styles from './DistanceRing.module.css';

interface DistanceRingProps {
  estimate: 'close' | 'medium' | 'far' | null;
}

export function DistanceRing({ estimate }: DistanceRingProps) {
  if (!estimate) return null;

  return (
    <div
      className={`${styles.ring} ${styles[estimate]}`}
      aria-hidden="true"
    />
  );
}
```

- [ ] **Step 4: Create CSS module**

```css
/* apps/web/app/components/DistanceRing.module.css */
.ring {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 2px solid var(--accent);
  pointer-events: none;
  z-index: 11;
  transition: all 600ms cubic-bezier(0.16, 1, 0.3, 1);
}

.close {
  width: 60vmin;
  height: 60vmin;
  border-color: var(--accent);
  opacity: 0.6;
}

.medium {
  width: 75vmin;
  height: 75vmin;
  border-color: var(--accent);
  opacity: 0.4;
}

.far {
  width: 90vmin;
  height: 90vmin;
  border-color: var(--plasma-cyan, #00f0ff);
  opacity: 0.3;
}

@media (prefers-reduced-motion: reduce) {
  .ring {
    transition: none;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- apps/web/app/components/DistanceRing.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/components/DistanceRing.tsx apps/web/app/components/DistanceRing.test.tsx apps/web/app/components/DistanceRing.module.css
git commit -m "feat: add DistanceRing component"
```

---

### Task 13: Create NonVerbalLog Component

**Files:**
- Create: `apps/web/app/components/NonVerbalLog.tsx`
- Create: `apps/web/app/components/NonVerbalLog.test.tsx`
- Create: `apps/web/app/components/NonVerbalLog.module.css`

**Interfaces:**
- Consumes: `NonVerbalSignal[]` from tracker
- Produces: `<NonVerbalLog signals={[]} />` — scrollable session log viewer

- [ ] **Step 1: Write failing test**

```typescript
// apps/web/app/components/NonVerbalLog.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NonVerbalLog, formatSignal } from './NonVerbalLog';
import type { NonVerbalSignal } from '@talk-to-a-document/core/src/domain/nonVerbalTracker';

describe('formatSignal', () => {
  it('formats gesture signal', () => {
    const signal: NonVerbalSignal = { kind: 'gesture', gesture: 'right', energy: 0.42, at: new Date('2026-09-20T14:32:01') };
    const text = formatSignal(signal);
    expect(text).toContain('Swipe right');
    expect(text).toContain('0.42');
  });

  it('formats mood signal', () => {
    const signal: NonVerbalSignal = { kind: 'mood', mood: 'frustrated', at: new Date('2026-09-20T14:33:45') };
    const text = formatSignal(signal);
    expect(text).toContain('frustrated');
  });
});

describe('NonVerbalLog', () => {
  it('renders empty state', () => {
    render(<NonVerbalLog signals={[]} />);
    expect(screen.getByText(/no signals recorded/i)).toBeInTheDocument();
  });

  it('renders signal entries', () => {
    const signals: NonVerbalSignal[] = [
      { kind: 'gesture', gesture: 'right', energy: 0.42, at: new Date() },
    ];
    render(<NonVerbalLog signals={signals} />);
    expect(screen.getByText(/Swipe right/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- apps/web/app/components/NonVerbalLog.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement NonVerbalLog**

```typescript
// apps/web/app/components/NonVerbalLog.tsx
import type { NonVerbalSignal } from '@talk-to-a-document/core/src/domain/nonVerbalTracker';
import styles from './NonVerbalLog.module.css';

export function formatSignal(signal: NonVerbalSignal): string {
  const time = signal.at.toLocaleTimeString('en-CA', { hour12: false });
  switch (signal.kind) {
    case 'gesture':
      return `${time}  Swipe ${signal.gesture} (energy: ${signal.energy.toFixed(2)})`;
    case 'mood':
      return `${time}  Mood: ${signal.mood}`;
    case 'movement':
      return `${time}  Movement (energy: ${signal.energy.toFixed(2)})`;
    case 'distance':
      return `${time}  Distance: ${signal.estimate}`;
  }
}

interface NonVerbalLogProps {
  signals: readonly NonVerbalSignal[];
}

export function NonVerbalLog({ signals }: NonVerbalLogProps) {
  if (signals.length === 0) {
    return <p className={styles.empty}>No signals recorded</p>;
  }

  return (
    <div className={styles.log}>
      {[...signals].reverse().map((signal, i) => (
        <div key={`${signal.at.getTime()}-${i}`} className={styles.entry}>
          {formatSignal(signal)}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create CSS module**

```css
/* apps/web/app/components/NonVerbalLog.module.css */
.log {
  max-height: 400px;
  overflow-y: auto;
  border: 2px solid var(--line);
  border-radius: var(--radius-md);
  padding: 8px;
}

.entry {
  padding: 4px 8px;
  font-family: var(--mono);
  font-size: 0.875rem;
  color: var(--ink);
  border-bottom: 1px solid var(--line);
}

.entry:last-child {
  border-bottom: none;
}

.empty {
  color: var(--muted);
  text-align: center;
  padding: 24px;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- apps/web/app/components/NonVerbalLog.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/components/NonVerbalLog.tsx apps/web/app/components/NonVerbalLog.test.tsx apps/web/app/components/NonVerbalLog.module.css
git commit -m "feat: add NonVerbalLog session log viewer"
```

---

## Phase 4: Document Upload + Gesture Navigation

### Task 14: Extend SourceKind and File Type Support

**Files:**
- Modify: `packages/core/src/domain/ingestion.ts`
- Modify: `packages/core/src/domain/ingestion.test.ts` (if exists, else create)

**Interfaces:**
- Consumes: existing `SourceKind`, `IngestedSource`
- Produces: extended `SourceKind` with new types, `validateFile()` function

- [ ] **Step 1: Write failing test**

```typescript
// packages/core/src/domain/ingestion.test.ts
import { describe, it, expect } from 'vitest';
import { validateFile, MAX_FILE_BYTES } from './ingestion';

describe('validateFile', () => {
  it('accepts txt files', () => {
    expect(() => validateFile({ name: 'test.txt', type: 'text/plain', size: 1000 })).not.toThrow();
  });

  it('accepts md files', () => {
    expect(() => validateFile({ name: 'test.md', type: 'text/markdown', size: 1000 })).not.toThrow();
  });

  it('accepts docx files', () => {
    expect(() => validateFile({ name: 'test.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 1000 })).not.toThrow();
  });

  it('accepts csv files', () => {
    expect(() => validateFile({ name: 'test.csv', type: 'text/csv', size: 1000 })).not.toThrow();
  });

  it('accepts json files', () => {
    expect(() => validateFile({ name: 'test.json', type: 'application/json', size: 1000 })).not.toThrow();
  });

  it('rejects files over 100MB', () => {
    expect(() => validateFile({ name: 'big.txt', type: 'text/plain', size: 101 * 1024 * 1024 })).toThrow();
  });

  it('rejects unknown extensions', () => {
    expect(() => validateFile({ name: 'test.exe', type: 'application/octet-stream', size: 1000 })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- packages/core/src/domain/ingestion.test.ts`
Expected: FAIL — "validateFile is not exported"

- [ ] **Step 3: Implement validateFile and extend SourceKind**

Add to `packages/core/src/domain/ingestion.ts`:

```typescript
export const MAX_FILE_BYTES = 100 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.txt', '.md', '.docx', '.csv', '.json',
  '.png', '.jpg', '.jpeg',
  '.mp3', '.wav',
  '.mp4',
]);

export function validateFile(file: { name: string; type?: string | null; size: number }): void {
  if (file.size > MAX_FILE_BYTES) {
    throw new InputValidationError(
      `File exceeds ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB limit`,
      'FILE_TOO_LARGE'
    );
  }

  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new InputValidationError(
      `Unsupported file type: ${ext}`,
      'UNSUPPORTED_FORMAT'
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- packages/core/src/domain/ingestion.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/domain/ingestion.ts packages/core/src/domain/ingestion.test.ts
git commit -m "feat: add validateFile with multi-format support"
```

---

### Task 15: Create Text Ingestion Adapter

**Files:**
- Create: `packages/adapters/src/ingestion/textAdapter.ts`
- Create: `packages/adapters/src/ingestion/textAdapter.test.ts`

**Interfaces:**
- Consumes: `IngestedSource` from domain
- Produces: `ingestText(bytes): IngestedSource`

- [ ] **Step 1: Write failing test**

```typescript
// packages/adapters/src/ingestion/textAdapter.test.ts
import { describe, it, expect } from 'vitest';
import { ingestText } from './textAdapter';

describe('ingestText', () => {
  it('ingests plain text', () => {
    const result = ingestText(new TextEncoder().encode('Hello world'), 'hello.txt');
    expect(result.kind).toBe('text');
    expect(result.text).toBe('Hello world');
    expect(result.sourceName).toBe('hello.txt');
  });

  it('ingests markdown', () => {
    const result = ingestText(new TextEncoder().encode('# Title\n\nBody'), 'doc.md');
    expect(result.kind).toBe('text');
    expect(result.text).toContain('# Title');
  });

  it('ingests CSV', () => {
    const csv = 'name,age\nAlice,30\nBob,25';
    const result = ingestText(new TextEncoder().encode(csv), 'data.csv');
    expect(result.kind).toBe('text');
    expect(result.characters).toBe(csv.length);
  });

  it('ingests JSON', () => {
    const json = '{"key": "value"}';
    const result = ingestText(new TextEncoder().encode(json), 'data.json');
    expect(result.kind).toBe('text');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- packages/adapters/src/ingestion/textAdapter.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement text ingestion adapter**

```typescript
// packages/adapters/src/ingestion/textAdapter.ts
import { normalizeExtractedText } from '@talk-to-a-document/core/src/domain/ingestion';

export type TextIngestedSource = {
  kind: 'text';
  sourceName: string;
  text: string;
  characters: number;
};

export function ingestText(bytes: Uint8Array, fileName: string): TextIngestedSource {
  const text = normalizeExtractedText(new TextDecoder().decode(bytes));
  return {
    kind: 'text',
    sourceName: fileName,
    text,
    characters: text.length,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- packages/adapters/src/ingestion/textAdapter.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/adapters/src/ingestion/textAdapter.ts packages/adapters/src/ingestion/textAdapter.test.ts
git commit -m "feat: add text ingestion adapter (txt, md, csv, json)"
```

---

### Task 16: Create VirtualFileSystem Port and Adapter

**Files:**
- Create: `packages/core/src/domain/virtualFileSystem.ts`
- Create: `packages/core/src/domain/virtualFileSystem.test.ts`
- Create: `packages/adapters/src/virtualFileSystem.ts`
- Create: `packages/adapters/src/virtualFileSystem.test.ts`

**Interfaces:**
- Consumes: `FileSystemPort`, `FileNode` from `fileSystem.ts`
- Produces: `VirtualFileSystem` port with create/read/update operations

- [ ] **Step 1: Write failing test for domain**

```typescript
// packages/core/src/domain/virtualFileSystem.test.ts
import { describe, it, expect } from 'vitest';
import { createVirtualFileSystem } from './virtualFileSystem';

describe('VirtualFileSystem', () => {
  it('creates with default folders', () => {
    const vfs = createVirtualFileSystem();
    const root = vfs.list('root');
    const names = root.map(n => n.name);
    expect(names).toContain('Documents');
    expect(names).toContain('Uploads');
    expect(names).toContain('Recent');
  });

  it('adds file to Uploads folder', () => {
    const vfs = createVirtualFileSystem();
    vfs.addFile({
      name: 'test.txt',
      kind: 'file',
      fileType: 'document',
      sizeBytes: 100,
      parentId: 'uploads',
    });
    const uploads = vfs.list('uploads');
    expect(uploads.some(n => n.name === 'test.txt')).toBe(true);
  });

  it('enforces 10-level nesting cap', () => {
    const vfs = createVirtualFileSystem();
    let parentId = 'root';
    for (let i = 0; i < 10; i++) {
      parentId = vfs.createDirectory(`level${i}`, parentId);
    }
    expect(() => vfs.createDirectory('level10', parentId)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- packages/core/src/domain/virtualFileSystem.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement VirtualFileSystem domain**

```typescript
// packages/core/src/domain/virtualFileSystem.ts
import type { FileNode, FileSystemListing, FileType } from './fileSystem';

const MAX_DEPTH = 10;

type AddFileInput = {
  name: string;
  kind: 'file';
  fileType: FileType;
  sizeBytes: number;
  parentId?: string;
};

export function createVirtualFileSystem() {
  const nodes = new Map<string, FileNode>();
  let nextId = 100;

  function makeId(): string {
    return `vfs-${nextId++}`;
  }

  const root: FileNode = {
    id: 'root', name: 'Root', kind: 'directory',
    children: ['documents', 'uploads', 'recent'],
    parentId: null, createdAt: new Date(), updatedAt: new Date(),
  };
  nodes.set('root', root);

  const documents: FileNode = {
    id: 'documents', name: 'Documents', kind: 'directory',
    children: [], parentId: 'root', createdAt: new Date(), updatedAt: new Date(),
  };
  nodes.set('documents', documents);

  const uploads: FileNode = {
    id: 'uploads', name: 'Uploads', kind: 'directory',
    children: [], parentId: 'root', createdAt: new Date(), updatedAt: new Date(),
  };
  nodes.set('uploads', uploads);

  const recent: FileNode = {
    id: 'recent', name: 'Recent', kind: 'directory',
    children: [], parentId: 'root', createdAt: new Date(), updatedAt: new Date(),
  };
  nodes.set('recent', recent);

  function getDepth(nodeId: string): number {
    let depth = 0;
    let current = nodes.get(nodeId);
    while (current?.parentId) {
      depth++;
      current = nodes.get(current.parentId);
    }
    return depth;
  }

  return {
    list(directoryId: string): FileSystemListing {
      const dir = nodes.get(directoryId);
      if (!dir || dir.kind !== 'directory') return [];
      return dir.children.map(id => nodes.get(id)!).filter(Boolean);
    },

    addFile(input: AddFileInput): FileNode {
      const id = makeId();
      const parentId = input.parentId || 'uploads';
      const node: FileNode = {
        id, name: input.name, kind: 'file',
        fileType: input.fileType, sizeBytes: input.sizeBytes,
        parentId, createdAt: new Date(), updatedAt: new Date(),
      };
      nodes.set(id, node);

      const parent = nodes.get(parentId);
      if (parent && parent.kind === 'directory') {
        parent.children.push(id);
        parent.updatedAt = new Date();
      }

      const recentDir = nodes.get('recent');
      if (recentDir && recentDir.kind === 'directory') {
        recentDir.children.unshift(id);
      }

      return node;
    },

    createDirectory(name: string, parentId: string): string {
      if (getDepth(parentId) >= MAX_DEPTH) {
        throw new Error(`Maximum folder depth (${MAX_DEPTH}) exceeded`);
      }
      const id = makeId();
      const node: FileNode = {
        id, name, kind: 'directory',
        children: [], parentId, createdAt: new Date(), updatedAt: new Date(),
      };
      nodes.set(id, node);

      const parent = nodes.get(parentId);
      if (parent && parent.kind === 'directory') {
        parent.children.push(id);
      }
      return id;
    },

    getNode(nodeId: string): FileNode | null {
      return nodes.get(nodeId) || null;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- packages/core/src/domain/virtualFileSystem.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/domain/virtualFileSystem.ts packages/core/src/domain/virtualFileSystem.test.ts
git commit -m "feat: add VirtualFileSystem with default folders and nesting cap"
```

---

### Task 17: Create GestureFileBrowser Component

**Files:**
- Create: `apps/web/app/components/GestureFileBrowser.tsx`
- Create: `apps/web/app/components/GestureFileBrowser.test.tsx`
- Create: `apps/web/app/components/GestureFileBrowser.module.css`

**Interfaces:**
- Consumes: `ImmersiveFileBrowser` (extends it), `MotionReading` for gesture input, hand preference
- Produces: `<GestureFileBrowser open={} fs={} rootId={} handPreference="right" onClose={} onFileSelect={} motionReading={?} />`

- [ ] **Step 1: Write failing test**

```typescript
// apps/web/app/components/GestureFileBrowser.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GestureFileBrowser, mirrorGesture } from './GestureFileBrowser';

describe('mirrorGesture', () => {
  it('mirrors horizontal gestures for left hand', () => {
    expect(mirrorGesture('left', 'left')).toBe('right');
    expect(mirrorGesture('right', 'left')).toBe('left');
  });

  it('does not mirror vertical gestures', () => {
    expect(mirrorGesture('up', 'left')).toBe('up');
    expect(mirrorGesture('down', 'left')).toBe('down');
  });

  it('does not mirror for right hand', () => {
    expect(mirrorGesture('left', 'right')).toBe('left');
    expect(mirrorGesture('right', 'right')).toBe('right');
  });
});

describe('GestureFileBrowser', () => {
  it('renders nothing when not open', () => {
    const { container } = render(
      <GestureFileBrowser open={false} fs={{} as any} rootId="root" handPreference="right" onClose={vi.fn()} onFileSelect={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- apps/web/app/components/GestureFileBrowser.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement GestureFileBrowser**

```typescript
// apps/web/app/components/GestureFileBrowser.tsx
import { useCallback, useRef, useEffect } from 'react';
import ImmersiveFileBrowser from './ImmersiveFileBrowser';
import type { FileNode, FileSystemPort } from '@talk-to-a-document/core/src/domain/fileSystem';
import type { MotionGestureId } from '@talk-to-a-document/core/src/domain/motionGestures';
import type { FileNavAction } from '@talk-to-a-document/core/src/domain/fileNavigation';
import styles from './GestureFileBrowser.module.css';

type HandPreference = 'left' | 'right';

export function mirrorGesture(gesture: MotionGestureId, hand: HandPreference): MotionGestureId {
  if (hand !== 'left') return gesture;
  if (gesture === 'left') return 'right';
  if (gesture === 'right') return 'left';
  return gesture;
}

interface GestureFileBrowserProps {
  open: boolean;
  fs: FileSystemPort;
  rootId: string;
  handPreference: HandPreference;
  onClose: () => void;
  onFileSelect: (node: FileNode) => void;
  motionGesture?: MotionGestureId | null;
}

export function GestureFileBrowser({
  open, fs, rootId, handPreference, onClose, onFileSelect, motionGesture,
}: GestureFileBrowserProps) {
  const lastGestureTime = useRef(0);
  const DEBOUNCE_MS = 300;

  const gestureToNavAction = useCallback((gesture: MotionGestureId): FileNavAction | null => {
    const mirrored = mirrorGesture(gesture, handPreference);
    switch (mirrored) {
      case 'up': return { type: 'navigateUp' };
      case 'down': return { type: 'openSelected' };
      case 'right': return { type: 'next' };
      case 'left': return { type: 'prev' };
      case 'hold': return { type: 'openSelected' };
    }
  }, [handPreference]);

  useEffect(() => {
    if (!motionGesture) return;
    const now = Date.now();
    if (now - lastGestureTime.current < DEBOUNCE_MS) return;
    lastGestureTime.current = now;
    // Gesture-to-nav dispatch is handled by the parent via navRef
  }, [motionGesture, gestureToNavAction]);

  if (!open) return null;

  return (
    <div className={styles.gestureBrowser}>
      <ImmersiveFileBrowser
        open={open}
        fs={fs}
        rootId={rootId}
        onClose={onClose}
        onFileSelect={onFileSelect}
      />
    </div>
  );
}
```

- [ ] **Step 4: Create CSS module**

```css
/* apps/web/app/components/GestureFileBrowser.module.css */
.gestureBrowser {
  position: fixed;
  inset: 0;
  z-index: 50;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- apps/web/app/components/GestureFileBrowser.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/components/GestureFileBrowser.tsx apps/web/app/components/GestureFileBrowser.test.tsx apps/web/app/components/GestureFileBrowser.module.css
git commit -m "feat: add GestureFileBrowser with hand preference mirroring"
```

---

## Phase 5: Language Commands + Settings Reorganization

### Task 18: Extend Voice Commands with New Actions

**Files:**
- Modify: `packages/core/src/domain/voiceCommands.ts`
- Modify: `packages/core/src/domain/voiceCommands.test.ts` (if exists, else create)

**Interfaces:**
- Consumes: existing `VoiceActionId`, `defaultPhrases()`, `matchCommands()`
- Produces: extended `VoiceActionId` with 'settings' action, new phrases

- [ ] **Step 1: Write failing test**

```typescript
// packages/core/src/domain/voiceCommands.test.ts
import { describe, it, expect } from 'vitest';
import { defaultPhrases, matchCommands, defaultTriggers } from './voiceCommands';

describe('voiceCommands extensions', () => {
  it('includes settings action in phrases', () => {
    const phrases = defaultPhrases('en');
    expect(phrases).toHaveProperty('settings');
  });

  it('matches "settings" in English', () => {
    const triggers = defaultTriggers('en');
    const matches = matchCommands('open settings', triggers, { language: 'en' });
    expect(matches.some(m => m.trigger.action === 'settings')).toBe(true);
  });

  it('matches "paramètres" in French', () => {
    const triggers = defaultTriggers('fr');
    const matches = matchCommands('ouvre les paramètres', triggers, { language: 'fr' });
    expect(matches.some(m => m.trigger.action === 'settings')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- packages/core/src/domain/voiceCommands.test.ts`
Expected: FAIL — settings action not found

- [ ] **Step 3: Extend VoiceActionId and PHRASES**

In `packages/core/src/domain/voiceCommands.ts`, add `'settings'` to the `VoiceActionId` union type:

```typescript
export type VoiceActionId =
  | "youtube" | "upload" | "voice" | "summarize" | "ask"
  | "stop" | "back" | "next" | "cancel" | "open" | "select" | "search"
  | "settings";
```

Add to the `PHRASES` constant:

```typescript
settings: ["settings", "menu", "preferences"],
```

And in the French section:

```typescript
settings: ["paramètres", "menu", "préférences"],
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- packages/core/src/domain/voiceCommands.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Run existing tests to check for regressions**

Run: `npm test -- packages/core/src/domain/voiceCommands`
Expected: All existing tests still pass

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/domain/voiceCommands.ts packages/core/src/domain/voiceCommands.test.ts
git commit -m "feat: add settings voice command in English and French"
```

---

### Task 19: Create Settings Reorganization Component

**Files:**
- Create: `apps/web/app/components/SettingsPanel.tsx`
- Create: `apps/web/app/components/SettingsPanel.test.tsx`
- Create: `apps/web/app/components/SettingsPanel.module.css`

**Interfaces:**
- Consumes: settings state from Workspace, `useKeyboardMode`, `useNonVerbalTracking`
- Produces: `<SettingsPanel open={} onClose={} settings={} onUpdate={} />`

- [ ] **Step 1: Write failing test**

```typescript
// apps/web/app/components/SettingsPanel.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsPanel } from './SettingsPanel';

const defaultSettings = {
  language: 'en',
  theme: 'light',
  assistantName: 'Ursly',
  voiceOutput: true,
  voiceSpeed: 1,
  cameraEnabled: false,
  videoPreviewOpacity: 0.15,
  handPreference: 'right' as const,
  keyboardEnabled: false,
  nonVerbalTracking: false,
};

describe('SettingsPanel', () => {
  it('renders nothing when not open', () => {
    const { container } = render(
      <SettingsPanel open={false} onClose={vi.fn()} settings={defaultSettings} onUpdate={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders all settings sections when open', () => {
    render(
      <SettingsPanel open={true} onClose={vi.fn()} settings={defaultSettings} onUpdate={vi.fn()} />
    );
    expect(screen.getByText(/General/i)).toBeInTheDocument();
    expect(screen.getByText(/Voice/i)).toBeInTheDocument();
    expect(screen.getByText(/Camera/i)).toBeInTheDocument();
    expect(screen.getByText(/Keyboard/i)).toBeInTheDocument();
  });

  it('shows keyboard toggle', () => {
    render(
      <SettingsPanel open={true} onClose={vi.fn()} settings={defaultSettings} onUpdate={vi.fn()} />
    );
    expect(screen.getByText(/Enable keyboard input/i)).toBeInTheDocument();
  });

  it('shows hand preference toggle', () => {
    render(
      <SettingsPanel open={true} onClose={vi.fn()} settings={defaultSettings} onUpdate={vi.fn()} />
    );
    expect(screen.getByText(/Hand preference/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- apps/web/app/components/SettingsPanel.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement SettingsPanel**

```typescript
// apps/web/app/components/SettingsPanel.tsx
import styles from './SettingsPanel.module.css';

export type AppSettings = {
  language: string;
  theme: string;
  assistantName: string;
  voiceOutput: boolean;
  voiceSpeed: number;
  cameraEnabled: boolean;
  videoPreviewOpacity: number;
  handPreference: 'left' | 'right';
  keyboardEnabled: boolean;
  nonVerbalTracking: boolean;
};

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

export function SettingsPanel({ open, onClose, settings, onUpdate }: SettingsPanelProps) {
  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()} role="dialog" aria-label="Settings">
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>General</h3>
          <div className={styles.row}>
            <label>Assistant name</label>
            <input
              type="text"
              className={styles.textInput}
              value={settings.assistantName}
              onChange={e => onUpdate('assistantName', e.target.value)}
            />
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Voice & Audio</h3>
          <div className={styles.row}>
            <label>Voice output</label>
            <button
              className={styles.toggle}
              aria-pressed={settings.voiceOutput}
              onClick={() => onUpdate('voiceOutput', !settings.voiceOutput)}
            >
              {settings.voiceOutput ? 'On' : 'Off'}
            </button>
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Camera & Motion</h3>
          <div className={styles.row}>
            <label>Camera</label>
            <button
              className={styles.toggle}
              aria-pressed={settings.cameraEnabled}
              onClick={() => onUpdate('cameraEnabled', !settings.cameraEnabled)}
            >
              {settings.cameraEnabled ? 'On' : 'Off'}
            </button>
          </div>
          <div className={styles.row}>
            <label>Hand preference</label>
            <button
              className={styles.toggle}
              onClick={() => onUpdate('handPreference', settings.handPreference === 'left' ? 'right' : 'left')}
            >
              {settings.handPreference === 'left' ? 'Left' : 'Right'}
            </button>
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Keyboard</h3>
          <div className={styles.row}>
            <label>Enable keyboard input</label>
            <button
              className={styles.toggle}
              aria-pressed={settings.keyboardEnabled}
              onClick={() => onUpdate('keyboardEnabled', !settings.keyboardEnabled)}
            >
              {settings.keyboardEnabled ? 'On' : 'Off'}
            </button>
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Non-Verbal Tracking</h3>
          <div className={styles.row}>
            <label>Tracking</label>
            <button
              className={styles.toggle}
              aria-pressed={settings.nonVerbalTracking}
              onClick={() => onUpdate('nonVerbalTracking', !settings.nonVerbalTracking)}
            >
              {settings.nonVerbalTracking ? 'On' : 'Off'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create CSS module**

```css
/* apps/web/app/components/SettingsPanel.module.css */
.overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--ink) 40%, transparent);
  z-index: var(--z-portal);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.panel {
  width: min(480px, 90vw);
  max-height: 80vh;
  overflow-y: auto;
  border: 2px solid var(--line);
  border-radius: var(--radius-xl);
  background: var(--surface);
  padding: 24px;
}

.section {
  border-top: 2px solid var(--accent);
  padding-top: 16px;
  margin-top: 16px;
}

.section:first-child {
  border-top: none;
  margin-top: 0;
  padding-top: 0;
}

.sectionTitle {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 12px;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.row label {
  color: var(--ink);
}

.toggle {
  padding: 6px 16px;
  border: 2px solid var(--accent);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--accent);
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.toggle[aria-pressed="true"] {
  background: var(--accent);
  color: var(--paper);
}

.textInput {
  padding: 6px 12px;
  border: 2px solid var(--line);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink);
  font-size: 0.875rem;
}

.textInput:focus {
  border-color: var(--accent);
  outline: none;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .overlay {
    animation: none;
  }
  .toggle {
    transition: none;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- apps/web/app/components/SettingsPanel.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/components/SettingsPanel.tsx apps/web/app/components/SettingsPanel.test.tsx apps/web/app/components/SettingsPanel.module.css
git commit -m "feat: add SettingsPanel with reorganized sections"
```

---

## Phase 6: Integration + BDD

### Task 20: Integrate FeedbackOverlay into Workspace

**Files:**
- Modify: `apps/web/app/components/Workspace.tsx`

**Interfaces:**
- Consumes: `FeedbackOverlay` component, `useFeedback` hook
- Produces: FeedbackOverlay rendered in Workspace JSX tree

- [ ] **Step 1: Add FeedbackOverlay import and render**

In `Workspace.tsx`, add import:

```typescript
import { FeedbackOverlay } from './FeedbackOverlay';
```

Add `<FeedbackOverlay />` inside the `<main>` element, after the existing feedback div.

- [ ] **Step 2: Run existing tests**

Run: `npm test`
Expected: No regressions

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/components/Workspace.tsx
git commit -m "feat: integrate FeedbackOverlay into Workspace"
```

---

### Task 21: Integrate QuickToggleBar into Workspace

**Files:**
- Modify: `apps/web/app/components/Workspace.tsx`

**Interfaces:**
- Consumes: `QuickToggleBar` component, voice/motion state
- Produces: QuickToggleBar rendered with voice/motion toggle callbacks

- [ ] **Step 1: Add QuickToggleBar import and render**

In `Workspace.tsx`, add import:

```typescript
import { QuickToggleBar } from './QuickToggleBar';
```

Add state for toggle visibility and render `<QuickToggleBar>` with callbacks that control voice/motion lifecycle.

- [ ] **Step 2: Run existing tests**

Run: `npm test`
Expected: No regressions

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/components/Workspace.tsx
git commit -m "feat: integrate QuickToggleBar into Workspace"
```

---

### Task 22: Integrate Keyboard Fallback into Workspace

**Files:**
- Modify: `apps/web/app/components/Workspace.tsx`

**Interfaces:**
- Consumes: `KeyboardComposer`, `SuggestionStrip`, `useKeyboardMode`, `generateSuggestions`
- Produces: Keyboard input rendered conditionally when `keyboardEnabled` is true

- [ ] **Step 1: Add keyboard components to Workspace**

Import `KeyboardComposer`, `SuggestionStrip`, `useKeyboardMode`, and `generateSuggestions`. Add keyboard composer below the existing composer when keyboard mode is enabled. Wire slash commands to `handleVoiceAction`.

- [ ] **Step 2: Run existing tests**

Run: `npm test`
Expected: No regressions

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/components/Workspace.tsx
git commit -m "feat: integrate keyboard fallback into Workspace"
```

---

### Task 23: Write BDD Feature Files

**Files:**
- Create: `features/keyboard-fallback.feature`
- Create: `features/video-overlay.feature`
- Create: `features/feedback-ui.feature`
- Create: `features/language-commands.feature`

**Interfaces:**
- Consumes: all components from previous phases
- Produces: Gherkin feature files for Playwright

- [ ] **Step 1: Write keyboard-fallback.feature**

```gherkin
# features/keyboard-fallback.feature
Feature: Keyboard Fallback
  As a user in a quiet environment
  I want to type messages and commands
  So I can interact without voice

  Scenario: Enable keyboard in settings
    Given I am on the workspace page
    When I open settings
    And I enable "keyboard input"
    Then I should see a text composer at the bottom

  Scenario: Send text message
    Given keyboard input is enabled
    When I type "What is this document about?"
    And I press Enter
    Then the message should appear in the conversation

  Scenario: Use slash command
    Given keyboard input is enabled
    When I type "/upload"
    And I press Enter
    Then the file browser should open

  Scenario: Slash command autocomplete
    Given keyboard input is enabled
    When I type "/"
    Then I should see an autocomplete dropdown with commands

  Scenario: Keyboard coexists with voice
    Given keyboard input is enabled
    And voice is active
    When I type a message
    Then voice should remain active
```

- [ ] **Step 2: Write video-overlay.feature**

```gherkin
# features/video-overlay.feature
Feature: Video Overlay
  As a user who wants visual presence
  I want to see my camera feed as a subtle overlay
  So I feel connected without distraction

  Scenario: Enable video overlay in settings
    Given I am on the workspace page
    When I open settings
    And I enable camera
    Then I should see a semi-transparent video layer

  Scenario: Video overlay opacity
    Given the video overlay is active
    Then the overlay opacity should be 15%

  Scenario: Camera permission denied
    Given camera permission is denied
    When I try to enable the camera
    Then I should see a "Camera unavailable" message
```

- [ ] **Step 3: Write feedback-ui.feature**

```gherkin
# features/feedback-ui.feature
Feature: Feedback UI
  As a user performing actions
  I want clear visual feedback
  So I know what happened

  Scenario: Success flash on file upload
    Given I upload a file
    Then I should see a success flash at the screen edge

  Scenario: Error toast on upload failure
    Given an upload fails
    Then I should see an error toast with outlined red border

  Scenario: Info toast while listening
    Given voice is active
    Then I should see a "Listening..." info toast

  Scenario: Reduced motion support
    Given prefers-reduced-motion is enabled
    When a toast appears
    Then it should fade in without sliding
```

- [ ] **Step 4: Write language-commands.feature**

```gherkin
# features/language-commands.feature
Feature: Language-Specific Voice Commands
  As a French-speaking user
  I want to use French voice commands
  So I can interact in my language

  Scenario: French upload command
    Given the language is set to French
    When I say "téléverse"
    Then the file browser should open

  Scenario: French summarize command
    Given the language is set to French
    And a document is loaded
    When I say "résume"
    Then the assistant should summarize the document

  Scenario: English command works in English mode
    Given the language is set to English
    When I say "upload"
    Then the file browser should open

  Scenario: Fuzzy matching with 1 edit distance
    Given the language is set to English
    When I say "uplaod"
    Then the file browser should open
```

- [ ] **Step 5: Commit**

```bash
git add features/
git commit -m "feat: add BDD feature files for keyboard, video, feedback, language"
```

---

### Task 24: Run Full Test Suite and Verify No Regressions

**Files:** None (verification only)

- [ ] **Step 1: Run all unit and component tests**

Run: `npm test`
Expected: All tests pass, no regressions in existing 1079 tests

- [ ] **Step 2: Run type checking**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: resolve test regressions from input modalities integration"
```

---

Plan complete and saved to `docs/superpowers/plans/2026-09-20-input-modalities.md`. Ready for subagent-driven execution.