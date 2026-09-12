import { spawn } from "node:child_process";

/**
 * The development stack: the Next.js app and the live discussion channel.
 *
 * The socket is served by its own endpoint in every environment — another port
 * here, another host in production — so running the app alone would leave the
 * discussion falling back to request/response and hide the behaviour we build
 * on. Both are started together, and either one exiting takes the other down.
 */

const port = process.env.CHAT_PORT ?? "3020";
const path = process.env.CHAT_SOCKET_PATH ?? "/ws/chat";
const environment = {
  ...process.env,
  CHAT_PORT: port,
  CHAT_SOCKET_PATH: path,
  NEXT_PUBLIC_CHAT_SOCKET_URL:
    process.env.NEXT_PUBLIC_CHAT_SOCKET_URL ?? `ws://localhost:${port}${path}`,
};

// The local stack runs the channel as its own container and publishes it, so
// there it is joined rather than started again on a port already taken.
const ownChannel = (process.env.DEV_CHANNEL ?? "on") !== "off";

const children = [
  ...(ownChannel
    ? [
        spawn("npx", ["tsx", "services/chat/src/main.ts"], {
          stdio: "inherit",
          env: environment,
        }),
      ]
    : []),
  spawn(
    "npm",
    ["run", "dev", "--workspace", "@talk/web", "--", ...process.argv.slice(2)],
    { stdio: "inherit", env: environment },
  ),
];

let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  process.exit(code ?? 0);
}

for (const child of children) {
  child.on("exit", (code) => stop(code ?? 0));
  child.on("error", (error) => {
    console.error("[dev]", error);
    stop(1);
  });
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop(0));
