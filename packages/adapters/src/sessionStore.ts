import type {
  ConversationTurn,
  SessionStorePort,
  SourceSession,
} from "../../core/src/application/ports";
import type { IngestedSource } from "../../core/src/domain/ingestion";
import {
  createObjectSessionStore,
  createS3SessionObjects,
} from "./objectSessionStore";

export type MemorySessionStoreOptions = {
  /** How long an idle conversation is kept, in milliseconds. */
  ttlMs?: number;
  /** Upper bound on concurrent conversations, oldest evicted first. */
  maxSessions?: number;
  /** Upper bound on the stored text, in bytes, oldest evicted first. */
  maxBytes?: number;
  /** Exchanges kept per conversation so follow-up questions stay coherent. */
  maxTurns?: number;
  now?: () => number;
  createId?: () => string;
};

const DEFAULTS = {
  ttlMs: 60 * 60 * 1000,
  maxSessions: 200,
  maxTurns: 12,
  maxBytes: 64 * 1024 * 1024,
};

/**
 * Strings are charged at two bytes per UTF-16 code unit, the worst case the V8
 * heap holds for one. A latin1 source is stored at one byte per unit, so the
 * charge is an upper bound on the string memory rather than a measurement of
 * it. Only the unbounded text is counted: the source name is capped at 255
 * characters by request validation and cannot move this budget.
 */
const BYTES_PER_CODE_UNIT = 2;

/**
 * In-memory session storage, which the assessment names as sufficient. Entries
 * expire so a long-running server never accumulates document text, and the map
 * is capped so one visitor cannot exhaust memory. A deployment that runs several
 * instances relies on the client's rehydration fallback; swapping this adapter
 * for a shared store is the only change a stateful deployment needs.
 *
 * The count cap alone is not a memory bound: a session may carry a source of
 * any size the request body allowed, so a few hundred large ones are enough to
 * end the process that also serves every page. Total stored bytes are therefore
 * bounded as well, oldest evicted first.
 */
export function createMemorySessionStore(
  options: MemorySessionStoreOptions = {},
): SessionStorePort {
  const ttlMs = options.ttlMs ?? DEFAULTS.ttlMs;
  const maxSessions = options.maxSessions ?? DEFAULTS.maxSessions;
  const maxTurns = options.maxTurns ?? DEFAULTS.maxTurns;
  const maxBytes = options.maxBytes ?? DEFAULTS.maxBytes;
  const now = options.now ?? (() => Date.now());
  const createId = options.createId ?? (() => crypto.randomUUID());
  const sessions = new Map<string, SourceSession>();

  function evictExpired(): void {
    const moment = now();
    for (const [id, session] of sessions)
      if (session.expiresAt <= moment) sessions.delete(id);
  }

  const sessionBytes = (session: SourceSession): number =>
    (session.source.text.length +
      session.turns.reduce((total, turn) => total + turn.text.length, 0)) *
    BYTES_PER_CODE_UNIT;

  const storedBytes = (): number => {
    let total = 0;
    for (const session of sessions.values()) total += sessionBytes(session);
    return total;
  };

  /**
   * Drops the oldest conversations until both bounds hold. The most recent one
   * is never dropped: a single source larger than the whole budget is kept until
   * the next conversation needs the room, because refusing it outright would
   * break ingestion of exactly the documents the product exists to read.
   */
  function evictToBounds(): void {
    while (
      sessions.size > 1 &&
      (sessions.size > maxSessions || storedBytes() > maxBytes)
    ) {
      const oldest = sessions.keys().next().value;
      if (oldest === undefined) break;
      sessions.delete(oldest);
    }
  }

  return {
    async open(source: IngestedSource): Promise<SourceSession> {
      evictExpired();
      const session: SourceSession = {
        id: createId(),
        source,
        turns: [],
        expiresAt: now() + ttlMs,
      };
      sessions.set(session.id, session);
      // Map iteration is insertion-ordered, so the first key is the oldest.
      evictToBounds();
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
      // Turns grow a session after it was admitted, so the bound is re-applied.
      evictToBounds();
    },
  };
}

/**
 * The store this deployment should use. A single process keeps conversations in
 * memory; a deployment whose HTTP API and live channel are separate functions
 * names a bucket, and both reach the same conversation through it.
 */
export function createConfiguredSessionStore(): SessionStorePort {
  const ttlMs = Number(process.env.SESSION_TTL_MS ?? DEFAULTS.ttlMs);
  const bucket = process.env.SESSION_BUCKET;
  return bucket
    ? createObjectSessionStore(createS3SessionObjects(bucket), {
        ttlMs,
        prefix: process.env.SESSION_PREFIX ?? undefined,
      })
    : createMemorySessionStore({ ttlMs });
}
