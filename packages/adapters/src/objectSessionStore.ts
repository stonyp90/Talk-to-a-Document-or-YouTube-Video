import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import type {
  ConversationTurn,
  SessionStorePort,
  SourceSession,
} from "../../core/src/application/ports";
import type { IngestedSource } from "../../core/src/domain/ingestion";

/**
 * The little of an object store this adapter needs: write a document, read it
 * back. Keeping it this narrow is what lets the store be exercised without a
 * network, and what would let a different object store replace S3.
 */
export type SessionObjects = {
  put(key: string, body: string): Promise<void>;
  get(key: string): Promise<string | undefined>;
};

export type ObjectSessionStoreOptions = {
  prefix?: string;
  ttlMs?: number;
  maxTurns?: number;
  now?: () => number;
  createId?: () => string;
};

const DEFAULTS = {
  prefix: "sessions/",
  ttlMs: 60 * 60 * 1000,
  maxTurns: 12,
};

/** Only an opaque id addresses a session; anything else cannot name an object. */
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * A conversation kept in object storage rather than in one server's memory.
 *
 * The live channel and the HTTP API are separate processes in production — a
 * socket connection is served by a different function from the upload that
 * created the source — so the conversation has to live somewhere both can
 * reach. Holding it here is also what lets the client send a short id instead
 * of the whole extraction on every turn.
 *
 * Turns are appended read-then-write, so two questions answered at the very
 * same moment can record only the later one's history. The cost of losing a
 * line of context is far below the cost of a lock on every exchange.
 */
export function createObjectSessionStore(
  objects: SessionObjects,
  options: ObjectSessionStoreOptions = {},
): SessionStorePort {
  const prefix = options.prefix ?? DEFAULTS.prefix;
  const ttlMs = options.ttlMs ?? DEFAULTS.ttlMs;
  const maxTurns = options.maxTurns ?? DEFAULTS.maxTurns;
  const now = options.now ?? (() => Date.now());
  const createId = options.createId ?? (() => crypto.randomUUID());
  const key = (id: string) => `${prefix}${id}.json`;

  async function load(id: string): Promise<SourceSession | undefined> {
    if (!SAFE_ID.test(id)) return undefined;
    const body = await objects.get(key(id)).catch(() => undefined);
    if (!body) return undefined;
    try {
      const session = JSON.parse(body) as SourceSession;
      return session.expiresAt > now() ? session : undefined;
    } catch {
      return undefined;
    }
  }

  const save = (session: SourceSession) =>
    objects.put(key(session.id), JSON.stringify(session));

  return {
    async open(source: IngestedSource): Promise<SourceSession> {
      const session: SourceSession = {
        id: createId(),
        source,
        turns: [],
        expiresAt: now() + ttlMs,
      };
      await save(session);
      return session;
    },

    async read(id: string): Promise<SourceSession | undefined> {
      const session = await load(id);
      if (!session) return undefined;
      // Reading keeps a live conversation alive, as the in-memory store does.
      session.expiresAt = now() + ttlMs;
      await save(session);
      return session;
    },

    async appendTurns(id: string, turns: ConversationTurn[]): Promise<void> {
      const session = await load(id);
      if (!session) return;
      session.turns = [...session.turns, ...turns].slice(-maxTurns);
      session.expiresAt = now() + ttlMs;
      await save(session);
    },
  };
}

function client(): S3Client {
  const endpoint = process.env.OBJECT_STORE_ENDPOINT;
  return new S3Client({
    region: process.env.AWS_REGION ?? "us-east-1",
    endpoint,
    forcePathStyle: !!endpoint,
    ...(endpoint
      ? {
          credentials: {
            accessKeyId: process.env.OBJECT_STORE_ACCESS_KEY ?? "local-minio",
            secretAccessKey:
              process.env.OBJECT_STORE_SECRET_KEY ?? "local-minio-password",
          },
        }
      : {}),
  });
}

/** The S3 implementation of the two operations above. */
export function createS3SessionObjects(bucket: string): SessionObjects {
  const s3 = client();
  return {
    async put(key, body) {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: "application/json",
        }),
      );
    },
    async get(key) {
      try {
        const object = await s3.send(
          new GetObjectCommand({ Bucket: bucket, Key: key }),
        );
        return await object.Body?.transformToString();
      } catch {
        return undefined;
      }
    },
  };
}
