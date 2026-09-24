import { describe, it, expect, vi, beforeEach } from "vitest";

const assignmentFindManyMock = vi.fn();
const enrollmentFindManyMock = vi.fn();

vi.mock("@/shared/lib/db", () => ({
  db: {
    assignment: { findMany: (...args: unknown[]) => assignmentFindManyMock(...args) },
    enrollment: { findMany: (...args: unknown[]) => enrollmentFindManyMock(...args) },
  },
}));

const NOW = new Date("2026-09-24T00:00:00Z");

const lesson = (id: string, order: number, completedAt: Date | null = null) => ({
  id,
  title: `L ${id}`,
  description: "",
  order,
  progress: completedAt ? [{ completedAt }] : [],
});

const mod = (id: string, lessons: ReturnType<typeof lesson>[], overrides: Record<string, unknown> = {}) => ({
  id,
  title: `M ${id}`,
  isPublished: true,
  unlockMode: "MANUAL",
  unlockAfterDays: null,
  unlockAt: null,
  lessons,
  ...overrides,
});

const course = (id: string, createdAt: string, modules: ReturnType<typeof mod>[]) => ({
  id,
  title: `C ${id}`,
  createdAt: new Date(createdAt),
  modules,
});

beforeEach(() => {
  vi.clearAllMocks();
  assignmentFindManyMock.mockResolvedValue([]);
  enrollmentFindManyMock.mockResolvedValue([]);
});

async function run() {
  const { getAccessibleLessons } = await import("./accessible-lessons");
  return getAccessibleLessons("s1", NOW);
}

describe("getAccessibleLessons", () => {
  it("only reads the student's own ACTIVE enrollments and published assignments", async () => {
    await run();
    expect(enrollmentFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: { studentId: "s1", status: "ACTIVE" } }));
    expect(assignmentFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentId: "s1", lesson: { isPublished: true } } }),
    );
  });

  it("opens only the first N modules for an abonement cursor", async () => {
    enrollmentFindManyMock.mockResolvedValue([
      {
        enrolledAt: new Date("2026-01-01"),
        accessThroughModule: 2,
        course: course("c1", "2026-01-01", [
          mod("m1", [lesson("a", 1)]),
          mod("m2", [lesson("b", 1)]),
          mod("m3", [lesson("c", 1)]),
        ]),
      },
    ]);

    expect((await run()).map((l) => l.id)).toEqual(["a", "b"]);
  });

  it("skips unpublished modules and ones still locked by their drip rule", async () => {
    enrollmentFindManyMock.mockResolvedValue([
      {
        enrolledAt: new Date("2026-09-20T00:00:00Z"),
        accessThroughModule: null,
        course: course("c1", "2026-01-01", [
          mod("m1", [lesson("a", 1)]),
          mod("m2", [lesson("b", 1)], { isPublished: false }),
          mod("m3", [lesson("c", 1)], { unlockMode: "DRIP_ENROLLMENT", unlockAfterDays: 30 }),
        ]),
      },
    ]);

    expect((await run()).map((l) => l.id)).toEqual(["a"]);
  });

  it("merges direct assignments, dedupes, and sorts course -> module -> lesson", async () => {
    enrollmentFindManyMock.mockResolvedValue([
      {
        enrolledAt: new Date("2026-01-01"),
        accessThroughModule: null,
        course: course("c2", "2026-02-01", [mod("m21", [lesson("y", 2), lesson("x", 1)])]),
      },
    ]);
    assignmentFindManyMock.mockResolvedValue([
      // duplicate of an enrolled lesson -> reported once, as "course"
      {
        lesson: {
          ...lesson("x", 1),
          module: { id: "m21", title: "M m21", order: 0, course: { ...course("c2", "2026-02-01", []), modules: [{ id: "m21" }] } },
        },
      },
      // lesson from an older course the student isn't enrolled in
      {
        lesson: {
          ...lesson("p", 3, new Date("2026-09-01")),
          module: {
            id: "m12",
            title: "M m12",
            order: 1,
            course: { ...course("c1", "2026-01-01", []), modules: [{ id: "m11" }, { id: "m12" }] },
          },
        },
      },
    ]);

    const result = await run();

    expect(result.map((l) => [l.id, l.source])).toEqual([
      ["p", "assignment"],
      ["x", "course"],
      ["y", "course"],
    ]);
    expect(result[0]).toMatchObject({ courseTitle: "C c1", moduleTitle: "M m12", completedAt: new Date("2026-09-01"), started: true });
    expect(result[0]).not.toHaveProperty("modulePosition");
  });
});
