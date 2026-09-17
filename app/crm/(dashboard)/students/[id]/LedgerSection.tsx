import {
  ATTENDANCE_STATUS_CLASSES,
  ATTENDANCE_STATUS_LABELS,
  type AttendanceStatus,
} from "@/crm/lib/types";
import type { LedgerRow } from "@/crm/lib/services/abonement.service";
import { formatMoscowDate, formatMoscowTime } from "@/shared/lib/timezone";

function AttendanceBadge({ status }: { status: AttendanceStatus | null }) {
  if (status === null) {
    return <span className="badge-warning">Не отмечено</span>;
  }
  return (
    <span className={`badge ${ATTENDANCE_STATUS_CLASSES[status]}`}>
      {ATTENDANCE_STATUS_LABELS[status]}
    </span>
  );
}

/**
 * Chronological "История занятий и списаний" tab: every session-linked
 * attendance/charge plus standalone payments/adjustments, most recent first,
 * with the running balance at each point. The pending-charge banner is
 * informational only -- it links out to /lessons rather than adding a
 * second bulk-mark action here.
 */
export function LedgerSection({
  rows,
  pendingCharge,
}: {
  rows: LedgerRow[];
  pendingCharge: { count: number; projectedBalance: number } | null;
}) {
  return (
    <section className="card space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">История занятий и списаний</h2>

      {pendingCharge && pendingCharge.count > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          Есть {pendingCharge.count} проведённых уроков без отметки посещаемости. Расчётный
          баланс после списания составит: {pendingCharge.projectedBalance.toLocaleString("ru-RU")} ₽.
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">Пока нет ни одного занятия или платежа.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-400">
                <th className="py-2 pr-3">Дата</th>
                <th className="py-2 pr-3">Занятие</th>
                <th className="py-2 pr-3">Статус</th>
                <th className="py-2 pr-3 text-right">Сумма</th>
                <th className="py-2 text-right">Баланс</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="py-2 pr-3 text-slate-600">
                    {formatMoscowDate(row.date)} {formatMoscowTime(row.date)}
                  </td>
                  <td className="py-2 pr-3">
                    <p className="font-medium text-slate-800">{row.title}</p>
                    <p className="text-xs text-slate-400">
                      {row.kind === "SESSION" ? (row.isGroup ? "Группа" : "Индивидуальное") : ""}
                      {row.teacherName ? ` · ${row.teacherName}` : ""}
                    </p>
                  </td>
                  <td className="py-2 pr-3">
                    {row.kind === "SESSION" ? <AttendanceBadge status={row.attendanceStatus} /> : null}
                  </td>
                  <td
                    className={`py-2 pr-3 text-right font-medium ${
                      row.amount < 0 ? "text-cancel" : row.amount > 0 ? "text-emerald-600" : "text-slate-400"
                    }`}
                  >
                    {row.amount > 0 ? "+" : ""}
                    {row.amount.toLocaleString("ru-RU")} ₽
                  </td>
                  <td className="py-2 text-right text-slate-600">
                    {row.runningBalance.toLocaleString("ru-RU")} ₽
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
