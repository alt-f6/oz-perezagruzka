import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { hashAdminToken } from "@/shared/lib/admin-api/auth";

// ── Mocks ────────────────────────────────────────────────────────────────────

const dbMock = vi.hoisted(() => ({
  adminToken: { findUnique: vi.fn(), update: vi.fn() },
  adminAuditLog: { findMany: vi.fn(), findUnique: vi.fn() },
  student: { findMany: vi.fn(), findFirst: vi.fn() },
  user: { findMany: vi.fn(), findFirst: vi.fn() },
  course: { findMany: vi.fn(), findUnique: vi.fn() },
  lesson: { findUnique: vi.fn() },
  enrollment: { findMany: vi.fn() },
  assignment: { findMany: vi.fn() },
  group: { findMany: vi.fn() },
}));
vi.mock("@/shared/lib/db", () => ({ db: dbMock }));

const sessionMock = vi.hoisted(() => ({ getSessionUserFromRequest: vi.fn() }));
vi.mock("@/shared/lib/auth", () => ({
  CRM_ROLES: ["ADMIN", "MANAGER", "TEACHER"],
  LMS_ROLES: ["ADMIN", "MANAGER", "TEACHER", "STUDENT"],
  getSessionUserFromRequest: sessionMock.getSessionUserFromRequest,
}));

const { formatSafeStudentName, scrubPiiFromPayload, REDACTED } = await import("@/shared/lib/admin-api/pii");
const { toMoscowIso } = await import("@/shared/lib/admin-api/time");
const { LAST_USED_DEBOUNCE_MS } = await import("@/shared/lib/admin-api/auth");
const studentsRoute = await import("../../app/api/admin/v1/students/route");
const auditRoute = await import("../../app/api/admin/v1/audit/route");
const coursesRoute = await import("../../app/api/admin/v1/courses/route");
const courseAccessRoute = await import("../../app/api/admin/v1/courses/[id]/access/route");
const mcpRoute = await import("../../app/api/mcp/route");
const { proxy, isMachineApiPath } = await import("../../proxy");

// ── Helpers ──────────────────────────────────────────────────────────────────

const RAW_TOKEN = "pzg_admin_test-token";
const ALL_SCOPES = ["content:read", "content:write", "publish", "files:write", "students:read", "access:write"];

function activeToken(scopes: string[] = ALL_SCOPES, extra: Record<string, unknown> = {}) {
  return { id: "11111111-1111-4111-8111-111111111111", name: "test", scopes, revokedAt: null, lastUsedAt: null, ...extra };
}

function apiRequest(path: string, token: string | null = RAW_TOKEN, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  return new Request(`https://lms.perezagruzka-edu.ru${path}`, { ...init, headers });
}

const noParams = { params: Promise.resolve({}) } as never;

// Any of these showing up anywhere in a serialized response is a leak.
const PII_KEYS = ["phone", "email", "balance", "parentPhone", "parentName", "passwordHash", "birthDate"];
const PII_VALUES = ["+79991234567", "79991234567", "marat@example.com", "parent@example.com", "Алиев", "Алиева Зарема", "15000.00"];

function assertNoPii(payload: unknown) {
  const text = JSON.stringify(payload);
  for (const v of PII_VALUES) expect(text).not.toContain(v);
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        expect(PII_KEYS).not.toContain(k);
        walk(v);
      }
    }
  };
  walk(payload);
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.adminToken.findUnique.mockResolvedValue(activeToken());
  dbMock.adminToken.update.mockResolvedValue({});
  sessionMock.getSessionUserFromRequest.mockResolvedValue(null);
});

// ── Auth ─────────────────────────────────────────────────────────────────────

