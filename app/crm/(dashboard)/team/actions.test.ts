import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRoleMock = vi.hoisted(() => vi.fn());
const getSessionUserMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
  user: { update: vi.fn() },
  invite: { create: vi.fn() },
}));
const revalidatePathMock = vi.hoisted(() => vi.fn());
const buildAbsoluteUrlMock = vi.hoisted(() => vi.fn().mockResolvedValue("https://crm.example.com/register?token=tok"));

vi.mock("@/shared/lib/rbac", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/rbac")>("@/shared/lib/rbac");
  return { ...actual, requireRole: requireRoleMock };
});
vi.mock("@/shared/lib/auth", () => ({ getSessionUser: getSessionUserMock }));
vi.mock("@/shared/lib/db", () => ({ db: dbMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/shared/lib/url", () => ({ buildAbsoluteUrl: buildAbsoluteUrlMock }));

const { updateTeamMember, createInvite } = await import("./actions");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateTeamMember", () => {
  it("allows a MANAGER to update a basic profile field", async () => {
    requireRoleMock.mockResolvedValue({ id: "mgr_1", email: "m@x.com", role: "MANAGER" });
    dbMock.user.update.mockResolvedValue({});

    const result = await updateTeamMember({
      id: "11111111-1111-4111-8111-111111111111",
      fullName: "Иван Иванов",
      email: "",
      phone: "",
      subjects: "",
    });

    expect(result).toEqual({});
    expect(requireRoleMock).toHaveBeenCalledWith(["ADMIN", "MANAGER"]);
    expect(dbMock.user.update).toHaveBeenCalledWith({
      where: { id: "11111111-1111-4111-8111-111111111111" },
      data: { fullName: "Иван Иванов", email: null, phone: null, subjects: null },
    });
  });

  it("ignores an injected rate/salary field even if present on the payload", async () => {
    requireRoleMock.mockResolvedValue({ id: "mgr_1", email: "m@x.com", role: "MANAGER" });
    dbMock.user.update.mockResolvedValue({});

    // Simulates a client bypassing TypeScript and posting an extra field --
    // Zod's default "strip unknown keys" behavior must drop it silently.
    const maliciousPayload = {
      id: "11111111-1111-4111-8111-111111111111",
      fullName: "Иван Иванов",
      email: "",
      phone: "",
      subjects: "",
      baseRate: 999999,
    } as unknown as Parameters<typeof updateTeamMember>[0];

    await updateTeamMember(maliciousPayload);

    const dataArg = dbMock.user.update.mock.calls[0][0].data;
    expect(dataArg).not.toHaveProperty("baseRate");
    expect(dataArg).not.toHaveProperty("rate");
    expect(dataArg).not.toHaveProperty("payoutRate");
  });

  it("propagates the RbacError thrown for a disallowed role (e.g. TEACHER)", async () => {
    const { RbacError } = await import("@/shared/lib/rbac");
    requireRoleMock.mockImplementation(() => {
      throw new RbacError(403, "forbidden");
    });

    await expect(
      updateTeamMember({
        id: "11111111-1111-4111-8111-111111111111",
        fullName: "Иван Иванов",
        email: "",
        phone: "",
        subjects: "",
      }),
    ).rejects.toThrow("forbidden");
  });
});
