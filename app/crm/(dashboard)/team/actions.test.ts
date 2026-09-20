import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRoleMock = vi.hoisted(() => vi.fn());
const getSessionUserMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
  user: { update: vi.fn(), findUnique: vi.fn() },
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
    dbMock.user.findUnique.mockResolvedValue({ role: "TEACHER" });
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
    dbMock.user.findUnique.mockResolvedValue({ role: "TEACHER" });
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

  it("rejects a MANAGER attempting to edit an ADMIN's profile", async () => {
    requireRoleMock.mockResolvedValue({ id: "mgr_1", email: "m@x.com", role: "MANAGER" });
    dbMock.user.findUnique.mockResolvedValue({ role: "ADMIN" });

    const result = await updateTeamMember({
      id: "11111111-1111-4111-8111-111111111111",
      fullName: "Другое Имя",
      email: "",
      phone: "",
      subjects: "",
    });

    expect(result.error).toBeTruthy();
    expect(dbMock.user.update).not.toHaveBeenCalled();
  });

  it("allows a MANAGER to edit a TEACHER's profile", async () => {
    requireRoleMock.mockResolvedValue({ id: "mgr_1", email: "m@x.com", role: "MANAGER" });
    dbMock.user.findUnique.mockResolvedValue({ role: "TEACHER" });
    dbMock.user.update.mockResolvedValue({});

    const result = await updateTeamMember({
      id: "11111111-1111-4111-8111-111111111111",
      fullName: "Иван Иванов",
      email: "",
      phone: "",
      subjects: "",
    });

    expect(result.error).toBeUndefined();
    expect(dbMock.user.update).toHaveBeenCalled();
  });
});

describe("createInvite", () => {
  it("lets a MANAGER invite a TEACHER", async () => {
    getSessionUserMock.mockResolvedValue({ id: "mgr_1", email: "m@x.com", role: "MANAGER" });
    dbMock.invite.create.mockResolvedValue({ token: "tok" });

    const result = await createInvite("teacher@example.com", "TEACHER");

    expect(result.error).toBeUndefined();
    expect(result.inviteLink).toBe("https://crm.example.com/register?token=tok");
    expect(dbMock.invite.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "TEACHER" }) }),
    );
  });

  it("rejects a MANAGER attempting to invite an ADMIN", async () => {
    getSessionUserMock.mockResolvedValue({ id: "mgr_1", email: "m@x.com", role: "MANAGER" });

    const result = await createInvite("wannabe-admin@example.com", "ADMIN");

    expect(result.error).toBeTruthy();
    expect(dbMock.invite.create).not.toHaveBeenCalled();
  });

  it("still lets an ADMIN invite either role", async () => {
    getSessionUserMock.mockResolvedValue({ id: "admin_1", email: "a@x.com", role: "ADMIN" });
    dbMock.invite.create.mockResolvedValue({ token: "tok2" });

    const result = await createInvite("new-admin@example.com", "ADMIN");

    expect(result.error).toBeUndefined();
    expect(dbMock.invite.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "ADMIN" }) }),
    );
  });

  it("rejects a TEACHER (not ADMIN/MANAGER) entirely", async () => {
    getSessionUserMock.mockResolvedValue({ id: "t_1", email: "t@x.com", role: "TEACHER" });

    const result = await createInvite("someone@example.com", "TEACHER");

    expect(result.error).toBeTruthy();
    expect(dbMock.invite.create).not.toHaveBeenCalled();
  });
});
