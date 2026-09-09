import { buildOpenApiDocument } from "@/apps/web/src/openapi";

export function GET(request: Request) {
  return Response.json(buildOpenApiDocument(new URL(request.url).origin), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
