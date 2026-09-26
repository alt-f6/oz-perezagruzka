// Error contract for the machine-facing admin API (REST /api/admin/v1 and MCP
// /api/mcp): every failure is `{ error: { code, message, field? } }` with a
// human-readable Russian message. Anything that is not an AdminApiError
// (Prisma errors, bugs) collapses into an opaque 500 so table/column names and
// query fragments never reach the client.

export interface AdminApiErrorBody {
  error: { code: string; message: string; field?: string };
}

export class AdminApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly field?: string;

  constructor(status: number, code: string, message: string, field?: string) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.code = code;
    this.field = field;
  }

  toBody(): AdminApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.field ? { field: this.field } : {}),
      },
    };
  }
}

export const unauthorized = () =>
  new AdminApiError(401, "unauthorized", "Токен недействителен или отозван");

export const forbiddenScope = () =>
  new AdminApiError(403, "forbidden_scope", "У токена нет права на это действие");

export const notFound = (what: string) =>
  new AdminApiError(404, "not_found", `${what} не найден`);

export const invalidParam = (field: string, message: string) =>
  new AdminApiError(400, "invalid_request", message, field);

export const internalError = () =>
  new AdminApiError(500, "internal_error", "Внутренняя ошибка сервера. Попробуйте позже");

export function adminErrorResponse(err: AdminApiError, headers?: HeadersInit): Response {
  return Response.json(err.toBody(), { status: err.status, headers });
}