describe("admin API auth", () => {
  it("401 without an Authorization header, without touching the DB", async () => {
    const res = await coursesRoute.GET(apiRequest("/api/admin/v1/courses", null), noParams);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "unauthorized", message: "Токен недействителен или отозван" },
    });
    expect(dbMock.adminToken.findUnique).not.toHaveBeenCalled();
  });

  it("401 for a malformed Authorization header", async () => {
    const req = new Request("https://x/api/admin/v1/courses", { headers: { authorization: "Basic abc" } });
    const res = await coursesRoute.GET(req, noParams);
    expect(res.status).toBe(401);
  });

  it("401 for an unknown token, looked up by SHA-256 hash (never the raw value)", async () => {
    dbMock.adminToken.findUnique.mockResolvedValue(null);
    const res = await coursesRoute.GET(apiRequest("/api/admin/v1/courses"), noParams);
    expect(res.status).toBe(401);
    expect(dbMock.adminToken.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: hashAdminToken(RAW_TOKEN) } }),
    );
    expect(JSON.stringify(dbMock.adminToken.findUnique.mock.calls)).not.toContain(RAW_TOKEN);
  });

  it("401 for a revoked token", async () => {
    dbMock.adminToken.findUnique.mockResolvedValue(activeToken(ALL_SCOPES, { revokedAt: new Date() }));
    const res = await coursesRoute.GET(apiRequest("/api/admin/v1/courses"), noParams);
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("unauthorized");
  });

  it("403 when the token lacks the route's scope", async () => {
    dbMock.adminToken.findUnique.mockResolvedValue(activeToken(["content:read"]));
    const res = await studentsRoute.GET(apiRequest("/api/admin/v1/students?query=Алиев"), noParams);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: { code: "forbidden_scope", message: "У токена нет права на это действие" },
    });
    expect(dbMock.student.findMany).not.toHaveBeenCalled();
  });

  it("403 when a multi-scope route is missing one of its scopes", async () => {
    dbMock.adminToken.findUnique.mockResolvedValue(activeToken(["content:read"]));
    const res = await courseAccessRoute.GET(apiRequest("/api/admin/v1/courses/c1/access"), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(403);
  });

  it("debounces lastUsedAt: writes when stale, skips when fresh", async () => {
    dbMock.course.findMany.mockResolvedValue([]);
    dbMock.adminToken.findUnique.mockResolvedValue(
      activeToken(ALL_SCOPES, { lastUsedAt: new Date(Date.now() - LAST_USED_DEBOUNCE_MS - 1000) }),
    );
    await coursesRoute.GET(apiRequest("/api/admin/v1/courses"), noParams);
    expect(dbMock.adminToken.update).toHaveBeenCalledTimes(1);

    dbMock.adminToken.update.mockClear();
    dbMock.adminToken.findUnique.mockResolvedValue(activeToken(ALL_SCOPES, { lastUsedAt: new Date() }));
    await coursesRoute.GET(apiRequest("/api/admin/v1/courses"), noParams);
    expect(dbMock.adminToken.update).not.toHaveBeenCalled();
  });

  it("a failing lastUsedAt write does not fail the request", async () => {
    dbMock.course.findMany.mockResolvedValue([]);
    dbMock.adminToken.update.mockRejectedValue(new Error("pool exhausted"));
    const res = await coursesRoute.GET(apiRequest("/api/admin/v1/courses"), noParams);
    expect(res.status).toBe(200);
  });
});

// ── Error contract ───────────────────────────────────────────────────────────

