import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireRoleMock = vi.fn();
const findManyMock = vi.fn();
const aggregateMock = vi.fn();
const createMock = vi.fn();
const moduleFindUniqueMock = vi.fn();
const getDefaultModuleIdMock = vi.fn();

vi.mock("@/shared/lib/rbac", () => ({
  requireRole: (...args: unknown[]) => requireRoleMock(...args),
}));
vi.mock("@/lms/server/repos/default-module", () => ({
  getDefaultModuleId: (...args: unknown[]) => getDefaultModuleIdMock(...args),
}));
vi.mock("@/shared/lib/db", () => {
  const lesson = {
    findMany: (...args: unknown[]) => findManyMock(...args),
    aggregate: (...args: unknown[]) => aggregateMock(...args),
    create: (...args: unknown[]) => createMock(...args),
  };
  return {
    db: {
      lesson,
      module: { findUnique: (...args: unknown[]) => moduleFindUniqueMock(...args) },
      $transaction: (fn: (tx: unknown) => unknown) => fn({ lesson }),
    },
  };
});

function makeRequest(query = "") {
  return new NextRequest(`http://localhost/api/admin/lessons${query}`);
}

const lessonRow = (id: string, order: number) => ({
  id,
  title: `Lesson ${id}`,
  description: "",
  content: "",
  order,
  isPublished: true,
});

beforeEach(() => {
  requireRoleMock.mockReset();
  findManyMock.mockReset();
  aggregateMock.mockReset();
  createMock.mockReset();
  moduleFindUniqueMock.mockReset();
  getDefaultModuleIdMock.mockReset();
  createMock.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ id: "new_1", ...data }));
  requireRoleMock.mockResolvedValue({ id: "admin_1", role: "ADMIN" });
});

describe("GET /api/admin/lessons", () => {
  it("requests limit+1 rows ordered by order,id and returns nextCursor: null with no extra row", async () => {
    findManyMock.mockResolvedValue([lessonRow("l1", 1)]);
    const { GET } = await import("./route");

    const res = await GET(makeRequest("?limit=5"));
    const json = await res.json();

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ order: "asc" }, { id: "asc" }],
        take: 6,
      }),
    );
    expect(json.lessons).toHaveLength(1);
    expect(json.nextCursor).toBeNull();
  });

  it("trims the extra row and returns the last item's id as nextCursor", async () => {
    findManyMock.mockResolvedValue([lessonRow("l1", 1), lessonRow("l2", 2)]);
    const { GET } = await import("./route");

    const res = await GET(makeRequest("?limit=1"));
    const json = await res.json();

    expect(json.lessons).toHaveLength(1);
    expect(json.nextCursor).toBe("l1");
  });

  it("passes the cursor query param through to Prisma's cursor/skip", async () => {
    findManyMock.mockResolvedValue([]);
    const { GET } = await import("./route");

    await GET(makeRequest("?cursor=l9"));

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: "l9" }, skip: 1 }),
    );
  });
});

function postRequest(body?: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/admin/lessons", {
    method: "POST",
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe("POST /api/admin/lessons", () => {
  it("appends to the default module, scoping max(order) to that module", async () => {
    getDefaultModuleIdMock.mockResolvedValue("default_module");
    aggregateMock.mockResolvedValue({ _max: { order: 3 } });
    const { POST } = await import("./route");

    const res = await POST(postRequest());
    const json = await res.json();

    expect(aggregateMock).toHaveBeenCalledWith({ where: { moduleId: "default_module" }, _max: { order: true } });
    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ moduleId: "default_module", order: 4, isPublished: false }),
    });
    expect(json.ok).toBe(true);
  });

  it("creates into the requested module starting at 1 when it is empty", async () => {
    moduleFindUniqueMock.mockResolvedValue({ id: "module_9" });
    aggregateMock.mockResolvedValue({ _max: { order: null } });
    const { POST } = await import("./route");

    await POST(postRequest({ module_id: "module_9" }));

    expect(getDefaultModuleIdMock).not.toHaveBeenCalled();
    expect(createMock).toHaveBeenCalledWith({ data: expect.objectContaining({ moduleId: "module_9", order: 1 }) });
  });

  it("rejects an unknown module_id", async () => {
    moduleFindUniqueMock.mockResolvedValue(null);
    const { POST } = await import("./route");

    const res = await POST(postRequest({ module_id: "nope" }));

    expect(res.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });
});
