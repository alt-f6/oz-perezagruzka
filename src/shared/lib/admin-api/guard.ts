import { randomUUID } from "node:crypto";
import { createLogger } from "@/shared/lib/logger";
import { authenticateAdminRequest, type AdminPrincipal } from "./auth";
import { AdminApiError, adminErrorResponse, internalError } from "./errors";
import type { AdminScope } from "./scopes";

const log = createLogger("admin-api");

export interface AdminApiContext<P> {
  principal: AdminPrincipal;
  params: P;
  requestId: string;
}

type RouteContext<P> = { params: Promise<P> };

const BASE_HEADERS = { "Cache-Control": "no-store" } as const;

function requestIdFor(request: Request): string {
  const incoming = request.headers.get("x-request-id");
  return incoming && /^[\w.-]{1,128}$/.test(incoming) ? incoming : randomUUID();
}

/**
 * Wraps an admin-API route handler: bearer auth + scope check, JSON
 * serialization, and the single catch-all that turns every non-AdminApiError
 * (Prisma, bugs) into an opaque Russian 500 -- raw DB errors never leave here.
 */
export function withAdminApiGuard<P = Record<string, never>>(
  scopes: readonly AdminScope[],
  handler: (request: Request, ctx: AdminApiContext<P>) => Promise<unknown>,
) {
  return async (request: Request, routeCtx?: RouteContext<P>): Promise<Response> => {
    const requestId = requestIdFor(request);
    const headers = { ...BASE_HEADERS, "X-Request-Id": requestId };
    try {
      const principal = await authenticateAdminRequest(request.headers, scopes);
      const params = (routeCtx ? await routeCtx.params : {}) as P;
      const body = await handler(request, { principal, params, requestId });
      return Response.json(body, { status: 200, headers });
    } catch (err) {
      if (err instanceof AdminApiError) {
        if (err.status >= 500) log.error("admin api error", err, { requestId });
        return adminErrorResponse(err, headers);
      }
      log.error("unhandled admin api error", err, {
        requestId,
        path: new URL(request.url).pathname,
      });
      return adminErrorResponse(internalError(), headers);
    }
  };
}
