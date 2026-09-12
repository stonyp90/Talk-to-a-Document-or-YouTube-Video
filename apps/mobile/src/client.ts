import type { IngestedSource } from "../../../packages/core/src/domain/ingestion";
export type { IngestedSource };
export type Turn = { id: string; role: "user" | "assistant"; text: string };
export type Session =
  | { mode: "mock" }
  | { mode: "live"; clientSecret: string; expiresAt?: number };
export type Asset = {
  name: string;
  size?: number;
  uri: string;
  mimeType?: string;
};

export function apiOrigin(_platform: string, override?: string) {
  // Android uses adb reverse for both API and MinIO. Keep signed URLs intact.
  return (override || "http://localhost:3000").replace(/\/$/, "");
}
export function validateAsset(
  asset: Pick<Asset, "name" | "size" | "mimeType">,
) {
  if (
    !asset.name.toLowerCase().endsWith(".pdf") ||
    (asset.mimeType && asset.mimeType !== "application/pdf")
  )
    throw new Error("Please select a PDF.");
  if (asset.size === undefined || asset.size <= 0)
    throw new Error("Cannot verify this file size. Choose a downloaded PDF.");
  if (asset.size > 25 * 1024 * 1024)
    throw new Error("PDF files must be 25 MB or smaller.");
}
export function updateTranscript(
  turns: Turn[],
  event: Record<string, unknown>,
): Turn[] {
  const type = String(event.type);
  const user = type === "conversation.item.input_audio_transcription.completed";
  const delta =
    /response\.(output_audio_transcript|audio_transcript|output_text)\.delta/.test(
      type,
    );
  const done =
    /response\.(output_audio_transcript|audio_transcript|output_text)\.done/.test(
      type,
    );
  if (!user && !delta && !done) return turns;
  const id = String(event.item_id ?? event.response_id ?? "assistant");
  const previous = turns.find((turn) => turn.id === id);
  const text = delta
    ? (previous?.text ?? "") + String(event.delta ?? "")
    : String(event.transcript ?? event.text ?? previous?.text ?? "");
  const turn: Turn = { id, role: user ? "user" : "assistant", text };
  return previous
    ? turns.map((item) => (item.id === id ? turn : item))
    : [...turns, turn];
}
/**
 * A refusal the interface can act on rather than merely print. A reader whose
 * session has lapsed needs sending back to sign-in; a reader who has spent
 * their allowance needs telling to come back later. Both look like ordinary
 * failures until the code is carried along with the message.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export const isSignInRequired = (error: unknown): error is ApiError =>
  error instanceof ApiError && error.status === 401;
export const isUsageLimit = (error: unknown): error is ApiError =>
  error instanceof ApiError && error.code === "USAGE_LIMIT";

/**
 * Where the session token rests between launches. The app supplies a store
 * backed by the device; tests supply one in memory. Keeping the device out of
 * this file is what lets the client be tested under plain Node.
 */
export type SessionStore = {
  read(): Promise<string>;
  write(token: string): Promise<void>;
  clear(): Promise<void>;
};

export function memorySessionStore(): SessionStore {
  let held = "";
  return {
    read: async () => held,
    write: async (token: string) => {
      held = token;
    },
    clear: async () => {
      held = "";
    },
  };
}

export class ApiClient {
  /**
   * The session, in memory for the life of the process. A React Native client
   * has no dependable cookie jar, so every call to our own API carries it as
   * `Authorization: Bearer`. It is never printed, never put in an error and
   * never sent anywhere but this origin.
   */
  private held = "";
  private restored = false;

  constructor(
    readonly origin: string,
    private transport: typeof fetch = fetch,
    private store: SessionStore = memorySessionStore(),
  ) {}

  get signedIn(): boolean {
    return this.held !== "";
  }

  /** Reads the token the device kept, once per launch. */
  private async restore(): Promise<string> {
    if (this.restored) return this.held;
    this.restored = true;
    this.held = await this.store.read().catch(() => "");
    return this.held;
  }

  private async remember(token: string): Promise<void> {
    this.held = token;
    this.restored = true;
    await this.store.write(token).catch(() => undefined);
  }

  private async forget(): Promise<void> {
    this.held = "";
    this.restored = true;
    await this.store.clear().catch(() => undefined);
  }

  async request(path: string, init: RequestInit) {
    // Every call to our own API hydrates the stored session first, so a request
    // made before the app has finished asking who is signed in still carries it.
    await this.restore();
    return this.requestUrl(
      this.origin + path,
      { ...init, headers: this.withSession(init.headers) },
      45000,
      true,
    );
  }

