import { ApiError, requestJson } from "./api";

/**
 * The browser half of the sign-in gate. The session lives in an HttpOnly
 * cookie, so there is nothing here to store and nothing to hand back: every
 * call simply carries the cookie the browser already holds.
 */

export type AccountSession = { email: string };

const json = (body: unknown): RequestInit & { retries?: number } => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
  // Sign-in is a deliberate act. Repeating it on a flaky network would mail a
  // second code and invalidate the one the reader is already typing.
  retries: 0,
});

/** Asks for a one-time code. It answers the same way whether or not the address is known. */
export async function requestSignInCode(email: string): Promise<void> {
  await requestJson<void>("/api/auth/request-code", json({ email }));
}

export async function confirmSignInCode(
  email: string,
  code: string,
): Promise<AccountSession> {
  return requestJson<AccountSession>(
    "/api/auth/confirm",
    json({ email, code }),
  );
}

/** The signed-in address, or nothing at all. Being signed out is not an error. */
export async function readSession(): Promise<AccountSession | undefined> {
  try {
    return await requestJson<AccountSession>("/api/auth/session", {
      retries: 0,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return undefined;
    throw error;
  }
}

export async function signOut(): Promise<void> {
  await requestJson<void>("/api/auth/session", {
    method: "DELETE",
    retries: 0,
  });
}
