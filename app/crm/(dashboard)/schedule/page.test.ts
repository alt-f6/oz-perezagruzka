import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionUserMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));
vi.mock("@/shared/lib/auth", () => ({ getSessionUser: getSessionUserMock }));
// loadScheduleData hits the DB; stub it so this test is a pure guard test.
vi.mock("./schedule-data", () => ({
  loadScheduleData: vi.fn().mockResolvedValue({ ok: true, teachers: [], groups: [], lessons: [] }),
}));

const { default: SchedulePage } = await import("./page");

beforeEach(() => vi.clearAllMocks());

describe("CRM schedule page guard", () => {
  it("redirects a STUDENT to /access-denied, not a thrown RbacError", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", email: "s@x.com", role: "STUDENT" });
    await expect(SchedulePage()).rejects.toThrow("NEXT_REDIRECT:/access-denied");
  });

  it("redirects an unauthenticated visitor to /admin/login", async () => {
    getSessionUserMock.mockResolvedValue(null);
    await expect(SchedulePage()).rejects.toThrow("NEXT_REDIRECT:/admin/login");
  });
});
