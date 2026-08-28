import { beforeEach, describe, expect, it, vi } from "vitest";

const bulkCancelMock = vi.hoisted(() => vi.fn());
const requireRoleMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
  group: { update: vi.fn() },
  user: { findUnique: vi.fn() },
}));
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("../lessons/actions", () => ({ bulkCancelSessions: bulkCancelMock }));
vi.mock("@/shared/lib/rbac", () => ({ requireRole: requireRoleMock }));
vi.mock("@/shared/lib/db", () => ({ db: dbMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

const { assignTeacherToGroup, cancelGroupUpcomingSessions, updateGroup } =
  await import("./actions");

beforeEach(() => {
  vi.clearAllMocks();
  requireRoleMock.mockResolvedValue({ id: "admin_1", role: "ADMIN" });
});

describe("cancelGroupUpcomingSessions", () => {
  it("delegates to bulkCancelSessions scoped by groupId", async () => {
    bulkCancelMock.mockResolvedValue({ cancelledCount: 3, skippedCount: 1 });

    const result = await cancelGroupUpcomingSessions("group_1");

    expect(bulkCancelMock).toHaveBeenCalledWith({ groupId: "group_1" });
    expect(result).toEqual({ cancelledCount: 3, skippedCount: 1 });
  });
});

describe("assignTeacherToGroup", () => {
  it("requires ADMIN or MANAGER", async () => {
    await assignTeacherToGroup("group_1", "teacher_1");
    expect(requireRoleMock).toHaveBeenCalledWith(["ADMIN", "MANAGER"]);
  });

  it("clears the teacher when passed null", async () => {
    const result = await assignTeacherToGroup("group_1", null);

    expect(result.error).toBeUndefined();
    expect(dbMock.group.update).toHaveBeenCalledWith({
      where: { id: "group_1" },
      data: { teacherId: null },
    });
  });

  it("rejects a teacherId that isn't an active TEACHER", async () => {
    dbMock.user.findUnique.mockResolvedValue({ role: "MANAGER", isArchived: false });

    const result = await assignTeacherToGroup("group_1", "not_a_teacher");

    expect(result.error).toBeTruthy();
    expect(dbMock.group.update).not.toHaveBeenCalled();
  });

  it("rejects an archived teacher", async () => {
    dbMock.user.findUnique.mockResolvedValue({ role: "TEACHER", isArchived: true });

    const result = await assignTeacherToGroup("group_1", "archived_teacher");

    expect(result.error).toBeTruthy();
    expect(dbMock.group.update).not.toHaveBeenCalled();
  });

  it("assigns a valid active teacher", async () => {
    dbMock.user.findUnique.mockResolvedValue({ role: "TEACHER", isArchived: false });

    const result = await assignTeacherToGroup("group_1", "teacher_1");

    expect(result.error).toBeUndefined();
    expect(dbMock.group.update).toHaveBeenCalledWith({
      where: { id: "group_1" },
      data: { teacherId: "teacher_1" },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/groups");
  });
});

describe("updateGroup", () => {
  it("validates input and rejects a bad teacherId before writing", async () => {
    dbMock.user.findUnique.mockResolvedValue(null);

    const result = await updateGroup("group_1", {
      name: "Группа А",
      teacherId: "ghost_teacher",
      price: 500,
    });

    expect(result.error).toBeTruthy();
    expect(dbMock.group.update).not.toHaveBeenCalled();
  });

  it("updates name, teacher, and price together", async () => {
    dbMock.user.findUnique.mockResolvedValue({ role: "TEACHER", isArchived: false });

    const result = await updateGroup("group_1", {
      name: "Группа А",
      teacherId: "11111111-1111-4111-8111-111111111111",
      price: 750,
    });

    expect(result.error).toBeUndefined();
    expect(dbMock.group.update).toHaveBeenCalledWith({
      where: { id: "group_1" },
      data: {
        name: "Группа А",
        teacherId: "11111111-1111-4111-8111-111111111111",
        pricePerLesson: 750,
      },
    });
  });
});
