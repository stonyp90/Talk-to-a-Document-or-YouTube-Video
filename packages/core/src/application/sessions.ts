import { InputValidationError, type IngestedSource } from "../domain/ingestion";
import type { ConversationTurn, SessionStorePort, SourceSession } from "./ports";

/** A client reference to a source: an opaque id, with the extraction as a fallback. */
export type SourceReference = { sourceId?: string; source?: IngestedSource };

export class SessionExpiredError extends Error {
  readonly code = "SOURCE_EXPIRED";
  constructor() {
    super("This source is no longer held on the server. Send it again.");
    this.name = "SessionExpiredError";
  }
}

export function createSessions(store: SessionStorePort) {
  return {
    open: (source: IngestedSource) => store.open(source),

    /**
     * Resolves whatever the client sent. An id is authoritative; a full source
     * is accepted as a rehydration path so a conversation survives a server that
     * has forgotten the session, which happens on any horizontally scaled or
     * scale-to-zero runtime.
     */
    async resolve(reference: SourceReference): Promise<SourceSession> {
      if (reference.sourceId) {
        const session = await store.read(reference.sourceId);
        if (session) return session;
        if (!reference.source) throw new SessionExpiredError();
      }
      if (!reference.source?.text?.trim())
        throw new InputValidationError(
          "A source is required.",
          "SOURCE_REQUIRED",
        );
      return store.open(reference.source);
    },

    async record(id: string, turns: ConversationTurn[]): Promise<void> {
      await store.appendTurns(id, turns);
    },
  };
}
