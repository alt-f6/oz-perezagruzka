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

// Computes the salary for a teacher over [gte, lt) using the latest rate.
// Returns null when the teacher has no configured rate.
export async function computeTeacherSalary(
  teacherId: string,
  gte: Date,
  lt: Date,
): Promise<SalaryComputation | null> {
  const rate = await db.teacherRate.findFirst({
    where: { teacherId },
    orderBy: { createdAt: "desc" },
    select: { rateType: true, value: true },
  });
  if (!rate) return null;

  const rateValue = Number(rate.value);
  let basis: number;
  let amount: number;

  switch (rate.rateType) {
    case "FIXED_PER_LESSON": {
      // A session counts as conducted once at least one attendance mark exists.
      basis = await db.classSession.count({
        where: {
          teacherId,
          scheduledAt: { gte, lt },
          attendance: { some: {} },
        },
      });
      amount = basis * rateValue;
      break;
    }
    case "PER_HEAD": {
      basis = await db.attendance.count({
        where: {
          status: { in: ["PRESENT", "ABSENT"] },
          classSession: { teacherId, scheduledAt: { gte, lt } },
        },
      });
      amount = basis * rateValue;
      break;
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
      basis = Math.abs(Number(charged._sum.amount ?? 0));
      amount = (basis * rateValue) / 100;
      break;
    }
  }

  return {
    rateType: rate.rateType,
    rateValue,
    basis,
    amount: Math.round(amount * 100) / 100,
  };
}
