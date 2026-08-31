import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  group: { findUnique: vi.fn() },
  classSession: {
    createMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const rbacMock = vi.hoisted(() => ({
  requireRole: vi.fn(),
}));

vi.mock("@/shared/lib/db", () => ({ db: dbMock }));
vi.mock("@/shared/lib/rbac", () => rbacMock);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { createLesson, deleteLesson, bulkCancelSessions } = await import("./actions");

const ADMIN = { id: "user_1", email: "a@a.com", role: "ADMIN" };

beforeEach(() => {
  vi.clearAllMocks();
  rbacMock.requireRole.mockResolvedValue(ADMIN);
});

describe("createLesson", () => {
  it("passes durationMinutes through to createMany", async () => {
    dbMock.group.findUnique.mockResolvedValue({ teacherId: "teacher_1" });
    dbMock.classSession.createMany.mockResolvedValue({ count: 1 });

    await createLesson({
      groupId: "11111111-1111-4111-8111-111111111111",
      date: "2026-09-01",
      time: "15:00",
      durationMinutes: 90,
      recurrence: "NONE",
      recurrenceDays: [],
      recurrenceEndDate: "",
    });

    expect(dbMock.classSession.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ durationMinutes: 90 })],
    });
  });

  it("persists the exact local calendar day (no UTC 31st→30th shift)", async () => {
    dbMock.group.findUnique.mockResolvedValue({ teacherId: "teacher_1" });
    dbMock.classSession.createMany.mockResolvedValue({ count: 1 });

    await createLesson({
      groupId: "11111111-1111-4111-8111-111111111111",
      date: "2026-08-31",
      time: "09:00",
      durationMinutes: 60,
      recurrence: "NONE",
      recurrenceDays: [],
      recurrenceEndDate: "",
    });

    const { scheduledAt } = dbMock.classSession.createMany.mock.calls[0][0].data[0];
    expect(scheduledAt.getFullYear()).toBe(2026);
    expect(scheduledAt.getMonth()).toBe(7); // August
    expect(scheduledAt.getDate()).toBe(31); // not 30
    expect(scheduledAt.getHours()).toBe(9);
  });

  it("applies independent per-day time and duration overrides across a series", async () => {
    dbMock.group.findUnique.mockResolvedValue({ teacherId: "teacher_1" });
    dbMock.classSession.createMany.mockResolvedValue({ count: 2 });

    // 2026-09-07 is a Monday. Custom series on Mon (1) and Sat (6),
    // Mon at 15:00·60min but Sat at 10:00·90min. One week window.
    await createLesson({
      groupId: "11111111-1111-4111-8111-111111111111",
      date: "2026-09-07",
      time: "15:00",
      durationMinutes: 60,
      recurrence: "CUSTOM",
      recurrenceDays: [1, 6],
      recurrenceEndDate: "2026-09-13",
      daySlots: [
        { day: 1, time: "15:00", durationMinutes: 60 },
        { day: 6, time: "10:00", durationMinutes: 90 },
      ],
    });

    const rows = dbMock.classSession.createMany.mock.calls[0][0].data as {
      scheduledAt: Date;
      durationMinutes: number;
    }[];
    const byDay = rows.map((r) => ({
      weekday: r.scheduledAt.getDay(),
      hours: r.scheduledAt.getHours(),
      durationMinutes: r.durationMinutes,
    }));

    expect(byDay).toContainEqual({ weekday: 1, hours: 15, durationMinutes: 60 });
    expect(byDay).toContainEqual({ weekday: 6, hours: 10, durationMinutes: 90 });
  });

  it("falls back to the default time/duration for days without an override", async () => {
    dbMock.group.findUnique.mockResolvedValue({ teacherId: "teacher_1" });
    dbMock.classSession.createMany.mockResolvedValue({ count: 2 });

    await createLesson({
      groupId: "11111111-1111-4111-8111-111111111111",
      date: "2026-09-07", // Monday
      time: "18:00",
      durationMinutes: 45,
      recurrence: "CUSTOM",
      recurrenceDays: [1, 3], // Mon + Wed
      recurrenceEndDate: "2026-09-13",
      daySlots: [{ day: 3, time: "12:00", durationMinutes: 120 }], // only Wed overridden
    });

    const rows = dbMock.classSession.createMany.mock.calls[0][0].data as {
      scheduledAt: Date;
      durationMinutes: number;
    }[];
    const mon = rows.find((r) => r.scheduledAt.getDay() === 1)!;
    const wed = rows.find((r) => r.scheduledAt.getDay() === 3)!;

    expect(mon.scheduledAt.getHours()).toBe(18);
    expect(mon.durationMinutes).toBe(45);
    expect(wed.scheduledAt.getHours()).toBe(12);
    expect(wed.durationMinutes).toBe(120);
  });

  it("rejects scheduling for a group with no assigned teacher", async () => {
    dbMock.group.findUnique.mockResolvedValue({ teacherId: null });

    const result = await createLesson({
      groupId: "11111111-1111-4111-8111-111111111111",
      date: "2026-09-01",
      time: "15:00",
      durationMinutes: 90,
      recurrence: "NONE",
      recurrenceDays: [],
      recurrenceEndDate: "",
    });

    expect(result?.error).toBeTruthy();
    expect(dbMock.classSession.createMany).not.toHaveBeenCalled();
  });
});

