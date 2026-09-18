import assert from "node:assert/strict";
import { defineStep } from "@cucumber/cucumber";
import { createMemoryFileSystem } from "../../packages/adapters/src/fileSystem";
import { createFileNavigator } from "../../packages/core/src/domain/fileNavigation";
import type { FileNavIntent } from "../../packages/core/src/domain/fileNavigation";
import type { Step, World } from "./steps";

type FileBrowserState = {
  nav: ReturnType<typeof createFileNavigator>;
  lastIntent: FileNavIntent;
};

export function registerFileBrowserChecks(step: Step) {
  const states = new WeakMap<World, FileBrowserState>();
  const state = (world: World): FileBrowserState => {
    const existing = states.get(world);
    if (existing) return existing;
    const created: FileBrowserState = {
      nav: createFileNavigator({
        fs: createMemoryFileSystem(),
        rootId: "root",
      }),
      lastIntent: null,
    };
    states.set(world, created);
    return created;
  };

  step("the file browser is loaded", async function () {
    const current = state(this);
    await current.nav.load();
  });

  step("the root directory shows demo files and folders", function () {
    const current = state(this);
    const snapshot = current.nav.snapshot();
    assert.ok(snapshot.nodes.length > 0, "Root should have nodes");
    assert.ok(
      snapshot.nodes.some((n) => n.kind === "directory"),
      "Should have at least one directory",
    );
    assert.ok(
      snapshot.nodes.some((n) => n.kind === "file"),
      "Should have at least one file",
    );
  });

  defineStep(
    /^the breadcrumb shows "([^"]*)"$/,
    function (this: World, expected: string) {
      const current = state(this);
      const snapshot = current.nav.snapshot();
      const trail = snapshot.breadcrumb.map((e) => e.name).join(" / ");
      assert.equal(trail, expected);
    },
  );

  defineStep(
    /^the user navigates into "([^"]*)"$/,
    async function (this: World, dirName: string) {
      const current = state(this);
      const snapshot = current.nav.snapshot();
      const dir = snapshot.nodes.find(
        (n) => n.kind === "directory" && n.name === dirName,
      );
      assert.ok(dir, `Directory "${dirName}" not found`);
      if (dir)
        current.nav.dispatch({ type: "navigate", directoryId: dir.id });
      await current.nav.ready();
    },
  );

  defineStep(
    /^the grid shows files inside "([^"]*)"$/,
    function (this: World, _dirName: string) {
      const current = state(this);
      const snapshot = current.nav.snapshot();
      assert.ok(snapshot.nodes.length > 0, "Should show files in directory");
    },
  );

  step("the user navigates up", async function () {
    const current = state(this);
    current.nav.dispatch({ type: "navigateUp" });
    await current.nav.ready();
  });

  defineStep(
    /^the user selects item at index (\d+)$/,
    function (this: World, indexStr: string) {
      const current = state(this);
      current.nav.dispatch({ type: "select", index: Number(indexStr) });
    },
  );

  defineStep(
    /^the selected index is (-?\d+)$/,
    function (this: World, expectedStr: string) {
      const current = state(this);
      assert.equal(
        current.nav.snapshot().selectedIndex,
        Number(expectedStr),
      );
    },
  );

  step("the user moves to next", function () {
    const current = state(this);
    current.nav.dispatch({ type: "next" });
  });

  step("the user moves to previous", function () {
    const current = state(this);
    current.nav.dispatch({ type: "prev" });
  });

  step("the user opens the selection", function () {
    const current = state(this);
    current.lastIntent = current.nav.dispatch({ type: "openSelected" });
  });

  step("a file selection intent is emitted", function () {
    const current = state(this);
    assert.ok(current.lastIntent, "An intent should be emitted");
    assert.equal(current.lastIntent.type, "selectFile");
  });

  defineStep(
    /^the user searches for "([^"]*)"$/,
    async function (this: World, query: string) {
      const current = state(this);
      current.nav.dispatch({ type: "search", query });
      await current.nav.ready();
    },
  );

  defineStep(
    /^the search results contain "([^"]*)"$/,
    function (this: World, name: string) {
      const current = state(this);
      const snapshot = current.nav.snapshot();
      assert.ok(
        snapshot.searchResults.some((n) => n.name === name),
        `Search results should contain "${name}"`,
      );
    },
  );

  step("the file browser is in search mode", function () {
    const current = state(this);
    assert.equal(current.nav.snapshot().isSearchMode, true);
  });

  step("the user exits search", function () {
    const current = state(this);
    current.nav.dispatch({ type: "exitSearch" });
  });

  step("the file browser is not in search mode", function () {
    const current = state(this);
    assert.equal(current.nav.snapshot().isSearchMode, false);
  });
}
