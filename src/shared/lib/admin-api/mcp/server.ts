import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createLogger } from "@/shared/lib/logger";
import { assertScopes, type AdminPrincipal } from "../auth";
import { AdminApiError, internalError } from "../errors";
import type { AdminScope } from "../scopes";
import { getCourseAccess, getStudentAccess } from "../services/access.service";
import { listAuditLog } from "../services/audit.service";
import { getCourseTree, getLesson, listCourses } from "../services/courses.service";
import { listGroups } from "../services/groups.service";
import { findStudents } from "../services/students.service";

// Remote MCP surface over the SAME domain services as REST /api/admin/v1, so
// both paths share one set of queries, one PII boundary, one error contract.
// Every tool here is read-only.

const log = createLogger("admin-api:mcp");

export const MCP_SERVER_INFO = { name: "perezagruzka-lms-admin", version: "1.0.0" } as const;

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

function ok(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function fail(err: AdminApiError): CallToolResult {
  return { isError: true, content: [{ type: "text", text: JSON.stringify(err.toBody()) }] };
}

/** Scope check + the same "no raw errors out" rule as withAdminApiGuard. */
async function run(
  principal: AdminPrincipal,
  scopes: readonly AdminScope[],
  tool: string,
  fn: () => Promise<unknown>,
): Promise<CallToolResult> {
  try {
    assertScopes(principal, scopes);
    return ok(await fn());
  } catch (err) {
    if (err instanceof AdminApiError) return fail(err);
    log.error("unhandled mcp tool error", err, { tool, tokenId: principal.tokenId });
    return fail(internalError());
  }
}

const idArg = (what: string) => z.string().min(1).max(64).describe(`id ${what}`);

export function createAdminMcpServer(principal: AdminPrincipal): McpServer {
  const server = new McpServer(MCP_SERVER_INFO);

  server.registerTool(
    "lms_list_courses",
    {
      title: "Курсы",
      description: "Список курсов школы со статусами",
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional().describe("Сколько курсов вернуть (по умолчанию 50)"),
        cursor: z.string().max(64).optional().describe("nextCursor из предыдущего ответа"),
      },
      annotations: READ_ONLY,
    },
    async ({ limit, cursor }) => run(principal, ["content:read"], "lms_list_courses", () => listCourses({ limit, cursor })),
  );

  server.registerTool(
    "lms_get_course",
    {
      title: "Курс",
      description: "Курс целиком: модули, уроки, материалы",
      inputSchema: { courseId: idArg("курса") },
      annotations: READ_ONLY,
    },
    async ({ courseId }) => run(principal, ["content:read"], "lms_get_course", () => getCourseTree(courseId)),
  );

  server.registerTool(
    "lms_get_lesson",
    {
      title: "Урок",
      description: "Один урок со всеми блоками",
      inputSchema: { lessonId: idArg("урока") },
      annotations: READ_ONLY,
    },
    async ({ lessonId }) => run(principal, ["content:read"], "lms_get_lesson", () => getLesson(lessonId)),
  );

  server.registerTool(
    "lms_find_student",
    {
      title: "Поиск ученика",
      description:
        "Найти ученика по почте, телефону, фамилии. Возвращает не более 10 записей: id, имя (Имя Ф.), класс, группа",
      inputSchema: { query: z.string().min(2).max(100).describe("Почта, телефон или фамилия") },
      annotations: READ_ONLY,
    },
    async ({ query }) =>
      run(principal, ["students:read"], "lms_find_student", async () => ({ items: await findStudents(query) })),
  );

  server.registerTool(
    "lms_student_access",
    {
      title: "Доступы ученика",
      description: "Что открыто ученику: курсы (активные, отозванные, завершённые) и отдельные уроки",
      inputSchema: { studentId: idArg("ученика из lms_find_student") },
      annotations: READ_ONLY,
    },
    async ({ studentId }) =>
      run(principal, ["students:read"], "lms_student_access", () => getStudentAccess(studentId)),
  );

  server.registerTool(
    "lms_course_access",
    {
      title: "Доступ к курсу",
      description: "У кого есть доступ к курсу",
      inputSchema: { courseId: idArg("курса") },
      annotations: READ_ONLY,
    },
    async ({ courseId }) =>
      run(principal, ["content:read", "students:read"], "lms_course_access", () => getCourseAccess(courseId)),
  );

  server.registerTool(
    "lms_list_groups",
    {
      title: "Группы",
      description: "Учебные группы",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => run(principal, ["students:read"], "lms_list_groups", () => listGroups()),
  );

  server.registerTool(
    "lms_audit_log",
    {
      title: "Журнал",
      description: "Журнал своих действий (изменения через админ-API), новые сверху",
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional().describe("Сколько записей вернуть (по умолчанию 50)"),
        before: z.string().max(64).optional().describe("nextBefore из предыдущего ответа или дата ISO 8601"),
      },
      annotations: READ_ONLY,
    },
    async ({ limit, before }) =>
      run(principal, ["content:read"], "lms_audit_log", () => listAuditLog({ limit, before })),
  );

  return server;
}
