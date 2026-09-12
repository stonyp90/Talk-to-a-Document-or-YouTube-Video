import { afterEach, describe, expect, it, vi } from "vitest";
import {
  confirmSignInCode,
  readSession,
  requestSignInCode,
  signOut,
} from "./account";

const empty = () => new Response(null, { status: 204 });
const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
const failure = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

afterEach(() => vi.unstubAllGlobals());

describe("requestSignInCode", () => {
  it("posts the address and expects nothing back", async () => {
    const fetchMock = vi.fn().mockResolvedValue(empty());
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      requestSignInCode("reader@example.com"),
    ).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/auth/request-code");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      email: "reader@example.com",
    });
  });

  it("never retries, so one request is never two codes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(failure(503));
    vi.stubGlobal("fetch", fetchMock);
    await expect(requestSignInCode("reader@example.com")).rejects.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces a refused address with its code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        failure(400, {
          error: "Enter a valid email address.",
          code: "INVALID_EMAIL",
        }),
      ),
    );
    await expect(requestSignInCode("nope")).rejects.toMatchObject({
      code: "INVALID_EMAIL",
    });
  });
});

describe("confirmSignInCode", () => {
  it("returns the signed-in address", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(ok({ email: "reader@example.com" })),
    );
    await expect(
      confirmSignInCode("reader@example.com", "123456"),
    ).resolves.toEqual({ email: "reader@example.com" });
  });

  it("surfaces a wrong code so the panel can ask again", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          failure(401, {
            error: "That code is not valid.",
            code: "CODE_INVALID",
          }),
        ),
    );
    await expect(
      confirmSignInCode("reader@example.com", "000000"),
    ).rejects.toMatchObject({ code: "CODE_INVALID" });
  });
});

describe("readSession", () => {
  it("reports the signed-in address", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(ok({ email: "reader@example.com" })),
    );
    await expect(readSession()).resolves.toEqual({
      email: "reader@example.com",
    });
  });

  it("treats being signed out as an answer, not as a failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(failure(401, { code: "UNAUTHENTICATED" })),
    );
    await expect(readSession()).resolves.toBeUndefined();
  });

  it("still reports a real failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(failure(500)));
    await expect(readSession()).rejects.toBeDefined();
  });
});

describe("signOut", () => {
  it("asks the server to end the session", async () => {
    const fetchMock = vi.fn().mockResolvedValue(empty());
    vi.stubGlobal("fetch", fetchMock);
    await signOut();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/auth/session");
    expect(init.method).toBe("DELETE");
  });
});
