import { describe, it, expect, vi, beforeEach } from "vitest";

const countMock = vi.hoisted(() => vi.fn());
vi.mock("@/shared/lib/db", () => ({
  db: { assignment: { count: (...args: unknown[]) => countMock(...args) } },
}));

const { hasTutorAccess } = await import("./has-tutor-access");

beforeEach(() => {
  countMock.mockReset();
});

describe("hasTutorAccess", () => {
  it("returns true when the student has at least one assignment", async () => {
    countMock.mockResolvedValue(1);

    const result = await hasTutorAccess("stu-1");

    expect(result).toBe(true);
    expect(countMock).toHaveBeenCalledWith({ where: { studentId: "stu-1" } });
  });

  it("returns false when the student has no assignments", async () => {
    countMock.mockResolvedValue(0);

    const result = await hasTutorAccess("stu-2");

    expect(result).toBe(false);
  });
});
