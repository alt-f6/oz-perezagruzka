import { describe, it, expect, vi, beforeEach } from "vitest";

// A redirect spy: loadScheduleData must NEVER invoke navigation. If it ever
// imported and called redirect() on a data error, this would catch it.
const redirectSpy = vi.fn(() => {
  throw new Error("redirect() must not be called from schedule data loading");
});
vi.mock("next/navigation", () => ({ redirect: redirectSpy }));

vi.mock("@/shared/lib/logger", () => ({
  createLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));

const classSessionFindMany = vi.fn();
const groupFindMany = vi.fn();
const userFindMany = vi.fn();
const studentFindMany = vi.fn();
vi.mock("@/shared/lib/db", () => ({
  db: {
    classSession: { findMany: (...a: unknown[]) => classSessionFindMany(...a) },
    group: { findMany: (...a: unknown[]) => groupFindMany(...a) },
    user: { findMany: (...a: unknown[]) => userFindMany(...a) },
    student: { findMany: (...a: unknown[]) => studentFindMany(...a) },
  },
}));

describe("loadScheduleData — fail-safe fetching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    classSessionFindMany.mockResolvedValue([]);
    groupFindMany.mockResolvedValue([]);
    userFindMany.mockResolvedValue([]);
    studentFindMany.mockResolvedValue([]);
  });

  it("returns ok with data on success", async () => {
    classSessionFindMany.mockResolvedValue([{ id: "l1" }]);
    const { loadScheduleData } = await import("./schedule-data");
    const res = await loadScheduleData({ id: "u1", role: "ADMIN" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.lessons).toHaveLength(1);
  });

  it("resolves to a graceful error state when a query rejects — it does NOT throw", async () => {
    classSessionFindMany.mockRejectedValue(new Error("db timeout"));
    const { loadScheduleData } = await import("./schedule-data");

    // The promise must resolve (not reject); a thrown error here would bubble
    // past the page and could not be rendered as a local state.
    const res = await loadScheduleData({ id: "u1", role: "ADMIN" });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/расписание/i);
  });

  it("never triggers a redirect on a data failure", async () => {
    groupFindMany.mockRejectedValue(new Error("missing relation"));
    const { loadScheduleData } = await import("./schedule-data");

    await loadScheduleData({ id: "u1", role: "TEACHER" });

    expect(redirectSpy).not.toHaveBeenCalled();
  });

  it("scopes teacher queries to their own id and skips the student list", async () => {
    const { loadScheduleData } = await import("./schedule-data");
    await loadScheduleData({ id: "teacher-9", role: "TEACHER" });

    expect(classSessionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { teacherId: "teacher-9" } }),
    );
    // Teachers can't create lessons, so the (expensive) student list is skipped.
    expect(studentFindMany).not.toHaveBeenCalled();
  });
});
