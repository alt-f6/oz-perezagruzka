import { redirect } from "next/navigation";
import { db } from "@/shared/lib/db";
import { getSessionUser } from "@/shared/lib/auth";
import { getTeacherRates, getTeacherPayouts } from "./actions";
import { SalaryClient } from "./SalaryClient";

export default async function TeacherSalaryPage() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/admin/login");
  }

  if (sessionUser.role !== "ADMIN") {
    redirect("/");
  }

  const [ratesResult, payoutsResult, teachers] = await Promise.all([
    getTeacherRates(),
    getTeacherPayouts(),
    db.user.findMany({
      where: { role: "TEACHER" },
      select: { id: true, fullName: true },
    }),
  ]);

  const rates = ratesResult.success ? ratesResult.data : [];
  const payouts = payoutsResult.success ? payoutsResult.data : [];

  return (
    <SalaryClient initialRates={rates} initialPayouts={payouts} teachers={teachers} />
  );
}
