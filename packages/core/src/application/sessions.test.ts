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

let storeInstance = 0;
function fakeStore(seed?: SourceSession): SessionStorePort {
  const tag = ++storeInstance;
  const sessions = new Map<string, SourceSession>();
  if (seed) sessions.set(seed.id, seed);
  let counter = 0;
  return {
    async open(next) {
      const session: SourceSession = {
        id: `s${tag}-${++counter}`,
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

  /**
   * Edge cases: what happens when the world moves under the session.
   * A session can expire mid-conversation, a reader can send many turns, and
   * two calls can land at the same time. The sessions layer must stay honest
   * in every one of these situations.
   */

  it("rehydrates when a session expires mid-conversation and the client still holds the source", async () => {
    // Build a store whose sessions the test can evict, simulating a server
    // that has forgotten the session (a scale-to-zero cold start, a TTL).
    const held = new Map<string, SourceSession>();
    let counter = 0;
    const evictableStore: SessionStorePort = {
      async open(next) {
        const session: SourceSession = {
          id: `session-${++counter}`,
          source: next,
          turns: [],
          expiresAt: 1,
        };
        held.set(session.id, session);
        return session;
      },
      async read(id) {
        return held.get(id);
      },
      async appendTurns(id, turns) {
        const session = held.get(id);
        if (session) session.turns.push(...turns);
      },
    };
    const api = createSessions(evictableStore);
    const lost = await api.open(source);
    // The server forgets the session.
    held.delete(lost.id);
    // Reading by id alone fails, but with the source the session is rebuilt.
    const rebuilt = await api.resolve({ sourceId: lost.id, source });
    expect(rebuilt.source.text).toBe(source.text);
    // The rebuilt session gets a fresh id, not the expired one.
    expect(rebuilt.id).not.toBe(lost.id);
  });

  it("silently accepts turns recorded against a session the store no longer holds", async () => {
    const store = fakeStore();
    const sessions = createSessions(store);
    const opened = await sessions.open(source);
    // The fake store silently ignores unknown ids in appendTurns, mirroring
    // the graceful degradation the real store must offer: a dropped session
    // does not crash the client that is still trying to record a turn.
    await expect(
      sessions.record("non-existent-id", [{ role: "user", text: "hello?" }]),
    ).resolves.toBeUndefined();
  });

  it("appends many turns without losing or reordering them", async () => {
    const store = fakeStore();
    const sessions = createSessions(store);
    const opened = await sessions.open(source);
    const turns = Array.from({ length: 200 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      text: `turn-${i}`,
    }));
    await sessions.record(opened.id, turns);
    const session = await store.read(opened.id);
    expect(session!.turns).toHaveLength(200);
    expect(session!.turns[0]!.text).toBe("turn-0");
    expect(session!.turns[199]!.text).toBe("turn-199");
  });

  it("opens and resolves concurrently without corrupting either result", async () => {
    const store = fakeStore();
    const sessions = createSessions(store);
    // Two opens and a resolve land at the same time. Each open creates its
    // own session, and the resolve finds the first one by id.
    const [first, second] = await Promise.all([
      sessions.open(source),
      sessions.open({ ...source, sourceName: "other.pdf" }),
    ]);
    const resolved = await sessions.resolve({ sourceId: first.id });
    expect(resolved.id).toBe(first.id);
    expect(resolved.source.sourceName).toBe("guide.pdf");
    // The second session is independent, not merged with the first.
    const resolvedSecond = await sessions.resolve({ sourceId: second.id });
    expect(resolvedSecond.id).toBe(second.id);
    expect(resolvedSecond.source.sourceName).toBe("other.pdf");
  });

  it("refuses to resolve a blank source even when the id is unknown", async () => {
    const sessions = createSessions(fakeStore());
    await expect(
      sessions.resolve({ sourceId: "gone", source: { ...source, text: "" } }),
    ).rejects.toBeInstanceOf(InputValidationError);
  });

  it("refuses to resolve a whitespace-only source when the id is unknown", async () => {
    const sessions = createSessions(fakeStore());
    await expect(
      sessions.resolve({
        sourceId: "gone",
        source: { ...source, text: "   \n  " },
      }),
    ).rejects.toBeInstanceOf(InputValidationError);
  });

  it("gives each opened session a unique id", async () => {
    const store = fakeStore();
    const sessions = createSessions(store);
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const session = await sessions.open(source);
      ids.add(session.id);
    }
    expect(ids.size).toBe(50);
  });

  it("preserves existing turns when more are appended", async () => {
    const store = fakeStore();
    const sessions = createSessions(store);
    const opened = await sessions.open(source);
    await sessions.record(opened.id, [{ role: "user", text: "first" }]);
    await sessions.record(opened.id, [{ role: "assistant", text: "second" }]);
    const session = await store.read(opened.id);
    expect(session!.turns).toHaveLength(2);
    expect(session!.turns[0]!.text).toBe("first");
    expect(session!.turns[1]!.text).toBe("second");
  });
});
