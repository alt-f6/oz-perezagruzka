import type { AbonementSummary } from "@/crm/lib/services/abonement.service";

// Threshold shared with the /students list's "Абонемент заканчивается" filter chip.
const LOW_BALANCE_THRESHOLD = 1;

function badgeClass(remainingLessons: number | null): string {
  if (remainingLessons === null) return "badge-neutral";
  if (remainingLessons <= 0) return "badge-warning";
  if (remainingLessons <= LOW_BALANCE_THRESHOLD) return "badge-warning";
  return "badge-success";
}

/**
 * Read-only "Абонемент" card for the student profile (ADMIN/MANAGER only,
 * mirroring the rest of the financial data on this page). Renders the
 * student's shared balance against every group they're in side-by-side --
 * never summed -- so it's never possible to misread the card as implying
 * doubled prepaid lessons for a student in more than one group.
 */
export function AbonementSection({ summary }: { summary: AbonementSummary }) {
  const isLow =
    summary.minRemainingLessons !== null && summary.minRemainingLessons <= LOW_BALANCE_THRESHOLD;

  return (
    <section className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Абонемент</h2>
        {isLow && (
          <span className="badge-warning">Требуется продление абонемента</span>
        )}
      </div>

      <p className="text-sm text-slate-500">
        Баланс: <span className="font-medium text-slate-800">{summary.balance.toLocaleString("ru-RU")} ₽</span>
        {summary.mode === "MULTI_GROUP" && " — общий для всех групп ниже"}
      </p>

      {summary.mode === "NONE" && (
        <p className="text-sm text-slate-400">
          Не удалось рассчитать остаток занятий: у студента нет ни группы с указанной ценой,
          ни индивидуальных занятий с указанной стоимостью.
        </p>
      )}

      {summary.mode === "INDIVIDUAL" && summary.individual && (
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3.5 py-2.5">
          <div>
            <p className="text-sm font-medium text-slate-800">Индивидуальные занятия</p>
            <p className="text-xs text-slate-500">
              {summary.individual.pricePerLesson.toLocaleString("ru-RU")} ₽ / занятие
            </p>
          </div>
          <span className={badgeClass(summary.individual.remainingLessons)}>
            {summary.individual.remainingLessons} ур.
          </span>
        </div>
      )}

      {(summary.mode === "SINGLE_GROUP" || summary.mode === "MULTI_GROUP") && (
        <div className="space-y-2">
          {summary.groups.map((g) => (
            <div
              key={g.groupId}
              className="flex items-center justify-between rounded-lg bg-slate-50 px-3.5 py-2.5"
            >
              <div>
                <p className="text-sm font-medium text-slate-800">{g.groupName}</p>
                <p className="text-xs text-slate-500">
                  {g.pricePerLesson.toLocaleString("ru-RU")} ₽ / занятие
                </p>
              </div>
              {g.remainingLessons === null ? (
                <span className="badge-neutral">Цена не указана</span>
              ) : (
                <span className={badgeClass(g.remainingLessons)}>{g.remainingLessons} ур.</span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
