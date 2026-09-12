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

/**
 * The landing page and the application are two halves of one site, and the
 * whole point of separating them is that neither reaches into the other. A
 * marketing page that imports the conversation domain has not been split from
 * the application, it has merely been moved, and the next change will quietly
 * couple them again.
 */
it("keeps the landing page free of the application's machinery", () => {
  const code = readFileSync("apps/web/app/components/LandingPage.tsx", "utf8");
  for (const forbidden of [
    "src/lib/api",
    "src/lib/realtimeClient",
    "domain/conversation",
    "domain/ingestion",
    "./VoiceActions",
    "./Workspace",
  ])
    expect(code, `LandingPage must not import ${forbidden}`).not.toContain(
      forbidden,
    );
});

it("keeps the application free of the story it is not telling", () => {
  const code = readFileSync("apps/web/app/components/Workspace.tsx", "utf8");
  for (const forbidden of [
    "./IntroGate",
    "./PlatformSection",
    "./Process",
    "./HowItWorks",
    "./Applications",
    "./LandingPage",
  ])
    expect(code, `Workspace must not import ${forbidden}`).not.toContain(
      forbidden,
    );
});

it("gives each page its own route and its own component", () => {
  expect(readFileSync("apps/web/app/[lang]/page.tsx", "utf8")).toContain(
    "LandingPage",
  );
  expect(readFileSync("apps/web/app/[lang]/app/page.tsx", "utf8")).toContain(
    "Workspace",
  );
});