describe("withAdminApiGuard error contract", () => {
  it("collapses raw Prisma/DB errors into an opaque Russian 500", async () => {
    const prismaLike = Object.assign(new Error('Invalid `db.course.findMany()`: relation "Course" does not exist'), {
      code: "P2021",
    });
    dbMock.course.findMany.mockRejectedValue(prismaLike);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await coursesRoute.GET(apiRequest("/api/admin/v1/courses"), noParams);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: { code: "internal_error", message: expect.stringMatching(/[А-Яа-я]/) } });
    expect(JSON.stringify(body)).not.toMatch(/Course|P2021|relation|findMany/);
    errSpy.mockRestore();
  });

  it("400 with field for an invalid limit", async () => {
    const res = await coursesRoute.GET(apiRequest("/api/admin/v1/courses?limit=5000"), noParams);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatchObject({ code: "invalid_request", field: "limit" });
    expect(body.error.message).toMatch(/[А-Яа-я]/);
  });

  it("400 with field for a too-short student query", async () => {
    const res = await studentsRoute.GET(apiRequest("/api/admin/v1/students?query=a"), noParams);
    expect(res.status).toBe(400);
    expect((await res.json()).error.field).toBe("query");
  });

  it("returns timestamps in Moscow time with explicit offset", async () => {
    dbMock.course.findMany.mockResolvedValue([
      {
        id: "c1",
        title: "ЕГЭ База",
        isPublished: true,
        subject: "math",
        examType: "EGE",
        grade: 11,
        createdAt: new Date("2026-09-26T21:30:00.000Z"),
        updatedAt: new Date("2026-09-26T21:30:00.000Z"),
        modules: [{ _count: { lessons: 3 } }, { _count: { lessons: 2 } }],
      },
    ]);
    const res = await coursesRoute.GET(apiRequest("/api/admin/v1/courses"), noParams);
    const body = await res.json();
    expect(body.items[0]).toMatchObject({
      status: "published",
      lessonCount: 5,
      moduleCount: 2,
      createdAt: "2026-09-27T00:30:00.000+03:00",
    });
    expect(body.nextCursor).toBeNull();
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("toMoscowIso", () => {
  it("renders the same instant with a +03:00 offset", () => {
    const iso = toMoscowIso(new Date("2026-01-01T00:00:00.007Z"));
    expect(iso).toBe("2026-01-01T03:00:00.007+03:00");
    expect(new Date(iso).getTime()).toBe(Date.parse("2026-01-01T00:00:00.007Z"));
  });
});

// ── 152-ФЗ: names ────────────────────────────────────────────────────────────

describe("formatSafeStudentName", () => {
  it.each([
    [null, "Ученик"],
    [undefined, "Ученик"],
    ["", "Ученик"],
    ["   ", "Ученик"],
    ["Марат", "Марат"],
    ["Алиев Марат", "Марат А."],
    ["Алиев Марат К.", "Марат А."],
    ["Алиев Марат Керимович", "Марат А."],
    ["  алиев   марат  ", "марат А."],
    ["Римская-Корсакова Анна", "Анна Р."],
    ["Салтыков-Щедрин Михаил Евграфович", "Михаил С."],
    ["Иванова Анна-Мария", "Анна-Мария И."],
    ["Ёлкин Пётр", "Пётр Ё."],
    ["Иванов Иван +79991234567", "Иван И."],
    ["ivanov@example.com", "Ученик"],
    ["+7 999 123 45 67", "Ученик"],
  ])("%j -> %j", (input, expected) => {
    expect(formatSafeStudentName(input as string | null)).toBe(expected);
  });

  it("never returns the surname", () => {
    expect(formatSafeStudentName("Алиев Марат К.")).not.toContain("Алиев");
  });
});

// ── 152-ФЗ: GET /students ────────────────────────────────────────────────────

function crmStudentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "s-crm-1",
    userId: null,
    fullName: "Алиев Марат К.",
    grade: 11,
    groups: [{ group: { name: "ЕГЭ База 11А" } }],
    // Fields a careless select/spread would leak -- must never surface.
    phone: "+79991234567",
    email: "marat@example.com",
    parentPhone: "+79991234567",
    parentName: "Алиева Зарема",
    balance: "15000.00",
    ...overrides,
  };
}

