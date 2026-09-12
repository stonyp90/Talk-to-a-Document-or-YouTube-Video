import { beforeEach, describe, expect, it } from "vitest";
import {
  createObjectSessionStore,
  type SessionObjects,
} from "./objectSessionStore";
import type { IngestedSource } from "../../core/src/domain/ingestion";

const source: IngestedSource = {
  kind: "pdf",
  sourceName: "brief.pdf",
  text: "The budget is 42.",
  characters: 17,
};

function fakeObjects(): SessionObjects & { keys: () => string[] } {
  const objects = new Map<string, string>();
  return {
    keys: () => [...objects.keys()],
    async put(key, body) {
      objects.set(key, body);
    },
    async get(key) {
      return objects.get(key);
    },
  };
}

describe("a conversation held outside any one server process", () => {
  let objects: ReturnType<typeof fakeObjects>;
  let clock: number;
  const store = () =>
    createObjectSessionStore(objects, {
      prefix: "sessions/",
      ttlMs: 1000,
      maxTurns: 4,
      now: () => clock,
      createId: () => "fixed-id",
    });

  beforeEach(() => {
    objects = fakeObjects();
    clock = 1000;
  });

  it("writes a session one process can open and another can read", async () => {
    const opened = await store().open(source);
    expect(objects.keys()).toEqual(["sessions/fixed-id.json"]);
    const reopened = await store().read(opened.id);
    expect(reopened?.source).toEqual(source);
    expect(reopened?.turns).toEqual([]);
  });

  it("carries the exchange across processes so a follow-up has its history", async () => {
    const opened = await store().open(source);
    await store().appendTurns(opened.id, [
      { role: "user", text: "What is the budget?" },
      { role: "assistant", text: "42." },
    ]);
    expect((await store().read(opened.id))?.turns).toHaveLength(2);
  });

  it("keeps only the most recent exchanges", async () => {
    const opened = await store().open(source);
    for (let turn = 0; turn < 4; turn++)
      await store().appendTurns(opened.id, [
        { role: "user", text: `q${turn}` },
        { role: "assistant", text: `a${turn}` },
      ]);
    const read = await store().read(opened.id);
    expect(read?.turns.map((turn) => turn.text)).toEqual([
      "q2",
      "a2",
      "q3",
      "a3",
    ]);
  });

  it("forgets a conversation nobody has touched for its lifetime", async () => {
    const opened = await store().open(source);
    clock += 1001;
    expect(await store().read(opened.id)).toBeUndefined();
  });

  it("keeps a conversation alive while it is being used", async () => {
    const opened = await store().open(source);
    clock += 900;
    expect(await store().read(opened.id)).toBeDefined();
    clock += 900;
    expect(await store().read(opened.id)).toBeDefined();
  });

  it("treats an unknown id as a conversation the server never had", async () => {
    expect(await store().read("someone-elses-id")).toBeUndefined();
  });

  it("refuses an id that would reach outside its own prefix", async () => {
    await expect(store().read("../uploads/secret")).resolves.toBeUndefined();
  });

  it("survives an object that is no longer readable", async () => {
    await objects.put("sessions/broken.json", "not json");
    expect(await store().read("broken")).toBeUndefined();
  });
});
