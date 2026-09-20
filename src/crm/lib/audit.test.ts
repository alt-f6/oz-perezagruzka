import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  activityLog: { create: vi.fn() },
  user: { findUnique: vi.fn() },
}));
const loggerErrorMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/lib/db", () => ({ db: dbMock }));
vi.mock("@/shared/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: loggerErrorMock }),
}));

const { logActivity } = await import("./audit");

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.activityLog.create.mockResolvedValue({});
  dbMock.user.findUnique.mockResolvedValue(null);
});

describe("logActivity", () => {
  it("writes a row with the fields passed, skipping the name lookup when userName is given", async () => {
    await logActivity({
      userId: "u1",
      userName: "Иван Иванов",
      userRole: "ADMIN",
      action: "CREATE",
      entityType: "STUDENT",
      entityId: "s1",
      entityTitle: "Пётр Петров",
    });

    expect(dbMock.activityLog.create).toHaveBeenCalledWith({
      data: {
        userId: "u1",
        userName: "Иван Иванов",
        userRole: "ADMIN",
        action: "CREATE",
        entityType: "STUDENT",
        entityId: "s1",
        entityTitle: "Пётр Петров",
        details: undefined,
      },
    });
    expect(dbMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("resolves userName from the user's fullName when omitted", async () => {
    dbMock.user.findUnique.mockResolvedValue({ fullName: "Мария Сидорова" });

    await logActivity({ userId: "u2", userRole: "MANAGER", action: "UPDATE", entityType: "TEACHER" });

    expect(dbMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: "u2" },
      select: { fullName: true },
    });
    expect(dbMock.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userName: "Мария Сидорова" }) }),
    );
  });

  it("defaults to Система/SYSTEM for a system-initiated action with no userId", async () => {
    await logActivity({ action: "CREATE", entityType: "LESSON" });

    expect(dbMock.user.findUnique).not.toHaveBeenCalled();
    expect(dbMock.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userName: "Система", userRole: "SYSTEM" }) }),
    );
  });

  it("still writes the row (falling back to Система) even if the userName lookup throws", async () => {
    dbMock.user.findUnique.mockRejectedValue(new Error("db down"));

    await logActivity({ userId: "u3", userRole: "ADMIN", action: "UPDATE", entityType: "STUDENT" });

    expect(dbMock.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userName: "Система" }) }),
    );
  });

  it("scrubs sensitive keys recursively from details", async () => {
    await logActivity({
      userId: "u1",
      userName: "Admin",
      userRole: "ADMIN",
      action: "UPDATE",
      entityType: "TEACHER",
      details: {
        password: "hunter2",
        nested: { authToken: "abc", cookieValue: "xyz", safe: "ok" },
        apiSecretKey: "s3cr3t",
        passwordHash: "h4sh",
      },
    });

    expect(dbMock.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          details: {
            password: "[REDACTED]",
            nested: { authToken: "[REDACTED]", cookieValue: "[REDACTED]", safe: "ok" },
            apiSecretKey: "[REDACTED]",
            passwordHash: "[REDACTED]",
          },
        }),
      }),
    );
  });

  it("serializes Date values in details to ISO strings instead of dropping them", async () => {
    const scheduledAt = new Date("2026-10-01T07:00:00.000Z");

    await logActivity({
      userId: "u1",
      userName: "Admin",
      userRole: "ADMIN",
      action: "RESCHEDULE",
      entityType: "LESSON",
      details: { scheduledAt, note: "moved" },
    });

    expect(dbMock.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          details: { scheduledAt: "2026-10-01T07:00:00.000Z", note: "moved" },
        }),
      }),
    );
  });

  it("never throws when db.activityLog.create rejects", async () => {
    dbMock.activityLog.create.mockRejectedValue(new Error("db down"));

    await expect(
      logActivity({ userId: "u1", userRole: "ADMIN", action: "CREATE", entityType: "STUDENT" }),
    ).resolves.toBeUndefined();
    expect(loggerErrorMock).toHaveBeenCalled();
  });
});
