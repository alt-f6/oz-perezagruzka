const DAY_MS = 86_400_000;

export type ModuleUnlockConfig = {
  unlockMode: "MANUAL" | "DRIP_ENROLLMENT" | "FIXED_DATE";
  unlockAfterDays: number | null;
  unlockAt: Date | null;
};

export type ModuleUnlockStatus = {
  unlocked: boolean;
  unlocksAt: Date | null;
};

export function computeModuleUnlockStatus(
  module: ModuleUnlockConfig,
  enrolledAt: Date,
  now: Date = new Date()
): ModuleUnlockStatus {
  switch (module.unlockMode) {
    case "MANUAL":
      return { unlocked: true, unlocksAt: null };
    case "DRIP_ENROLLMENT": {
      const days = module.unlockAfterDays ?? 0;
      const unlocksAt = new Date(enrolledAt.getTime() + days * DAY_MS);
      return { unlocked: now.getTime() >= unlocksAt.getTime(), unlocksAt };
    }
    case "FIXED_DATE": {
      if (!module.unlockAt) return { unlocked: false, unlocksAt: null };
      return { unlocked: now.getTime() >= module.unlockAt.getTime(), unlocksAt: module.unlockAt };
    }
    default:
      return { unlocked: false, unlocksAt: null };
  }
}

/**
 * Monthly-abonement gate (Enrollment.accessThroughModule). modulePosition is
 * the module's 1-based position in its course's [order, id] ordering.
 * null/undefined cursor = whole course; 0 = nothing paid yet.
 */
export function isWithinPaidAccess(modulePosition: number, accessThroughModule: number | null | undefined): boolean {
  if (accessThroughModule === null || accessThroughModule === undefined) return true;
  return modulePosition <= accessThroughModule;
}
