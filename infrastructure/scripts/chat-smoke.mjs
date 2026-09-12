import assert from "node:assert/strict";
import http from "node:http";
import { randomBytes } from "node:crypto";

/**
 * Proves the live discussion is actually reachable where it says it is.
 *
 * It speaks the handshake rather than the protocol: a socket that upgrades from
 * an allowed origin and is refused from any other is the part a deployment can
 * get wrong. What is said over the socket afterwards is covered by the unit and
 * acceptance suites, which do not need a running container. Node is all this
 * has, exactly like the application smoke test beside it.
 */

const target = process.argv[2];
assert(
  target && /^wss?:\/\//.test(target),
  "A live discussion URL is required, for example ws://localhost:3020/ws/chat",
);
const origin = process.argv[3] ?? "http://localhost:3000";
// Development leaves the channel open to any origin so a reader can reach it
// from whichever loopback name they typed. A deployment that names its origins
// is expected to enforce them, and says so here.
const restricted = process.argv.includes("--origins-restricted");
const url = new URL(target);

function handshake(headers) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      timeout: 15000,
      headers: {
        Connection: "Upgrade",
        Upgrade: "websocket",
        "Sec-WebSocket-Version": "13",
        "Sec-WebSocket-Key": randomBytes(16).toString("base64"),
        ...headers,
      },
    });
    request.on("upgrade", (response, socket) => {
      socket.destroy();
      resolve(response.statusCode ?? 101);
    });
    request.on("response", (response) => {
      response.resume();
      resolve(response.statusCode ?? 0);
    });
    request.on("timeout", () =>
      request.destroy(new Error("Handshake timed out")),
    );
    // A refusal is written and the connection destroyed, which surfaces here
    // rather than as a response on some platforms.
    request.on("error", (error) => reject(error));
    request.end();
  });
}

const accepted = await handshake({ Origin: origin });
assert.equal(accepted, 101, `The channel refused ${origin}`);

if (restricted) {
  const refused = await handshake({
    Origin: "https://not-this-site.example",
  }).catch(() => 403);
  assert.notEqual(
    refused,
    101,
    "The channel accepted a socket from an origin it was never told about",
  );
}

console.log(
  `[chat-smoke] ${target} upgrades for ${origin}${restricted ? " and refuses every other origin" : ""}`,
);
