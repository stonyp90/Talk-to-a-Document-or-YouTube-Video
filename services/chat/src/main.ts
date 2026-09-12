import { socketSettings } from "./composition";
import { startChatServer } from "./server";

/** The process entry point for development and for the local stack. */
async function main(): Promise<void> {
  const running = await startChatServer();
  const { path, host } = socketSettings();
  console.log(`[chat] listening on ws://${host}:${running.port}${path}`);

  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => {
      void running.close().then(() => process.exit(0));
    });
}

main().catch((error) => {
  console.error("[chat] could not start", error);
  process.exit(1);
});
