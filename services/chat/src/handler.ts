import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import {
  encodeServerMessage,
  type ServerMessage,
} from "../../../packages/core/src/domain/chat";
import type { ChatSend } from "../../../packages/core/src/application/chat";
import { chatChannel, socketSettings } from "./composition";
import { isAllowedOrigin } from "./policy";

/**
 * The live channel on a managed gateway.
 *
 * Production has no process to hold a socket in, so the gateway holds it and
 * hands each frame to a function. Nothing is remembered between frames: the
 * client names its conversation every time, and the conversation itself lives
 * in shared storage. The reply travels back to the same connection through the
 * gateway's management API, one frame per fragment, so the reader watches the
 * answer arrive exactly as they do on a long-lived socket.
 */

export type GatewayEvent = {
  requestContext: {
    routeKey: string;
    connectionId: string;
    domainName?: string;
    stage?: string;
  };
  headers?: Record<string, string | undefined>;
  body?: string;
};

export type GatewayResult = { statusCode: number };

type Channel = {
  handle(frame: string | unknown, send: ChatSend): Promise<void>;
};

export type HandlerDependencies = {
  channel?: Channel;
  /** How a frame reaches one connection; injected so the route can be tested. */
  sender?: (event: GatewayEvent) => ChatSend;
};

const headerOf = (event: GatewayEvent, name: string): string | undefined => {
  const entry = Object.entries(event.headers ?? {}).find(
    ([key]) => key.toLowerCase() === name,
  );
  return entry?.[1];
};

/** Where replies are posted. A custom domain cannot serve them, so it is configurable. */
export function callbackEndpoint(event: GatewayEvent): string {
  const configured = process.env.CHAT_CALLBACK_URL;
  if (configured) return configured;
  const { domainName, stage } = event.requestContext;
  return `https://${domainName}/${stage}`;
}

export function createGatewaySend(event: GatewayEvent): ChatSend {
  const client = new ApiGatewayManagementApiClient({
    endpoint: callbackEndpoint(event),
    region: process.env.AWS_REGION ?? "us-east-1",
  });
  const { connectionId } = event.requestContext;
  return async (message: ServerMessage) => {
    try {
      await client.send(
        new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: new TextEncoder().encode(encodeServerMessage(message)),
        }),
      );
    } catch (error) {
      // A reader who closed the tab mid-answer is not a failure worth raising;
      // the remaining fragments simply have nowhere to go.
      const status = (error as { $metadata?: { httpStatusCode?: number } })
        .$metadata?.httpStatusCode;
      if (status !== 410) throw error;
    }
  };
}

export function createHandler(dependencies: HandlerDependencies = {}) {
  const sender = dependencies.sender ?? createGatewaySend;
  return async function handle(event: GatewayEvent): Promise<GatewayResult> {
    const { routeKey } = event.requestContext;
    if (routeKey === "$connect")
      return {
        statusCode: isAllowedOrigin(
          headerOf(event, "origin"),
          socketSettings().allowedOrigins,
        )
          ? 200
          : 403,
      };
    if (routeKey === "$disconnect") return { statusCode: 200 };
    const channel = dependencies.channel ?? chatChannel();
    await channel.handle(event.body ?? "", sender(event));
    return { statusCode: 200 };
  };
}

export const handler = createHandler();
