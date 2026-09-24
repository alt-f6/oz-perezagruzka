import { describe, it, expect, vi, beforeEach } from "vitest";

const enrollmentFindManyMock = vi.fn();
const enrollmentCreateManyMock = vi.fn();
const enrollmentUpdateMock = vi.fn();
const groupFindFirstMock = vi.fn();

vi.mock("@/shared/lib/db", () => {
  const enrollment = {
    findMany: (...args: unknown[]) => enrollmentFindManyMock(...args),
    createMany: (...args: unknown[]) => enrollmentCreateManyMock(...args),
    update: (...args: unknown[]) => enrollmentUpdateMock(...args),
  };
  return {
    db: {
      enrollment,
      group: { findFirst: (...args: unknown[]) => groupFindFirstMock(...args) },
      $transaction: (fn: (tx: unknown) => unknown) => fn({ enrollment }),
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  enrollmentCreateManyMock.mockImplementation(({ data }: { data: unknown[] }) => ({ count: data.length }));
});

describe("enrollStudents", () => {
  it("creates new enrollments with the requested access and source group", async () => {
    enrollmentFindManyMock.mockResolvedValue([]);
    const { enrollStudents } = await import("./enrollments");

    const result = await enrollStudents({ courseId: "c1", studentIds: ["s1", "s2"], accessThrough: 1, sourceGroupId: "g1" });

    expect(enrollmentCreateManyMock).toHaveBeenCalledWith({
      data: [
        { studentId: "s1", courseId: "c1", status: "ACTIVE", accessThroughModule: 1, sourceGroupId: "g1" },
        { studentId: "s2", courseId: "c1", status: "ACTIVE", accessThroughModule: 1, sourceGroupId: "g1" },
      ],
      skipDuplicates: true,
    });
    expect(result).toEqual({ created: 2, reactivated: 0, widened: 0, unchanged: 0 });
  });

  it("reactivates, widens, or leaves existing enrollments -- never narrows", async () => {
    enrollmentFindManyMock.mockResolvedValue([
      { id: "e1", studentId: "s1", status: "SUSPENDED", accessThroughModule: 3 },
      { id: "e2", studentId: "s2", status: "ACTIVE", accessThroughModule: 1 },
      { id: "e3", studentId: "s3", status: "ACTIVE", accessThroughModule: null },
    ]);
    const { enrollStudents } = await import("./enrollments");

    const result = await enrollStudents({ courseId: "c1", studentIds: ["s1", "s2", "s3"], accessThrough: 2 });

    expect(enrollmentCreateManyMock).not.toHaveBeenCalled();
    expect(enrollmentUpdateMock).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { status: "ACTIVE", completedAt: null, accessThroughModule: 3 },
    });
    expect(enrollmentUpdateMock).toHaveBeenCalledWith({
      where: { id: "e2" },
      data: { status: "ACTIVE", completedAt: null, accessThroughModule: 2 },
    });
    expect(enrollmentUpdateMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ created: 0, reactivated: 1, widened: 1, unchanged: 1 });
  });

  it("is a no-op for an empty list", async () => {
    const { enrollStudents } = await import("./enrollments");
    expect(await enrollStudents({ courseId: "c1", studentIds: [], accessThrough: null })).toEqual({
      created: 0,
      reactivated: 0,
      widened: 0,
      unchanged: 0,
    });
    expect(enrollmentFindManyMock).not.toHaveBeenCalled();
  });
});

describe("resolveGroupSnapshot", () => {
  const member = (id: string, fullName: string, userId: string | null, role = "STUDENT") => ({
    student: { id, fullName, userId, user: userId ? { role } : null },
  });

  it("splits members into to-enroll / already-enrolled / without LMS account, deduping logins", async () => {
    groupFindFirstMock.mockResolvedValue({
      id: "g1",
      name: "ЕГЭ Мат 11А",
      students: [
        member("st1", "Аня", "u1"),
        member("st2", "Боря", "u2"),
        member("st3", "Вика", null),
        member("st4", "Аня (дубль)", "u1"),
        member("st5", "Гоша", "u5", "PARENT"),
      ],
    });
    enrollmentFindManyMock.mockResolvedValue([{ studentId: "u2" }]);
    const { resolveGroupSnapshot } = await import("./enrollments");

    const snap = await resolveGroupSnapshot("g1", "c1");

    expect(groupFindFirstMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "g1", deletedAt: null } }));
    expect(snap).toEqual({
      group: { id: "g1", name: "ЕГЭ Мат 11А" },
      toEnroll: [{ userId: "u1", fullName: "Аня (дубль)" }],
      alreadyEnrolled: [{ userId: "u2", fullName: "Боря" }],
      withoutAccount: [
        { studentId: "st3", fullName: "Вика" },
        { studentId: "st5", fullName: "Гоша" },
      ],
    });
  });

  it("returns null for a missing or deleted group", async () => {
    groupFindFirstMock.mockResolvedValue(null);
    const { resolveGroupSnapshot } = await import("./enrollments");
    expect(await resolveGroupSnapshot("nope", "c1")).toBeNull();
  });
});