describe("deleteLesson", () => {
  it("soft-cancels a future scheduled session instead of deleting it", async () => {
    dbMock.classSession.findUnique.mockResolvedValue({
      status: "scheduled",
      scheduledAt: new Date(Date.now() + 86_400_000),
    });
    dbMock.classSession.update.mockResolvedValue({});

    const result = await deleteLesson("session_1");

    expect(dbMock.classSession.update).toHaveBeenCalledWith({
      where: { id: "session_1" },
      data: { status: "cancelled" },
    });
    expect(result.error).toBeUndefined();
  });

  it("refuses to cancel a session already in the past", async () => {
    dbMock.classSession.findUnique.mockResolvedValue({
      status: "scheduled",
      scheduledAt: new Date(Date.now() - 86_400_000),
    });

    const result = await deleteLesson("session_1");

    expect(result.error).toBeTruthy();
    expect(dbMock.classSession.update).not.toHaveBeenCalled();
  });

  it("refuses to cancel a session that is already cancelled", async () => {
    dbMock.classSession.findUnique.mockResolvedValue({
      status: "cancelled",
      scheduledAt: new Date(Date.now() + 86_400_000),
    });

    const result = await deleteLesson("session_1");

    expect(result.error).toBeTruthy();
    expect(dbMock.classSession.update).not.toHaveBeenCalled();
  });
});

describe("bulkCancelSessions", () => {
  function runWithTx(targets: { id: string; status: string; scheduledAt: Date }[]) {
    dbMock.classSession.findMany.mockResolvedValue(targets);
    dbMock.classSession.updateMany.mockResolvedValue({ count: targets.length });
    dbMock.$transaction.mockImplementation(async (cb: (tx: typeof dbMock) => unknown) => cb(dbMock));
  }

  it("cancels only future+scheduled sessions among an arbitrary id selection", async () => {
    runWithTx([
      { id: "a", status: "scheduled", scheduledAt: new Date(Date.now() + 86_400_000) },
      { id: "b", status: "scheduled", scheduledAt: new Date(Date.now() - 86_400_000) }, // past
      { id: "c", status: "cancelled", scheduledAt: new Date(Date.now() + 86_400_000) }, // already cancelled
    ]);

    const result = await bulkCancelSessions({ sessionIds: ["a", "b", "c"] });

    expect(dbMock.classSession.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["a"] } },
      data: { status: "cancelled" },
    });
    expect(result).toMatchObject({ cancelledCount: 1, skippedCount: 2 });
  });

  it("resolves targets by recurrenceGroupId", async () => {
    runWithTx([{ id: "a", status: "scheduled", scheduledAt: new Date(Date.now() + 86_400_000) }]);

    await bulkCancelSessions({ recurrenceGroupId: "series_1" });

    expect(dbMock.classSession.findMany).toHaveBeenCalledWith({
      where: { recurrenceGroupId: "series_1" },
      select: { id: true, status: true, scheduledAt: true },
    });
  });

  it("resolves targets by groupId", async () => {
    runWithTx([{ id: "a", status: "scheduled", scheduledAt: new Date(Date.now() + 86_400_000) }]);

    await bulkCancelSessions({ groupId: "group_1" });

    expect(dbMock.classSession.findMany).toHaveBeenCalledWith({
      where: { groupId: "group_1" },
      select: { id: true, status: true, scheduledAt: true },
    });
  });

  it("skips the updateMany call entirely when nothing is eligible", async () => {
    runWithTx([{ id: "a", status: "cancelled", scheduledAt: new Date(Date.now() + 86_400_000) }]);

    const result = await bulkCancelSessions({ sessionIds: ["a"] });

    expect(dbMock.classSession.updateMany).not.toHaveBeenCalled();
    expect(result).toMatchObject({ cancelledCount: 0, skippedCount: 1 });
  });

  it("rejects a non-ADMIN/MANAGER caller", async () => {
    rbacMock.requireRole.mockRejectedValue(new Error("forbidden"));

    await expect(bulkCancelSessions({ sessionIds: ["a"] })).rejects.toThrow("forbidden");
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });
});
