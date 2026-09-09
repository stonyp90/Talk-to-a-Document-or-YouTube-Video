import { describe, expect, it } from "vitest";
import { SessionExpiredError, createSessions } from "./sessions";
import { InputValidationError, type IngestedSource } from "../domain/ingestion";
import type { SessionStorePort, SourceSession } from "./ports";

const source: IngestedSource = {
  kind: "pdf",
  sourceName: "guide.pdf",
  text: "The answer is 42.",
  characters: 17,
};

function fakeStore(seed?: SourceSession): SessionStorePort {
  const sessions = new Map<string, SourceSession>();
  if (seed) sessions.set(seed.id, seed);
  let counter = 0;
  return {
    async open(next) {
      const session: SourceSession = {
        id: `session-${++counter}`,
        source: next,
        turns: [],
        expiresAt: 1,
      };
      sessions.set(session.id, session);
      return session;
    },
    async read(id) {
      return sessions.get(id);
    },
    async appendTurns(id, turns) {
      const session = sessions.get(id);
      if (session) session.turns.push(...turns);
    },
  };
}

describe("source sessions", () => {
  it("resolves a known id without the client resending the text", async () => {
    const store = fakeStore();
    const sessions = createSessions(store);
    const opened = await sessions.open(source);
    const resolved = await sessions.resolve({ sourceId: opened.id });
    expect(resolved.source.text).toBe("The answer is 42.");
  });

  it("rehydrates a forgotten session from the source the client still holds", async () => {
    const sessions = createSessions(fakeStore());
    const resolved = await sessions.resolve({ sourceId: "gone", source });
    expect(resolved.id).not.toBe("gone");
    expect(resolved.source.text).toBe("The answer is 42.");
  });

  it("reports an expired session when the client has nothing to resend", async () => {
    const sessions = createSessions(fakeStore());
    await expect(sessions.resolve({ sourceId: "gone" })).rejects.toBeInstanceOf(
      SessionExpiredError,
    );
  });

  it("refuses a reference with neither an id nor a source", async () => {
    const sessions = createSessions(fakeStore());
    await expect(sessions.resolve({})).rejects.toBeInstanceOf(
      InputValidationError,
    );
  });

  it("records exchanges against the session", async () => {
    const store = fakeStore();
    const sessions = createSessions(store);
    const opened = await sessions.open(source);
    await sessions.record(opened.id, [{ role: "user", text: "why?" }]);
    expect((await store.read(opened.id))?.turns).toHaveLength(1);
  });
});
