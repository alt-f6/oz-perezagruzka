import { beforeEach, describe, expect, it, vi } from "vitest";

// SEC-01: financial Server Actions must fail closed for non-ADMIN sessions,
// independent of any page-level guard. A TEACHER who invokes these actions
// directly (URL/RPC tampering) must never read rates/payouts or write payouts.
const getSessionUserMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
  teacherRate: { findMany: vi.fn(), create: vi.fn() },
  teacherPayout: { findMany: vi.fn(), create: vi.fn() },
}));
const computeTeacherSalaryMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/lib/auth", () => ({ getSessionUser: getSessionUserMock }));
vi.mock("@/shared/lib/db", () => ({ db: dbMock }));
vi.mock("@/crm/lib/services/salary.service", () => ({
  computeTeacherSalary: computeTeacherSalaryMock,
}));
vi.mock("@/shared/lib/logger", () => ({
  createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}));

const {
  getTeacherRates,
  getTeacherPayouts,
  addTeacherRate,
  calculateTeacherSalary,
  createTeacherPayout,
} = await import("./actions");

const TEACHER = { id: "teacher_1", email: "t@t.com", role: "TEACHER" as const };
const VALID_RATE = {
  teacherId: "11111111-1111-4111-8111-111111111111",
  rateType: "FIXED_PER_LESSON" as const,
  value: 1000,
};
const VALID_PERIOD = {
  teacherId: "11111111-1111-4111-8111-111111111111",
  periodFrom: "2026-09-01",
  periodTo: "2026-09-30",
};

beforeEach(() => {
  vi.clearAllMocks();
  getSessionUserMock.mockResolvedValue(TEACHER);
});

describe("salary actions reject a TEACHER session (SEC-01)", () => {
  it("getTeacherRates → FORBIDDEN, no DB read", async () => {
    const res = await getTeacherRates();
    expect(res).toMatchObject({ success: false, code: "FORBIDDEN" });
    expect(dbMock.teacherRate.findMany).not.toHaveBeenCalled();
  });

  it("getTeacherPayouts → FORBIDDEN, no DB read", async () => {
    const res = await getTeacherPayouts();
    expect(res).toMatchObject({ success: false, code: "FORBIDDEN" });
    expect(dbMock.teacherPayout.findMany).not.toHaveBeenCalled();
  });

  it("addTeacherRate → FORBIDDEN, no write", async () => {
    const res = await addTeacherRate(VALID_RATE);
    expect(res).toMatchObject({ success: false, code: "FORBIDDEN" });
    expect(dbMock.teacherRate.create).not.toHaveBeenCalled();
  });

  it("calculateTeacherSalary → FORBIDDEN, no computation", async () => {
    const res = await calculateTeacherSalary(VALID_PERIOD);
    expect(res).toMatchObject({ success: false, code: "FORBIDDEN" });
    expect(computeTeacherSalaryMock).not.toHaveBeenCalled();
  });

  it("createTeacherPayout → FORBIDDEN, no payout written", async () => {
    const res = await createTeacherPayout(VALID_PERIOD);
    expect(res).toMatchObject({ success: false, code: "FORBIDDEN" });
    expect(dbMock.teacherPayout.create).not.toHaveBeenCalled();
  });

  it("an unauthenticated caller is UNAUTHORIZED", async () => {
    getSessionUserMock.mockResolvedValue(null);
    const res = await getTeacherRates();
    expect(res).toMatchObject({ success: false, code: "UNAUTHORIZED" });
  });

  it("an ADMIN passes the guard and reaches the DB", async () => {
    getSessionUserMock.mockResolvedValue({ id: "a1", email: "a@a.com", role: "ADMIN" });
    dbMock.teacherRate.findMany.mockResolvedValue([]);
    const res = await getTeacherRates();
    expect(res).toMatchObject({ success: true });
    expect(dbMock.teacherRate.findMany).toHaveBeenCalled();
  });
});
