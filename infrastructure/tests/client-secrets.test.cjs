const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, mkdir, writeFile, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
test("built-client scan detects either canary, scans nested assets, and rejects empty output", async () => {
  const { canaries, scanClientSecrets } = await import(
    "../scripts/check-client-secrets.mjs"
  );
  const directory = await mkdtemp(join(tmpdir(), "talk-client-canary-"));
  try {
    await assert.rejects(scanClientSecrets(directory), /empty/);
    await mkdir(join(directory, "chunks"));
    const asset = join(directory, "chunks", "client.js");
    await writeFile(asset, 'console.log("safe client")');
    assert.equal(await scanClientSecrets(directory), 1);
    for (const fixture of Object.values(canaries)) {
      await writeFile(asset, `const leaked = "${fixture}";`);
      await assert.rejects(scanClientSecrets(directory), /canary leaked/);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
