import { db } from "@/shared/lib/db";

export type SalaryRateType = "FIXED_PER_LESSON" | "PER_HEAD" | "PERCENTAGE";

export interface SalaryComputation {
  rateType: SalaryRateType;
  rateValue: number;
  // What the rate was multiplied by: conducted lessons, billable attendance
  // marks, or the charged revenue amount, depending on the rate type.
  basis: number;
  amount: number;
}

// Computes basis/amount for a single rate applied to a single [gte, lt) slice.
async function computeSlice(
  teacherId: string,
  rateType: SalaryRateType,
  rateValue: number,
  gte: Date,
  lt: Date,
): Promise<{ basis: number; amount: number }> {
  switch (rateType) {
    case "FIXED_PER_LESSON": {
      // A session counts as conducted once at least one attendance mark exists.
      const basis = await db.classSession.count({
        where: {
          teacherId,
          scheduledAt: { gte, lt },
          attendance: { some: {} },
        },
      });
      return { basis, amount: basis * rateValue };
    }
    case "PER_HEAD": {
      const basis = await db.attendance.count({
        where: {
          status: { in: ["PRESENT", "ABSENT"] },
          classSession: { teacherId, scheduledAt: { gte, lt } },
        },
      });
      return { basis, amount: basis * rateValue };
    }
    case "PERCENTAGE": {
      // LESSON_CHARGE rows are negative (debits); the payout share is a
      // percentage of the charged (absolute) revenue.
      const charged = await db.transaction.aggregate({
        where: {
          type: "LESSON_CHARGE",
          classSession: { teacherId, scheduledAt: { gte, lt } },
        },
        _sum: { amount: true },
      });
      const basis = Math.abs(Number(charged._sum.amount ?? 0));
      return { basis, amount: (basis * rateValue) / 100 };
    }
  }
}

// Computes the salary for a teacher over [gte, lt). Each rate only applies to
// the portion of the period from its own createdAt onward, so a mid-period
// rate change doesn't retroactively reprice lessons taught under the
// previous rate. Returns null when the teacher has no configured rate.
export async function computeTeacherSalary(
  teacherId: string,
  gte: Date,
  lt: Date,
): Promise<SalaryComputation | null> {
  const rates = await db.teacherRate.findMany({
    where: { teacherId },
    orderBy: { createdAt: "asc" },
    select: { rateType: true, value: true, createdAt: true },
  });
  if (rates.length === 0) return null;

  let totalBasis = 0;
  let totalAmount = 0;

  for (let i = 0; i < rates.length; i++) {
    const rate = rates[i];
    const nextRate = rates[i + 1];
    const sliceGte = rate.createdAt > gte ? rate.createdAt : gte;
    const sliceLt = nextRate && nextRate.createdAt < lt ? nextRate.createdAt : lt;
    if (sliceGte >= sliceLt) continue;

    const { basis, amount } = await computeSlice(
      teacherId,
      rate.rateType,
      Number(rate.value),
      sliceGte,
      sliceLt,
    );
    totalBasis += basis;
    totalAmount += amount;
  }

  const latestRate = rates[rates.length - 1];

  return {
    rateType: latestRate.rateType,
    rateValue: Number(latestRate.value),
    basis: totalBasis,
    amount: Math.round(totalAmount * 100) / 100,
  };
}
