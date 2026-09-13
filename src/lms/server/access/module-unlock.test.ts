import { describe, it, expect } from "vitest";
import { computeModuleUnlockStatus } from "./module-unlock";

const enrolledAt = new Date("2026-01-01T00:00:00Z");

describe("computeModuleUnlockStatus", () => {
  it("MANUAL is always unlocked with no unlocksAt date", () => {
    const result = computeModuleUnlockStatus(
      { unlockMode: "MANUAL", unlockAfterDays: null, unlockAt: null },
      enrolledAt
    );
    expect(result).toEqual({ unlocked: true, unlocksAt: null });
  });

  it("DRIP_ENROLLMENT is locked before enrolledAt + unlockAfterDays and reports the exact unlocksAt", () => {
    const now = new Date("2026-01-15T00:00:00Z"); // 14 days after enrollment
    const result = computeModuleUnlockStatus(
      { unlockMode: "DRIP_ENROLLMENT", unlockAfterDays: 28, unlockAt: null },
      enrolledAt,
      now
    );
    expect(result).toEqual({ unlocked: false, unlocksAt: new Date("2026-01-29T00:00:00Z") });
  });

  it("DRIP_ENROLLMENT is unlocked exactly at the enrolledAt + unlockAfterDays boundary", () => {
    const now = new Date("2026-01-29T00:00:00Z"); // exactly 28 days after enrollment
    const result = computeModuleUnlockStatus(
      { unlockMode: "DRIP_ENROLLMENT", unlockAfterDays: 28, unlockAt: null },
      enrolledAt,
      now
    );
    expect(result).toEqual({ unlocked: true, unlocksAt: new Date("2026-01-29T00:00:00Z") });
  });

  it("DRIP_ENROLLMENT treats a null unlockAfterDays as 0 days (unlocked immediately)", () => {
    const result = computeModuleUnlockStatus(
      { unlockMode: "DRIP_ENROLLMENT", unlockAfterDays: null, unlockAt: null },
      enrolledAt,
      enrolledAt
    );
    expect(result).toEqual({ unlocked: true, unlocksAt: enrolledAt });
  });

  it("FIXED_DATE is locked before unlockAt and unlocked at/after it", () => {
    const unlockAt = new Date("2026-03-01T00:00:00Z");

    expect(
      computeModuleUnlockStatus(
        { unlockMode: "FIXED_DATE", unlockAfterDays: null, unlockAt },
        enrolledAt,
        new Date("2026-02-28T23:59:59Z")
      )
    ).toEqual({ unlocked: false, unlocksAt: unlockAt });

    expect(
      computeModuleUnlockStatus(
        { unlockMode: "FIXED_DATE", unlockAfterDays: null, unlockAt },
        enrolledAt,
        new Date("2026-03-01T00:00:00Z")
      )
    ).toEqual({ unlocked: true, unlocksAt: unlockAt });
  });

  it("FIXED_DATE with a null unlockAt is treated as permanently locked", () => {
    const result = computeModuleUnlockStatus(
      { unlockMode: "FIXED_DATE", unlockAfterDays: null, unlockAt: null },
      enrolledAt,
      new Date("2099-01-01T00:00:00Z")
    );
    expect(result).toEqual({ unlocked: false, unlocksAt: null });
  });

  it("defaults `now` to the current wall clock when omitted", () => {
    const past = new Date(Date.now() - 1000);
    const result = computeModuleUnlockStatus({ unlockMode: "FIXED_DATE", unlockAfterDays: null, unlockAt: past }, enrolledAt);
    expect(result.unlocked).toBe(true);
  });
});
