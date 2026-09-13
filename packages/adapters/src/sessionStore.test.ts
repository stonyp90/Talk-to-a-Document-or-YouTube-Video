import { describe, expect, it } from "vitest";
import { createMemorySessionStore } from "./sessionStore";
import type { IngestedSource } from "../../core/src/domain/ingestion";

const source = (text = "body"): IngestedSource => ({
  kind: "pdf",
  sourceName: "guide.pdf",
  text,
  characters: text.length,
});

/** The store charges two bytes per UTF-16 code unit; see sessionStore.ts. */
const CODE_UNIT_BYTES = 2;

describe("memory session store", () => {
  it("returns the stored source for its id", async () => {
    const store = createMemorySessionStore();
    const opened = await store.open(source("The answer is 42."));
    const read = await store.read(opened.id);
    expect(read?.source.text).toBe("The answer is 42.");
  });

  it("forgets a session once its lifetime elapses", async () => {
    let clock = 0;
    const store = createMemorySessionStore({ ttlMs: 100, now: () => clock });
    const opened = await store.open(source());
    clock = 101;
    expect(await store.read(opened.id)).toBeUndefined();
  });

  it("keeps a session alive while it is in use", async () => {
    let clock = 0;
    const store = createMemorySessionStore({ ttlMs: 100, now: () => clock });
    const opened = await store.open(source());
    clock = 80;
    expect(await store.read(opened.id)).toBeDefined();
    clock = 150;
    expect(await store.read(opened.id)).toBeDefined();
  });

  it("evicts the oldest conversation once the cap is reached", async () => {
    const store = createMemorySessionStore({ maxSessions: 2 });
    const first = await store.open(source("first"));
    await store.open(source("second"));
    await store.open(source("third"));
    expect(await store.read(first.id)).toBeUndefined();
  });

  it("keeps only the most recent exchanges", async () => {
    const store = createMemorySessionStore({ maxTurns: 2 });
    const opened = await store.open(source());
    await store.appendTurns(opened.id, [
      { role: "user", text: "one" },
      { role: "assistant", text: "two" },
      { role: "user", text: "three" },
    ]);
    const read = await store.read(opened.id);
    expect(read?.turns.map((turn) => turn.text)).toEqual(["two", "three"]);
  });

  it("evicts the oldest conversation once the stored bytes exceed the budget", async () => {
    // maxSessions is deliberately far above the number opened, so only the byte
    // bound can evict anything here: delete the bound and this case fails.
    const store = createMemorySessionStore({
      maxSessions: 100,
      maxBytes: 5 * CODE_UNIT_BYTES,
    });
    const first = await store.open(source("aa"));
    const second = await store.open(source("bb"));
    const third = await store.open(source("cc"));
    expect(await store.read(first.id)).toBeUndefined();
    expect(await store.read(second.id)).toBeDefined();
    expect(await store.read(third.id)).toBeDefined();
  });

  it("charges appended turns against the same byte budget", async () => {
    const store = createMemorySessionStore({
      maxSessions: 100,
      maxBytes: 6 * CODE_UNIT_BYTES,
    });
    const first = await store.open(source("aa"));
    const second = await store.open(source("bb"));
    expect(await store.read(second.id)).toBeDefined();
    await store.appendTurns(second.id, [{ role: "user", text: "cccc" }]);
    expect(await store.read(first.id)).toBeUndefined();
    expect(await store.read(second.id)).toBeDefined();
  });

  it("stores a source larger than the whole budget instead of wedging", async () => {
    // Refusing it would break ingestion; keeping it forever would be the leak.
    // It is held until the next conversation needs the room, then dropped.
    const store = createMemorySessionStore({
      maxSessions: 100,
      maxBytes: 4 * CODE_UNIT_BYTES,
    });
    const huge = await store.open(source("x".repeat(500)));
    expect(await store.read(huge.id)).toBeDefined();
    const next = await store.open(source("y"));
    expect(await store.read(huge.id)).toBeUndefined();
    expect(await store.read(next.id)).toBeDefined();
  });

  it("ignores turns for a session that no longer exists", async () => {
    const store = createMemorySessionStore();
    await expect(
      store.appendTurns("missing", [{ role: "user", text: "hello" }]),
    ).resolves.toBeUndefined();
  });
});
