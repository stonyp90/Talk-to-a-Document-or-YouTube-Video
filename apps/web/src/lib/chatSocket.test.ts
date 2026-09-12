import { describe, expect, it } from "vitest";
import { ChatSocket, chatSocketUrl, type SocketLike } from "./chatSocket";

/**
 * The client itself is exercised in the core, where both clients share it.
 * What is left here is the browser's two answers: where the channel is, and
 * what a socket is made of.
 */

describe("where the live channel is", () => {
  it("is wherever the deployment says it is", () => {
    expect(chatSocketUrl("wss://ws.ursly.io")).toBe("wss://ws.ursly.io");
  });

  it("is nowhere when nothing is configured, and the app falls back to HTTP", () => {
    expect(chatSocketUrl("")).toBeUndefined();
    expect(chatSocketUrl(undefined)).toBeUndefined();
  });
});

describe("what the browser opens", () => {
  it("opens one socket for the configured address", () => {
    const opened: string[] = [];
    const socket = new ChatSocket({
      url: "ws://localhost:3020/ws/chat",
      reference: () => ({}),
      onEvent: () => {},
      open: (url) => {
        opened.push(url);
        return { readyState: 0 } as unknown as SocketLike;
      },
      setTimer: () => 0,
      keepaliveMs: 0,
    });
    socket.start();
    expect(opened).toEqual(["ws://localhost:3020/ws/chat"]);
  });
});
