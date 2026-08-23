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
