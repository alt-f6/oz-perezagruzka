import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const dbMock = vi.hoisted(() => ({
  classSession: { findMany: vi.fn(), update: vi.fn() },
}));

vi.mock("@/shared/lib/db", () => ({ db: dbMock }));

const providerMock = vi.hoisted(() => ({
  sendLessonReminder: vi.fn(),
}));

vi.mock("@/crm/lib/services/notification.service", () => ({
  getNotificationProvider: vi.fn(() => providerMock),
}));

const { GET } = await import("./route");

const CRON_SECRET = "test-cron-secret";

function makeRequest() {
  return new NextRequest("https://example.com/crm/api/cron/lesson-reminders", {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
}

function makeSession(overrides: Partial<{ id: string; parents: Array<{ telegramChatId: string | null }> }>) {
  return {
    id: overrides.id ?? "session_1",
    scheduledAt: new Date("2026-08-11T10:00:00.000Z"),
    group: {
      name: "Group A",
      students: [
        {
          student: {
            fullName: "Student A",
            deletedAt: null,
            parents: (overrides.parents ?? [{ telegramChatId: "chat_1" }]).map((parent) => ({
              parent,
            })),
          },
        },
      ],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = CRON_SECRET;
  dbMock.classSession.update.mockResolvedValue({});
});

describe("GET /crm/api/cron/lesson-reminders", () => {
  it("marks reminderSentAt when every send succeeds", async () => {
    dbMock.classSession.findMany.mockResolvedValue([makeSession({})]);
    providerMock.sendLessonReminder.mockResolvedValue(undefined);

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(dbMock.classSession.update).toHaveBeenCalledWith({
      where: { id: "session_1" },
      data: { reminderSentAt: expect.any(Date) },
    });
  });

  it("does NOT mark reminderSentAt when a send fails, so the next run retries instead of silently losing it", async () => {
    dbMock.classSession.findMany.mockResolvedValue([makeSession({})]);
    providerMock.sendLessonReminder.mockRejectedValue(new Error("Telegram API down"));

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(dbMock.classSession.update).not.toHaveBeenCalled();
  });

  it("marks reminderSentAt for a session with no reachable parents (nothing to fail)", async () => {
    dbMock.classSession.findMany.mockResolvedValue([makeSession({ parents: [] })]);

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(dbMock.classSession.update).toHaveBeenCalledWith({
      where: { id: "session_1" },
      data: { reminderSentAt: expect.any(Date) },
    });
  });

  it("still marks other sessions as sent when only one session's sends fail", async () => {
    dbMock.classSession.findMany.mockResolvedValue([
      makeSession({ id: "session_fail" }),
      makeSession({ id: "session_ok" }),
    ]);
    providerMock.sendLessonReminder
      .mockRejectedValueOnce(new Error("Telegram API down"))
      .mockResolvedValueOnce(undefined);

    await GET(makeRequest());

    expect(dbMock.classSession.update).toHaveBeenCalledTimes(1);
    expect(dbMock.classSession.update).toHaveBeenCalledWith({
      where: { id: "session_ok" },
      data: { reminderSentAt: expect.any(Date) },
    });
  });

  it("records a failure metric via notification-metrics when a send fails", async () => {
    const { getStats, resetMetrics } = await import("@/shared/lib/notification-metrics");
    resetMetrics();
    dbMock.classSession.findMany.mockResolvedValue([makeSession({})]);
    providerMock.sendLessonReminder.mockRejectedValue(new Error("Telegram API down"));

    await GET(makeRequest());

    expect(getStats().channels["lesson-reminder"].failures).toBe(1);
  });

  it("rejects requests without a valid cron secret", async () => {
    const res = await GET(
      new NextRequest("https://example.com/crm/api/cron/lesson-reminders", {
        headers: { authorization: "Bearer wrong-secret" },
      }),
    );

    expect(res.status).toBe(401);
    expect(dbMock.classSession.findMany).not.toHaveBeenCalled();
  });

  it("passes status: \"scheduled\" in the findMany filter so cancelled sessions are never reminded", async () => {
    dbMock.classSession.findMany.mockResolvedValue([]);

    await GET(makeRequest());

    expect(dbMock.classSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "scheduled" }),
      }),
    );
  });
});