describe("GET /api/admin/v1/students", () => {
  it.each([["Алиев"], ["+7 (999) 123-45-67"], ["89991234567"], ["marat@example.com"], ["MARAT"]])(
    "query %j: only {id,name,grade,group}, no PII",
    async (query) => {
      dbMock.student.findMany.mockResolvedValue([crmStudentRow()]);
      dbMock.user.findMany.mockResolvedValue([
        {
          id: "u-1",
          fullName: "Алиева Зарема",
          email: "parent@example.com",
          phone: "79991234567",
          students: [{ grade: 9, groups: [] }],
        },
      ]);

      const res = await studentsRoute.GET(
        apiRequest(`/api/admin/v1/students?query=${encodeURIComponent(query)}`),
        noParams,
      );
      expect(res.status).toBe(200);
      const body = await res.json();

      for (const item of body.items) {
        expect(Object.keys(item).sort()).toEqual(["grade", "group", "id", "name"]);
      }
      expect(body.items).toContainEqual({ id: "s-crm-1", name: "Марат А.", grade: "11", group: "ЕГЭ База 11А" });
      expect(body.items).toContainEqual({ id: "u-1", name: "Зарема А.", grade: "9", group: null });
      assertNoPii(body);
    },
  );

  it("searches Student and User by name, email, phone (case-insensitive) incl. digits-only phone", async () => {
    dbMock.student.findMany.mockResolvedValue([]);
    dbMock.user.findMany.mockResolvedValue([]);
    await studentsRoute.GET(apiRequest(`/api/admin/v1/students?query=${encodeURIComponent("8 999 123-45-67")}`), noParams);

    const studentWhere = dbMock.student.findMany.mock.calls[0][0].where;
    const userWhere = dbMock.user.findMany.mock.calls[0][0].where;
    expect(studentWhere.deletedAt).toBeNull();
    expect(userWhere.role).toBe("STUDENT");
    for (const where of [studentWhere, userWhere]) {
      expect(where.OR).toEqual(
        expect.arrayContaining([
          { fullName: { contains: "8 999 123-45-67", mode: "insensitive" } },
          { email: { contains: "8 999 123-45-67", mode: "insensitive" } },
          { phone: { contains: "89991234567", mode: "insensitive" } },
          { phone: { contains: "79991234567", mode: "insensitive" } },
        ]),
      );
    }
    // PII columns are never selected in the first place.
    const studentSelect = dbMock.student.findMany.mock.calls[0][0].select;
    const userSelect = dbMock.user.findMany.mock.calls[0][0].select;
    for (const key of PII_KEYS) {
      expect(studentSelect).not.toHaveProperty(key);
      expect(userSelect).not.toHaveProperty(key);
    }
  });

  it("merges a CRM student with its LMS account and caps results at 10", async () => {
    const users = Array.from({ length: 10 }, (_, i) => ({
      id: `u-${i}`,
      fullName: `Иванов${i} Иван`,
      students: [],
    }));
    dbMock.user.findMany.mockResolvedValue(users);
    dbMock.student.findMany.mockResolvedValue([
      crmStudentRow({ id: "s-linked", userId: "u-0", fullName: "Иванов0 Иван" }),
      ...Array.from({ length: 9 }, (_, i) => crmStudentRow({ id: `s-${i}`, fullName: `Петров${i} Пётр` })),
    ]);

    const res = await studentsRoute.GET(apiRequest("/api/admin/v1/students?query=ов"), noParams);
    const body = await res.json();
    expect(body.items).toHaveLength(10);
    const merged = body.items.find((s: { id: string }) => s.id === "u-0");
    if (merged) expect(merged).toEqual({ id: "u-0", name: "Иван И.", grade: "11", group: "ЕГЭ База 11А" });
    expect(body.items.some((s: { id: string }) => s.id === "s-linked")).toBe(false);
    assertNoPii(body);
  });
});

// ── 152-ФЗ: audit scrubbing ──────────────────────────────────────────────────

describe("scrubPiiFromPayload", () => {
  it("redacts sensitive keys at any depth, including arrays and key variants", () => {
    const input = {
      student: {
        id: "s1",
        fullName: "Алиев Марат К.",
        email: "marat@example.com",
        phone: "+79991234567",
        parent_phone: "+79991234567",
        parentName: "Алиева Зарема",
        contacts: [{ Email: "x@y.ru", PHONE: "8 999 123 45 67", kind: "home" }],
        balance: 15000,
        totalBalance: "15000.00",
        passwordHash: "$2a$10$abc",
        tokenHash: "deadbeef",
        clientSecret: "s3cr3t",
        birthDate: "2009-01-01",
      },
      grade: 11,
    };
    const out = scrubPiiFromPayload(input) as { student: Record<string, unknown>; grade: number };

    expect(out.grade).toBe(11);
    expect(out.student.id).toBe("s1");
    expect(out.student.fullName).toBe("Марат А.");
    for (const key of ["email", "phone", "parent_phone", "parentName", "balance", "totalBalance", "passwordHash", "tokenHash", "clientSecret", "birthDate"]) {
      expect(out.student[key]).toBe(REDACTED);
    }
    const contact = (out.student.contacts as Array<Record<string, unknown>>)[0];
    expect(contact).toEqual({ Email: REDACTED, PHONE: REDACTED, kind: "home" });
    // Keys survive (an audit entry may say "phone changed"); values never do.
    const text = JSON.stringify(out);
    for (const v of [...PII_VALUES, "x@y.ru", "8 999 123 45 67", "$2a$10$abc", "deadbeef", "s3cr3t", "2009-01-01"]) {
      expect(text).not.toContain(v);
    }
  });

  it("masks e-mails and phones embedded in free text but leaves UUIDs and dates alone", () => {
    const out = scrubPiiFromPayload({
      note: "Позвонить +7 (999) 123-45-67 или 89991234567, почта marat@example.com",
      ref: "123e4567-e89b-12d3-a456-426614174000",
      at: "2026-09-26T10:00:00.000Z",
    }) as Record<string, string>;
    expect(out.note).not.toMatch(/999|marat@/);
    expect(out.ref).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(out.at).toBe("2026-09-26T10:00:00.000Z");
  });

  it("keeps group/course titles, does not mutate input, survives cycles", () => {
    const input: Record<string, unknown> = { name: "ЕГЭ База 11А", title: "Производная" };
    input.self = input;
    const out = scrubPiiFromPayload(input) as Record<string, unknown>;
    expect(out.name).toBe("ЕГЭ База 11А");
    expect(out.title).toBe("Производная");
    expect(out.self).toBe(REDACTED);
    expect(input.self).toBe(input);
  });

  it("passes primitives and null through", () => {
    expect(scrubPiiFromPayload(null)).toBeNull();
    expect(scrubPiiFromPayload(5)).toBe(5);
    expect(scrubPiiFromPayload(true)).toBe(true);
  });
});

