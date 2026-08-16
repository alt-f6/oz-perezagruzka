"use server";

import { z } from "zod";
import { db } from "@/shared/lib/db";
import { getSessionUser, type SessionUser } from "@/shared/lib/auth";
import { computeTeacherSalary } from "@/crm/lib/services/salary.service";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: string };

interface TeacherRate {
  id: string;
  teacherId: string;
  rateType: "FIXED_PER_LESSON" | "PER_HEAD" | "PERCENTAGE";
  value: number;
  createdAt: string;
}

const AddTeacherRateSchema = z.object({
  teacherId: z.string().uuid(),
  rateType: z.enum(["FIXED_PER_LESSON", "PER_HEAD", "PERCENTAGE"]),
  value: z.number().positive(),
});

const SalaryPeriodSchema = z.object({
  teacherId: z.string().uuid(),
  periodFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате YYYY-MM-DD"),
  periodTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате YYYY-MM-DD"),
});

const CreatePayoutSchema = SalaryPeriodSchema.extend({
  amount: z.number().positive(),
});

export interface SalaryCalculation {
  teacherId: string;
  rateType: "FIXED_PER_LESSON" | "PER_HEAD" | "PERCENTAGE";
  rateValue: number;
  // What the rate was multiplied by: conducted lessons, billable attendance
  // marks, or the charged revenue amount, depending on the rate type.
  basis: number;
  amount: number;
}

export interface TeacherPayoutRecord {
  id: string;
  teacherId: string;
  amount: number;
  periodFrom: string;
  periodTo: string;
  createdAt: string;
}

// Interprets a YYYY-MM-DD pair as an inclusive [from, to] day range.
function periodBounds(periodFrom: string, periodTo: string) {
  const gte = new Date(`${periodFrom}T00:00:00.000Z`);
  const lt = new Date(`${periodTo}T00:00:00.000Z`);
  lt.setUTCDate(lt.getUTCDate() + 1);
  return { gte, lt };
}

type AuthCheck =
  | { authorized: true; user: SessionUser }
  | { authorized: false; error: string; code: string };

async function verifyAdmin(): Promise<AuthCheck> {
  const user = await getSessionUser();
  if (!user) {
    return {
      authorized: false as const,
      error: "Unauthorized",
      code: "UNAUTHORIZED",
    };
  }

  if (user.role !== "ADMIN") {
    return {
      authorized: false as const,
      error: "Forbidden",
      code: "FORBIDDEN",
    };
  }

  return { authorized: true as const, user };
}

export async function getTeacherRates(): Promise<ActionResult<TeacherRate[]>> {
  const authCheck = await verifyAdmin();
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error, code: authCheck.code };
  }

  try {
    const rates = await db.teacherRate.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, teacherId: true, rateType: true, value: true, createdAt: true },
    });

    return {
      success: true,
      data: rates.map((rate) => ({
        ...rate,
        value: Number(rate.value),
        createdAt: rate.createdAt.toISOString(),
      })),
    };
  } catch {
    return { success: false, error: "Database query failed", code: "DB_ERROR" };
  }
}

export async function addTeacherRate(
  payload: unknown,
): Promise<ActionResult<TeacherRate>> {
  const validation = AddTeacherRateSchema.safeParse(payload);
  if (!validation.success) {
    return {
      success: false,
      error: "Invalid payload format",
      code: "VALIDATION_ERROR",
    };
  }

  const authCheck = await verifyAdmin();
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error, code: authCheck.code };
  }

  try {
    const rate = await db.teacherRate.create({
      data: {
        teacherId: validation.data.teacherId,
        rateType: validation.data.rateType,
        value: validation.data.value,
      },
      select: { id: true, teacherId: true, rateType: true, value: true, createdAt: true },
    });

    return {
      success: true,
      data: { ...rate, value: Number(rate.value), createdAt: rate.createdAt.toISOString() },
    };
  } catch {
    return {
      success: false,
      error: "Failed to create rate",
      code: "INSERT_FAILED",
    };
  }
}

export async function calculateTeacherSalary(
  payload: unknown,
): Promise<ActionResult<SalaryCalculation>> {
  const validation = SalaryPeriodSchema.safeParse(payload);
  if (!validation.success) {
    return { success: false, error: "Invalid payload format", code: "VALIDATION_ERROR" };
  }

  const authCheck = await verifyAdmin();
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error, code: authCheck.code };
  }

  const { teacherId, periodFrom, periodTo } = validation.data;
  const { gte, lt } = periodBounds(periodFrom, periodTo);
  if (gte >= lt) {
    return { success: false, error: "Начало периода позже конца", code: "VALIDATION_ERROR" };
  }

  try {
    const computed = await computeTeacherSalary(teacherId, gte, lt);
    if (!computed) {
      return {
        success: false,
        error: "У преподавателя не настроена ставка",
        code: "NO_RATE",
      };
    }

    return {
      success: true,
      data: { teacherId, ...computed },
    };
  } catch {
    return { success: false, error: "Database query failed", code: "DB_ERROR" };
  }
}

export async function createTeacherPayout(
  payload: unknown,
): Promise<ActionResult<TeacherPayoutRecord>> {
  const validation = CreatePayoutSchema.safeParse(payload);
  if (!validation.success) {
    return { success: false, error: "Invalid payload format", code: "VALIDATION_ERROR" };
  }

  const authCheck = await verifyAdmin();
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error, code: authCheck.code };
  }

  const { teacherId, periodFrom, periodTo, amount } = validation.data;

  const bounds = periodBounds(periodFrom, periodTo);
  if (bounds.gte >= bounds.lt) {
    return { success: false, error: "Начало периода позже конца", code: "VALIDATION_ERROR" };
  }

  try {
    const payout = await db.teacherPayout.create({
      data: {
        teacherId,
        amount,
        periodFrom: new Date(`${periodFrom}T00:00:00.000Z`),
        periodTo: new Date(`${periodTo}T00:00:00.000Z`),
      },
      select: {
        id: true,
        teacherId: true,
        amount: true,
        periodFrom: true,
        periodTo: true,
        createdAt: true,
      },
    });

    return {
      success: true,
      data: {
        ...payout,
        amount: Number(payout.amount),
        periodFrom: payout.periodFrom.toISOString(),
        periodTo: payout.periodTo.toISOString(),
        createdAt: payout.createdAt.toISOString(),
      },
    };
  } catch {
    return { success: false, error: "Failed to create payout", code: "INSERT_FAILED" };
  }
}

export async function getTeacherPayouts(): Promise<ActionResult<TeacherPayoutRecord[]>> {
  const authCheck = await verifyAdmin();
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error, code: authCheck.code };
  }

  try {
    const payouts = await db.teacherPayout.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        teacherId: true,
        amount: true,
        periodFrom: true,
        periodTo: true,
        createdAt: true,
      },
    });

    return {
      success: true,
      data: payouts.map((p) => ({
        ...p,
        amount: Number(p.amount),
        periodFrom: p.periodFrom.toISOString(),
        periodTo: p.periodTo.toISOString(),
        createdAt: p.createdAt.toISOString(),
      })),
    };
  } catch {
    return { success: false, error: "Database query failed", code: "DB_ERROR" };
  }
}
