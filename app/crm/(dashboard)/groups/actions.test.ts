import { beforeEach, describe, expect, it, vi } from "vitest";

const bulkCancelMock = vi.hoisted(() => vi.fn());

vi.mock("../lessons/actions", () => ({ bulkCancelSessions: bulkCancelMock }));

const { cancelGroupUpcomingSessions } = await import("./actions");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("cancelGroupUpcomingSessions", () => {
  it("delegates to bulkCancelSessions scoped by groupId", async () => {
    bulkCancelMock.mockResolvedValue({ cancelledCount: 3, skippedCount: 1 });

    const result = await cancelGroupUpcomingSessions("group_1");

    expect(bulkCancelMock).toHaveBeenCalledWith({ groupId: "group_1" });
    expect(result).toEqual({ cancelledCount: 3, skippedCount: 1 });
  });
});
