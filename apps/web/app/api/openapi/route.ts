import { publicOrigin } from "@/apps/web/src/http";
import { buildOpenApiDocument } from "@/apps/web/src/openapi";

export function GET(request: Request) {
  return Response.json(buildOpenApiDocument(publicOrigin(request)), {
    headers: {
      "Cache-Control": "public, max-age=300",
      // The document names the origin the caller reached, so a shared cache
      // must not hand one host's document to a caller on another.
      Vary: "Host, X-Forwarded-Host, X-Forwarded-Proto",
    },
  });
}
