import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateAdminRequest } from "@/shared/lib/admin-api/auth";
import { AdminApiError, adminErrorResponse, internalError } from "@/shared/lib/admin-api/errors";
import { createAdminMcpServer } from "@/shared/lib/admin-api/mcp/server";
import { createLogger } from "@/shared/lib/logger";

// Remote MCP endpoint (Streamable HTTP, stateless). Each POST gets its own
// McpServer + transport bound to the caller's token, so there is no session
// state to share across serverless instances or to leak between tokens.
// Responses are plain JSON (enableJsonResponse): every tool is a single
// read-and-return, nothing streams. Web-standard Request/Response end to end,
// no Node http.ServerResponse involved.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = createLogger("admin-api:mcp");

const MAX_BODY_BYTES = 1024 * 1024;

const AUTH_HEADERS = { "WWW-Authenticate": 'Bearer realm="perezagruzka-admin"', "Cache-Control": "no-store" };

async function authenticate(request: Request) {
  try {
    return { principal: await authenticateAdminRequest(request.headers) };
  } catch (err) {
    if (err instanceof AdminApiError) return { response: adminErrorResponse(err, AUTH_HEADERS) };
    log.error("mcp auth failed", err);
    return { response: adminErrorResponse(internalError(), AUTH_HEADERS) };
  }
}

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (!auth.principal) return auth.response;

  const server = createAdminMcpServer(auth.principal);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    maxRequestBodySize: MAX_BODY_BYTES,
  });
  try {
    await server.connect(transport);
    return await transport.handleRequest(request);
  } catch (err) {
    log.error("mcp request failed", err, { tokenId: auth.principal.tokenId });
    return adminErrorResponse(internalError(), { "Cache-Control": "no-store" });
  } finally {
    // JSON mode: the response body is fully materialized by now.
    await server.close().catch(() => undefined);
  }
}

// Stateless server: no standalone server->client SSE stream and no sessions to
// terminate. The MCP spec answer for both is 405 (clients then use POST only).
async function methodNotAllowed(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (!auth.principal) return auth.response;
  return Response.json(
    { error: { code: "method_not_allowed", message: "Этот MCP-сервер принимает только POST-запросы" } },
    { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } },
  );
}

export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;
