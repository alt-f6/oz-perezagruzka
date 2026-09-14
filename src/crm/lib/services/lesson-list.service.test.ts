import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();
const countMock = vi.fn();

vi.mock("@/shared/lib/db", () => ({
  db: {
    classSession: {
      findMany: (...args: unknown[]) => findManyMock(...args),
      count: (...args: unknown[]) => countMock(...args),
    },
  },
}));

import { listLessonsPage } from "./lesson-list.service";
import { lessonListFiltersSchema } from "@/crm/lib/schemas";

function filters(overrides: Partial<Parameters<typeof lessonListFiltersSchema.parse>[0]> = {}) {
  return lessonListFiltersSchema.parse(overrides);
}

const NOW = new Date("2026-03-12T09:00:00.000Z");

beforeEach(() => {
  findManyMock.mockReset();
  countMock.mockReset();
});

describe("listLessonsPage RBAC scoping", () => {
  it("scopes a TEACHER to their own sessions or their group's sessions only", async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);

    await listLessonsPage({ sessionUser: { id: "t1", role: "TEACHER" }, filters: filters(), now: NOW });

    const call = findManyMock.mock.calls[0][0];
    expect(call.where.AND).toContainEqual({
      OR: [{ teacherId: "t1" }, { group: { teacherId: "t1" } }],
    });
  });

  it("ignores an explicit teacherId filter for a TEACHER (always self-scoped)", async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);

    await listLessonsPage({
      sessionUser: { id: "t1", role: "TEACHER" },
      filters: filters({ teacherId: "550e8400-e29b-41d4-a716-446655440099" }),
      now: NOW,
    });

    const call = findManyMock.mock.calls[0][0];
    expect(call.where.AND).toContainEqual({ OR: [{ teacherId: "t1" }, { group: { teacherId: "t1" } }] });
    expect(call.where.AND).not.toContainEqual(
      expect.objectContaining({ OR: [{ teacherId: "550e8400-e29b-41d4-a716-446655440099" }, expect.anything()] }),
    );
  });

  it("applies an admin-chosen teacherId filter without self-scoping", async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);

    await listLessonsPage({
      sessionUser: { id: "admin1", role: "ADMIN" },
      filters: filters({ teacherId: "550e8400-e29b-41d4-a716-446655440099" }),
      now: NOW,
    });

    const call = findManyMock.mock.calls[0][0];
    expect(call.where.AND).toContainEqual({
      OR: [
        { teacherId: "550e8400-e29b-41d4-a716-446655440099" },
        { group: { teacherId: "550e8400-e29b-41d4-a716-446655440099" } },
      ],
    });
  });
});

describe("listLessonsPage filtering and pagination", () => {
  it("applies format and search filters and paginates via skip/take", async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);

    await listLessonsPage({
      sessionUser: { id: "admin1", role: "ADMIN" },
      filters: filters({ format: "GROUP", q: "Иванов", page: 2, pageSize: 10 }),
      now: NOW,
    });

    const call = findManyMock.mock.calls[0][0];
    expect(call.where.AND).toContainEqual({ type: "GROUP" });
    expect(call.skip).toBe(10);
    expect(call.take).toBe(10);
    expect(countMock).toHaveBeenCalledWith({ where: call.where });
  });

  it("maps raw rows into LessonListRow with computed counts and attendance status", async () => {
    findManyMock.mockResolvedValue([
      {
        id: "s1",
        type: "GROUP",
        groupId: "g1",
        studentId: null,
        teacherId: "t1",
        scheduledAt: new Date("2026-03-01T10:00:00.000Z"),
        durationMinutes: 60,
        pricePerLesson: null,
        isTrial: false,
        status: "scheduled",
        recurrenceGroupId: null,
        teacher: { id: "t1", fullName: "Иванова И.И." },
        group: { id: "g1", name: "Группа A", teacherId: "t1", subject: "Математика", _count: { students: 4 } },
        student: null,
        _count: { attendance: 2 },
      },
    ]);
    countMock.mockResolvedValue(1);

    const result = await listLessonsPage({
      sessionUser: { id: "admin1", role: "ADMIN" },
      filters: filters(),
      now: NOW,
    });

    expect(result.total).toBe(1);
    expect(result.lessons[0].enrolledCount).toBe(4);
    expect(result.lessons[0].markedCount).toBe(2);
    expect(result.lessons[0].attendanceStatus).toBe("PARTIALLY_MARKED");
    expect(result.lessons[0].group).toEqual({ id: "g1", name: "Группа A", teacherId: "t1", studentCount: 4 });
  });

  it("selects only active (non-soft-deleted) students in the group's roster count", async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);

    await listLessonsPage({
      sessionUser: { id: "admin1", role: "ADMIN" },
      filters: filters(),
      now: NOW,
    });

    const call = findManyMock.mock.calls[0][0];
    expect(call.select.group.select._count.select.students).toEqual({
      where: { student: { deletedAt: null } },
    });
  });

  it("post-filters and paginates in memory for the NEEDS_ATTENTION cardinality status", async () => {
    findManyMock.mockResolvedValue([
      {
        id: "unmarked",
        type: "INDIVIDUAL",
        groupId: null,
        studentId: "st1",
        teacherId: "t1",
        scheduledAt: new Date("2026-03-01T10:00:00.000Z"),
        durationMinutes: 60,
        pricePerLesson: 1000,
        isTrial: false,
        status: "scheduled",
        recurrenceGroupId: null,
        teacher: { id: "t1", fullName: "T" },
        group: null,
        student: { id: "st1", fullName: "S" },
        _count: { attendance: 0 },
      },
      {
        id: "completed",
        type: "INDIVIDUAL",
        groupId: null,
        studentId: "st2",
        teacherId: "t1",
        scheduledAt: new Date("2026-03-01T10:00:00.000Z"),
        durationMinutes: 60,
        pricePerLesson: 1000,
        isTrial: false,
        status: "scheduled",
        recurrenceGroupId: null,
        teacher: { id: "t1", fullName: "T" },
        group: null,
        student: { id: "st2", fullName: "S2" },
        _count: { attendance: 1 },
      },
    ]);

    const result = await listLessonsPage({
      sessionUser: { id: "admin1", role: "ADMIN" },
      filters: filters({ status: "NEEDS_ATTENTION" }),
      now: NOW,
    });

    expect(result.total).toBe(1);
    expect(result.lessons).toHaveLength(1);
    expect(result.lessons[0].id).toBe("unmarked");
    expect(countMock).not.toHaveBeenCalled();
  });
});