describe("GET /api/admin/v1/audit", () => {
  it("scrubs nested before/after diffs and reason", async () => {
    dbMock.adminAuditLog.findMany.mockResolvedValue([
      {
        id: "22222222-2222-4222-8222-222222222222",
        createdAt: new Date("2026-09-26T09:00:00.000Z"),
        tokenId: "11111111-1111-4111-8111-111111111111",
        endpoint: "PATCH /api/admin/v1/students/s1/access",
        targetType: "Enrollment",
        targetId: "e1",
        before: { status: "ACTIVE", student: { fullName: "Алиев Марат К.", phone: "+79991234567" } },
        after: {
          status: "SUSPENDED",
          student: { fullName: "Алиев Марат К.", email: "marat@example.com", parents: [{ parentName: "Алиева Зарема", parentPhone: "+79991234567" }] },
          balance: "15000.00",
        },
        reason: "Родитель (marat@example.com, +79991234567) попросил приостановить",
        dryRun: false,
        requestId: "req-1",
      },
    ]);

    const res = await auditRoute.GET(apiRequest("/api/admin/v1/audit?limit=50"), noParams);
    expect(res.status).toBe(200);
    const body = await res.json();
    const text = JSON.stringify(body);
    for (const v of PII_VALUES) expect(text).not.toContain(v);
    expect(body.items[0].after.status).toBe("SUSPENDED");
    expect(body.items[0].after.student.fullName).toBe("Марат А.");
    expect(body.items[0].createdAt).toBe("2026-09-26T12:00:00.000+03:00");
    expect(body.nextBefore).toBeNull();
  });

  it("keyset-paginates with `before` = entry id", async () => {
    const anchor = { id: "22222222-2222-4222-8222-222222222222", createdAt: new Date("2026-09-26T09:00:00Z") };
    dbMock.adminAuditLog.findUnique.mockResolvedValue(anchor);
    dbMock.adminAuditLog.findMany.mockResolvedValue([]);
    await auditRoute.GET(apiRequest(`/api/admin/v1/audit?before=${anchor.id}`), noParams);
    expect(dbMock.adminAuditLog.findMany.mock.calls[0][0].where).toEqual({
      OR: [{ createdAt: { lt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { lt: anchor.id } }],
    });
  });

  it("400 on a garbage `before`", async () => {
    const res = await auditRoute.GET(apiRequest("/api/admin/v1/audit?before=yesterday"), noParams);
    expect(res.status).toBe(400);
    expect((await res.json()).error.field).toBe("before");
  });
});

// ── MCP ──────────────────────────────────────────────────────────────────────

function mcpRequest(body: unknown, token: string | null = RAW_TOKEN) {
  return apiRequest("/api/mcp", token, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify(body),
  });
}

const EXPECTED_TOOLS = [
  "lms_audit_log",
  "lms_course_access",
  "lms_find_student",
  "lms_get_course",
  "lms_get_lesson",
  "lms_list_courses",
  "lms_list_groups",
  "lms_student_access",
];

