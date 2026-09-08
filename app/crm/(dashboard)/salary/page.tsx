import { db } from "@/shared/lib/db";
import { requireRoleForPage } from "@/shared/lib/rbac";
import { getTeacherRates, getTeacherPayouts } from "./actions";
import { SalaryClient } from "./SalaryClient";

export default async function TeacherSalaryPage() {
  await requireRoleForPage(["ADMIN"], {
    loginPath: "/admin/login",
    forbiddenPath: () => "/access-denied",
  });

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
