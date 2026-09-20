import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  activityLog: { findMany: vi.fn(), count: vi.fn() },
}));

vi.mock("@/shared/lib/db", () => ({ db: dbMock }));

const { parseAuditLogFilters, listAuditLogPage } = await import("./audit-list.service");

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.activityLog.findMany.mockResolvedValue([]);
  dbMock.activityLog.count.mockResolvedValue(0);
});

describe("parseAuditLogFilters", () => {
  it("defaults page to 1 and pageSize to 50 for an empty query", () => {
    expect(parseAuditLogFilters({})).toEqual({
      userId: undefined,
      entityType: undefined,
      q: "",
      page: 1,
      pageSize: 50,
    });
  });

  it("flattens array-valued query params and coerces page/pageSize", () => {
    const parsed = parseAuditLogFilters({ page: ["2"], entityType: "STUDENT", q: "Иванов" });
    expect(parsed).toEqual({ userId: undefined, entityType: "STUDENT", q: "Иванов", page: 2, pageSize: 50 });
  });

  it("falls back to defaults for an invalid entityType instead of throwing", () => {
    expect(() => parseAuditLogFilters({ entityType: "NOT_A_TYPE" })).not.toThrow();
    expect(parseAuditLogFilters({ entityType: "NOT_A_TYPE" }).entityType).toBeUndefined();
  });
});

describe("listAuditLogPage", () => {
  it("applies userId, entityType, and pagination to the Prisma query", async () => {
    await listAuditLogPage({ userId: "u1", entityType: "STUDENT", q: "", page: 2, pageSize: 25 });

    expect(dbMock.activityLog.findMany).toHaveBeenCalledWith({
      where: { userId: "u1", entityType: "STUDENT" },
      orderBy: { createdAt: "desc" },
      skip: 25,
      take: 25,
    });
    expect(dbMock.activityLog.count).toHaveBeenCalledWith({
      where: { userId: "u1", entityType: "STUDENT" },
    });
  });

  it("builds a case-insensitive OR search across entityTitle and userName", async () => {
    await listAuditLogPage({ userId: undefined, entityType: undefined, q: "Смирнова", page: 1, pageSize: 50 });

    expect(dbMock.activityLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { entityTitle: { contains: "Смирнова", mode: "insensitive" } },
            { userName: { contains: "Смирнова", mode: "insensitive" } },
          ],
        },
      }),
    );
  });

  it("returns total/page/pageSize alongside the rows", async () => {
    dbMock.activityLog.count.mockResolvedValue(3);
    const result = await listAuditLogPage({ userId: undefined, entityType: undefined, q: "", page: 1, pageSize: 50 });

    expect(result.total).toBe(3);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(50);
  });
});
