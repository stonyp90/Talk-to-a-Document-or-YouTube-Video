import { describe, expect, it } from "vitest";
import { createMemoryFileSystem } from "./fileSystem";

describe("createMemoryFileSystem", () => {
  it("lists root directory with demo content", async () => {
    const fs = createMemoryFileSystem();
    const listing = await fs.list("root");
    expect(listing.length).toBeGreaterThan(0);
    expect(listing.some((n) => n.kind === "directory")).toBe(true);
    expect(listing.some((n) => n.kind === "file")).toBe(true);
  });

  it("returns null for unknown node", async () => {
    const fs = createMemoryFileSystem();
    const node = await fs.getNode("nonexistent");
    expect(node).toBeNull();
  });

  it("lists subdirectory children", async () => {
    const fs = createMemoryFileSystem();
    const rootListing = await fs.list("root");
    const dir = rootListing.find((n) => n.kind === "directory");
    if (!dir || dir.kind !== "directory") return;
    const subListing = await fs.list(dir.id);
    expect(subListing.length).toBeGreaterThan(0);
  });

  it("search finds nodes by name", async () => {
    const fs = createMemoryFileSystem();
    const results = await fs.search("pdf");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((n) => n.name.toLowerCase().includes("pdf"))).toBe(
      true,
    );
  });

  it("search returns empty for no match", async () => {
    const fs = createMemoryFileSystem();
    const results = await fs.search("xyznonexistent");
    expect(results).toEqual([]);
  });

  it("getNode returns the correct node", async () => {
    const fs = createMemoryFileSystem();
    const root = await fs.getNode("root");
    expect(root).not.toBeNull();
    expect(root!.name).toBe("My Documents");
  });
});
