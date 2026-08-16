import { redirect } from "next/navigation";
import { db } from "@/shared/lib/db";
import { getSessionUser } from "@/shared/lib/auth";
import { type Lead } from "@/crm/lib/types";
import { LeadsClient } from "./LeadsClient";
import { LeadModal } from "./LeadModal";

export const revalidate = 0;

export default async function LeadsPage() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/admin/login");
  }

  if (sessionUser.role === "TEACHER") {
    redirect("/");
  }

  const leads = await db.lead.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const initialColumns = {
    NEW: [] as Lead[],
    CONTACTED: [] as Lead[],
    QUALIFIED: [] as Lead[],
    DIAGNOSTIC_SCHEDULED: [] as Lead[],
    DIAGNOSTIC_CONDUCTED: [] as Lead[],
    CONVERTED: [] as Lead[],
    LOST: [] as Lead[],
    CLOSED_LOST: [] as Lead[],
  };

  const groupedLeads = ((leads as unknown as Lead[]) || []).reduce((acc, lead) => {
    if (acc[lead.status]) {
      acc[lead.status].push(lead);
    }
    return acc;
  }, initialColumns);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="page-title">Воронка продаж</h1>
          <p className="page-subtitle">
            Управление летними заявками и записью на диагностику
          </p>
        </div>
        <LeadModal triggerLabel="+ Добавить лида" triggerClassName="btn-primary" />
      </div>

      <LeadsClient groupedLeads={groupedLeads} />
    </div>
  );
}