describe("MCP /api/mcp", () => {
  it("401 without a token", async () => {
    const res = await mcpRoute.POST(mcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" }, null));
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toMatch(/^Bearer/);
  });

  it("GET is 405 for a stateless server (after auth)", async () => {
    expect((await mcpRoute.GET(apiRequest("/api/mcp", null))).status).toBe(401);
    const res = await mcpRoute.GET(apiRequest("/api/mcp"));
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("POST");
  });

  it("initialize succeeds", async () => {
    const res = await mcpRoute.POST(
      mcpRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "vitest", version: "1" } },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.serverInfo.name).toBe("perezagruzka-lms-admin");
    expect(body.result.capabilities.tools).toBeDefined();
  });

  it("lists exactly the 8 read tools, all readOnlyHint: true", async () => {
    const res = await mcpRoute.POST(mcpRequest({ jsonrpc: "2.0", id: 2, method: "tools/list" }));
    expect(res.status).toBe(200);
    const { result } = await res.json();
    const names = result.tools.map((t: { name: string }) => t.name).sort();
    expect(names).toEqual(EXPECTED_TOOLS);
    for (const tool of result.tools) {
      expect(tool.annotations.readOnlyHint).toBe(true);
      expect(tool.annotations.destructiveHint).toBe(false);
    }
  });

  it("lms_find_student goes through the shared service and leaks no PII", async () => {
    dbMock.student.findMany.mockResolvedValue([crmStudentRow()]);
    dbMock.user.findMany.mockResolvedValue([]);
    const res = await mcpRoute.POST(
      mcpRequest({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "lms_find_student", arguments: { query: "+79991234567" } },
      }),
    );
    const { result } = await res.json();
    expect(result.isError).toBeFalsy();
    const payload = JSON.parse(result.content[0].text);
    expect(payload.items).toEqual([{ id: "s-crm-1", name: "Марат А.", grade: "11", group: "ЕГЭ База 11А" }]);
    assertNoPii(payload);
    expect(dbMock.student.findMany).toHaveBeenCalledTimes(1);
  });

  it("enforces per-tool scopes with the same error contract", async () => {
    dbMock.adminToken.findUnique.mockResolvedValue(activeToken(["content:read"]));
    const res = await mcpRoute.POST(
      mcpRequest({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "lms_find_student", arguments: { query: "Алиев" } },
      }),
    );
    const { result } = await res.json();
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text)).toEqual({
      error: { code: "forbidden_scope", message: "У токена нет права на это действие" },
    });
    expect(dbMock.student.findMany).not.toHaveBeenCalled();
  });

  it("hides raw DB errors from tool results", async () => {
    dbMock.group.findMany.mockRejectedValue(new Error('relation "Group" does not exist'));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await mcpRoute.POST(
      mcpRequest({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "lms_list_groups", arguments: {} } }),
    );
    const { result } = await res.json();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).not.toMatch(/relation|Group"/);
    expect(JSON.parse(result.content[0].text).error.code).toBe("internal_error");
    errSpy.mockRestore();
  });
});

// ── proxy.ts ─────────────────────────────────────────────────────────────────

describe("proxy bypass for machine APIs", () => {
  const hosts = ["lms.perezagruzka-edu.ru", "crm.perezagruzka-edu.ru", "perezagruzka-edu.ru"];
  const paths = ["/api/admin/v1/courses", "/api/admin/v1/students/abc/access", "/api/mcp", "/api/mcp/"];

  for (const host of hosts) {
    for (const path of paths) {
      it(`${host}${path}: no rewrite, no redirect, no session lookup, headers untouched`, async () => {
        const req = new NextRequest(`https://${host}${path}`, {
          headers: { host, authorization: `Bearer ${RAW_TOKEN}`, "idempotency-key": "idem-1" },
        });
        const res = await proxy(req);
        expect(res.status).toBe(200);
        expect(res.headers.get("x-middleware-rewrite")).toBeNull();
        expect(res.headers.get("location")).toBeNull();
        expect(res.headers.get("x-middleware-next")).toBe("1");
        // No request-header override -> Authorization / Idempotency-Key pass through as sent.
        expect(res.headers.get("x-middleware-override-headers")).toBeNull();
        expect(sessionMock.getSessionUserFromRequest).not.toHaveBeenCalled();
      });
    }
  }

  it("matches on path-segment boundaries only", () => {
    expect(isMachineApiPath("/api/mcp")).toBe(true);
    expect(isMachineApiPath("/api/admin/v1")).toBe(true);
    expect(isMachineApiPath("/api/mcpx")).toBe(false);
    expect(isMachineApiPath("/api/admin/v10/courses")).toBe(false);
    expect(isMachineApiPath("/api/admin/assignments")).toBe(false);
  });

  it("still guards the existing LMS admin API behind the session", async () => {
    const res = await proxy(
      new NextRequest("https://lms.perezagruzka-edu.ru/api/admin/courses", { headers: { host: "lms.perezagruzka-edu.ru" } }),
    );
    expect(res.status).toBe(307);
    expect(sessionMock.getSessionUserFromRequest).toHaveBeenCalled();
  });
});
