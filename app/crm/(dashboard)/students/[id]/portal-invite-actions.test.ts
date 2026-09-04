import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const getSessionUser = vi.fn();
vi.mock("@/shared/lib/auth", () => ({
  getSessionUser: (...a: unknown[]) => getSessionUser(...a),
  hashPassword: async () => "hashed",
}));

vi.mock("@/shared/lib/url", () => ({
  // Echo the path so tests can assert the token round-trips into the link.
  buildAbsoluteUrl: async (_app: string, path: string) => `https://crm.test${path}`,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const studentFindUnique = vi.fn();
const studentUpdate = vi.fn();
const inviteFindFirst = vi.fn();
const inviteFindUnique = vi.fn();
const inviteCreate = vi.fn();
const inviteUpdate = vi.fn();
vi.mock("@/shared/lib/db", () => ({
  db: {
    student: {
      findUnique: (...a: unknown[]) => studentFindUnique(...a),
      update: (...a: unknown[]) => studentUpdate(...a),
    },
    invite: {
      findFirst: (...a: unknown[]) => inviteFindFirst(...a),
      findUnique: (...a: unknown[]) => inviteFindUnique(...a),
      create: (...a: unknown[]) => inviteCreate(...a),
      update: (...a: unknown[]) => inviteUpdate(...a),
    },
  },
}));

function p2002() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint", {
    code: "P2002",
    clientVersion: "test",
  });
}

describe("inviteStudentPortal — idempotent provisioning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUser.mockResolvedValue({ id: "admin1", role: "ADMIN" });
    studentUpdate.mockResolvedValue({});
  });

  it("creates a fresh invite when none exists and returns a link", async () => {
    studentFindUnique.mockResolvedValue({ id: "st1", userId: null });
    inviteFindFirst.mockResolvedValue(null); // no pending invite
    inviteCreate.mockResolvedValue({ token: "tok-new", expiresAt: new Date() });

    const { inviteStudentPortal } = await import("./portal-invite-actions");
    const res = await inviteStudentPortal("st1", "s@x.com");

    expect(res.error).toBeUndefined();
    expect(res.inviteLink).toContain("tok-new");
    expect(inviteCreate).toHaveBeenCalledTimes(1);
  });

  it("REISSUES the student's pending invite instead of blocking with 'already created'", async () => {
    studentFindUnique.mockResolvedValue({ id: "st1", userId: null });
    inviteFindFirst.mockResolvedValue({ id: "inv-existing" }); // pending invite exists
    inviteUpdate.mockResolvedValue({ token: "tok-reissued", expiresAt: new Date() });

    const { inviteStudentPortal } = await import("./portal-invite-actions");
    const res = await inviteStudentPortal("st1", "s@x.com");

    expect(res.error).toBeUndefined();
    expect(res.inviteLink).toContain("tok-reissued");
    expect(inviteUpdate).toHaveBeenCalledTimes(1);
    expect(inviteCreate).not.toHaveBeenCalled();
  });

  it("reclaims a colliding (still-pending) invite on P2002 rather than erroring", async () => {
    studentFindUnique.mockResolvedValue({ id: "st1", userId: null });
    inviteFindFirst.mockResolvedValue(null); // no invite tied to this student
    inviteCreate.mockRejectedValue(p2002()); // but the email is taken by another invite row
    inviteFindUnique.mockResolvedValue({ id: "inv-collide", acceptedAt: null });
    inviteUpdate.mockResolvedValue({ token: "tok-reclaimed", expiresAt: new Date() });

    const { inviteStudentPortal } = await import("./portal-invite-actions");
    const res = await inviteStudentPortal("st1", "s@x.com");

    expect(res.error).toBeUndefined();
    expect(res.inviteLink).toContain("tok-reclaimed");
  });

  it("returns a login hint (not a reissue) when the colliding invite is already accepted", async () => {
    studentFindUnique.mockResolvedValue({ id: "st1", userId: null });
    inviteFindFirst.mockResolvedValue(null);
    inviteCreate.mockRejectedValue(p2002());
    inviteFindUnique.mockResolvedValue({ id: "inv-accepted", acceptedAt: new Date() });

    const { inviteStudentPortal } = await import("./portal-invite-actions");
    const res = await inviteStudentPortal("st1", "s@x.com");

    expect(res.inviteLink).toBeUndefined();
    expect(res.error).toContain("уже зарегистрирован");
  });

  it("does not issue an invite when the student already has an account", async () => {
    studentFindUnique.mockResolvedValue({ id: "st1", userId: "u1" });

    const { inviteStudentPortal } = await import("./portal-invite-actions");
    const res = await inviteStudentPortal("st1", "s@x.com");

    expect(res.error).toBe("У ученика уже есть аккаунт");
    expect(inviteCreate).not.toHaveBeenCalled();
    expect(inviteUpdate).not.toHaveBeenCalled();
  });
});

describe("reissueStudentInvite — regeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUser.mockResolvedValue({ id: "admin1", role: "ADMIN" });
  });

  it("regenerates using the email stored on the student record", async () => {
    studentFindUnique.mockResolvedValue({ id: "st1", userId: null, email: "s@x.com" });
    inviteFindFirst.mockResolvedValue({ id: "inv1" }); // pending invite to reissue
    inviteUpdate.mockResolvedValue({ token: "tok-regen", expiresAt: new Date() });

    const { reissueStudentInvite } = await import("./portal-invite-actions");
    const res = await reissueStudentInvite("st1");

    expect(res.error).toBeUndefined();
    expect(res.inviteLink).toContain("tok-regen");
  });

  it("asks for an email when none is on file", async () => {
    studentFindUnique.mockResolvedValue({ id: "st1", userId: null, email: null });
    inviteFindFirst.mockResolvedValue(null); // no pending invite to borrow an email from

    const { reissueStudentInvite } = await import("./portal-invite-actions");
    const res = await reissueStudentInvite("st1");

    expect(res.error).toContain("укажите email");
  });
});