  /**
   * Only our own API is told who is calling. A presigned storage URL and the
   * provider's realtime endpoint get the credential they were issued and never
   * this one.
   */
  private withSession(headers: RequestInit["headers"]): RequestInit["headers"] {
    if (!this.held) return headers;
    return {
      ...((headers as Record<string, string> | undefined) ?? {}),
      Authorization: `Bearer ${this.held}`,
    };
  }

  private async requestUrl(
    url: string,
    init: RequestInit,
    timeoutMs = 45000,
    ours = false,
  ) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await this.transport(url, {
        ...init,
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        // A session our own API has stopped honouring is worth nothing on this
        // device either: drop it so the reader is asked to sign in again
        // instead of retrying with a token that will never work.
        if (ours && response.status === 401) await this.forget();
        throw new ApiError(
          body.error || `Request failed (${response.status}). Please retry.`,
          body.code || `HTTP_${response.status}`,
          response.status,
        );
      }
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Asks for a one-time code. It answers the same way for any address. */
  async requestSignInCode(email: string): Promise<void> {
    await this.request("/api/auth/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
  }

  /**
   * Exchanges the mailed code for a session. The token comes back in the body
   * because this client has nowhere to keep a cookie; it goes straight into
   * storage and is never logged.
   */
  async confirmSignInCode(
    email: string,
    code: string,
  ): Promise<{ email: string }> {
    const response = await this.request("/api/auth/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), code: code.trim() }),
    });
    const body = (await response.json()) as { email: string; token?: string };
    await this.remember(String(body.token ?? ""));
    return { email: body.email };
  }

  /** Who is signed in, or nothing at all. Being signed out is not an error. */
  async readSession(): Promise<{ email: string } | null> {
    if (!(await this.restore())) return null;
    try {
      const response = await this.request("/api/auth/session", {
        method: "GET",
      });
      return (await response.json()) as { email: string };
    } catch (error) {
      if (isSignInRequired(error)) return null;
      throw error;
    }
  }

  /**
   * Ends the session on the server and on the device. A network that refuses
   * the call must not leave the reader signed in on the phone in front of them.
   */
  async signOut(): Promise<void> {
    try {
      await this.request("/api/auth/session", { method: "DELETE" });
    } catch {
      // The local half of signing out cannot be allowed to fail.
    } finally {
      await this.forget();
    }
  }
  async youtube(url: string): Promise<IngestedSource> {
    const body = new FormData();
    body.append("url", url.trim());
    const response = await this.request("/api/ingest", {
      method: "POST",
      body,
    });
    return (await response.json()).source;
  }
  async pdf(asset: Asset): Promise<IngestedSource> {
    validateAsset(asset);
    const health = (await (
      await this.request("/api/health", { method: "GET" })
    ).json()) as { directUpload?: boolean };
    const body = new FormData();
    if (health.directUpload) {
      const upload = (await this.json("/api/uploads", {
        name: asset.name,
        type: "application/pdf",
        size: asset.size,
      })) as { url: string; fields: Record<string, string>; key: string };
      Object.entries(upload.fields).forEach(([key, value]) =>
        body.append(key, value),
      );
      // S3 requires the file part last. Do not set multipart Content-Type: the
      // native networking layer supplies the correct boundary for its URI part.
      body.append("file", {
        uri: asset.uri,
        name: asset.name,
        type: "application/pdf",
      } as unknown as Blob);
      // Never rewrite a presigned hostname, query or field on the client.
      await this.requestUrl(upload.url, { method: "POST", body }, 120000);
      return (
        await this.json("/api/uploads/extract", {
          key: upload.key,
          name: asset.name,
        })
      ).source;
    }
    // React Native's FormData accepts file URI objects; DOM typings accept Blob only.
    body.append("file", {
      uri: asset.uri,
      name: asset.name,
      type: "application/pdf",
    } as unknown as Blob);
    return (
      await (await this.request("/api/ingest", { method: "POST", body })).json()
    ).source;
  }
  async json(path: string, body: unknown) {
    return (
      await this.request(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    ).json();
  }
  async session(source: IngestedSource): Promise<Session> {
    return this.json("/api/realtime/session", { source });
  }
  async ask(source: IngestedSource, question: string): Promise<string> {
    return (await this.json("/api/text-chat", { source, question })).answer;
  }
  async negotiate(sdp: string, clientSecret: string): Promise<string> {
    if (!clientSecret)
      throw new Error("Missing voice session credential. Retry voice.");
    try {
      return await (
        await this.requestUrl("https://api.openai.com/v1/realtime/calls", {
          method: "POST",
          headers: {
            "Content-Type": "application/sdp",
            Authorization: `Bearer ${clientSecret}`,
          },
          body: sdp,
        })
      ).text();
    } catch {
      // Provider responses must not echo credentials back into UI/error logs.
      throw new Error("Voice connection failed. Retry or use text chat.");
    }
  }
}
