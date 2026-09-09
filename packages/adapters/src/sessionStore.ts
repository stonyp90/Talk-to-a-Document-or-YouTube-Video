import type {
  ConversationTurn,
  SessionStorePort,
  SourceSession,
} from "../../core/src/application/ports";
import type { IngestedSource } from "../../core/src/domain/ingestion";

export type MemorySessionStoreOptions = {
  /** How long an idle conversation is kept, in milliseconds. */
  ttlMs?: number;
  /** Upper bound on concurrent conversations, oldest evicted first. */
  maxSessions?: number;
  /** Exchanges kept per conversation so follow-up questions stay coherent. */
  maxTurns?: number;
  now?: () => number;
  createId?: () => string;
};

const DEFAULTS = { ttlMs: 60 * 60 * 1000, maxSessions: 200, maxTurns: 12 };

/**
 * In-memory session storage, which the assessment names as sufficient. Entries
 * expire so a long-running server never accumulates document text, and the map
 * is capped so one visitor cannot exhaust memory. A deployment that runs several
 * instances relies on the client's rehydration fallback; swapping this adapter
 * for a shared store is the only change a stateful deployment needs.
 */
export function createMemorySessionStore(
  options: MemorySessionStoreOptions = {},
): SessionStorePort {
  const ttlMs = options.ttlMs ?? DEFAULTS.ttlMs;
  const maxSessions = options.maxSessions ?? DEFAULTS.maxSessions;
  const maxTurns = options.maxTurns ?? DEFAULTS.maxTurns;
  const now = options.now ?? (() => Date.now());
  const createId = options.createId ?? (() => crypto.randomUUID());
  const sessions = new Map<string, SourceSession>();

  function evictExpired(): void {
    const moment = now();
    for (const [id, session] of sessions)
      if (session.expiresAt <= moment) sessions.delete(id);
  }

  return {
    async open(source: IngestedSource): Promise<SourceSession> {
      evictExpired();
      // Map iteration is insertion-ordered, so the first key is the oldest.
      while (sessions.size >= maxSessions) {
        const oldest = sessions.keys().next().value;
        if (oldest === undefined) break;
        sessions.delete(oldest);
      }
      const session: SourceSession = {
        id: createId(),
        source,
        turns: [],
        expiresAt: now() + ttlMs,
      };
      sessions.set(session.id, session);
      return session;
    },

    async read(id: string): Promise<SourceSession | undefined> {
      evictExpired();
      const session = sessions.get(id);
      if (!session) return undefined;
      // Reading keeps a live conversation alive and refreshes its eviction order.
      session.expiresAt = now() + ttlMs;
      sessions.delete(id);
      sessions.set(id, session);
      return session;
    },

    async appendTurns(id: string, turns: ConversationTurn[]): Promise<void> {
      const session = sessions.get(id);
      if (!session) return;
      session.turns = [...session.turns, ...turns].slice(-maxTurns);
      session.expiresAt = now() + ttlMs;
    },
  };
}
