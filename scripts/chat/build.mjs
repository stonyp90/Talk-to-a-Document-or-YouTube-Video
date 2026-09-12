import { build } from "esbuild";

/**
 * Bundles the live channel's two entry points.
 *
 * `main` is the long-lived process the local stack runs; `handler` is the same
 * application behind a managed WebSocket gateway. Both are bundled so the
 * images that carry them need nothing but a Node runtime, and so the two
 * transports can never drift onto different copies of the core.
 */
await build({
  entryPoints: {
    main: "services/chat/src/main.ts",
    handler: "services/chat/src/handler.ts",
  },
  outdir: "services/chat/dist",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: true,
  minify: false,
  // Some transitive dependencies still reach for CommonJS at runtime.
  banner: {
    js: "import{createRequire as __createRequire}from'module';const require=__createRequire(import.meta.url);",
  },
});

console.log("[chat] bundled services/chat/dist");
