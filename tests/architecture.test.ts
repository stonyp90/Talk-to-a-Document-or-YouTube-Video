import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? sources(path)
      : /\.tsx?$/.test(path) && !path.includes(".test.")
        ? [path]
        : [];
  });
}

it("keeps the core independent of frameworks, adapters and infrastructure", () => {
  for (const file of sources("packages/core/src")) {
    const code = readFileSync(file, "utf8");
    const imports = [
      ...code.matchAll(/(?:from\s+|import\s*\()["']([^"']+)/g),
    ].map((match) => match[1]);
    expect(
      imports.every(
        (path) =>
          path.startsWith(".") &&
          !path.includes("adapters") &&
          !path.includes("apps"),
      ),
      file,
    ).toBe(true);
    expect(code, file).not.toMatch(
      /process\.env|\bfetch\(|\bBuffer\b|\bFormData\b/,
    );
  }
});

it("makes HTTP routes enter through the composition root, not outbound adapters", () => {
  for (const file of sources("apps/web/app/api")) {
    expect(readFileSync(file, "utf8"), file).not.toMatch(
      /packages\/adapters|@aws-sdk|from ["']openai/,
    );
  }
});

it("keeps outbound adapters independent of application entry points", () => {
  for (const file of sources("packages/adapters/src")) {
    expect(readFileSync(file, "utf8"), file).not.toMatch(
      /apps\/web|apps\/mobile|from ["']next/,
    );
  }
});
