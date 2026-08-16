"use client";

import { AlertCircle, Calculator, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  addTeacherRate,
  calculateTeacherSalary,
  createTeacherPayout,
  type SalaryCalculation,
  type TeacherPayoutRecord,
} from "./actions";

type RateType = "FIXED_PER_LESSON" | "PER_HEAD" | "PERCENTAGE";

interface TeacherRate {
  id: string;
  teacherId: string;
  rateType: RateType;
  value: number;
  createdAt: string;
}

interface Teacher {
  id: string;
  fullName: string | null;
}

const RATE_TYPE_LABELS: Record<RateType, string> = {
  FIXED_PER_LESSON: "Фикс. за занятие",
  PER_HEAD: "За ученика",
  PERCENTAGE: "Процент от оплаты",
};

const BASIS_LABELS: Record<RateType, string> = {
  FIXED_PER_LESSON: "Проведено занятий (с отметками посещаемости)",
  PER_HEAD: "Оплачиваемых отметок (присутствие + пропуск без ув. причины)",
  PERCENTAGE: "Списано с балансов учеников за занятия, ₽",
};

const ZERO_BASIS_HINTS: Record<RateType, string> = {
  FIXED_PER_LESSON:
    "За период не найдено занятий с отметками посещаемости. Занятие считается проведённым только после отметки посещаемости.",
  PER_HEAD:
    "За период нет оплачиваемых отметок (Присутствовал / Отсутствовал). Уважительные причины и отмены центром не оплачиваются.",
  PERCENTAGE:
    "За период не найдено списаний за занятия. Процент считается от суммы списаний с балансов учеников.",
};

function formatMoney(value: number): string {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

function formatRate(rateType: RateType, value: number): string {
  return rateType === "PERCENTAGE"
    ? `${value.toLocaleString("ru-RU")}%`
    : formatMoney(value);
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { timeZone: "UTC" });
}

export function SalaryClient({
  initialRates,
  initialPayouts,
  teachers,
}: {
  initialRates: TeacherRate[];
  initialPayouts: TeacherPayoutRecord[];
  teachers: Teacher[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [calcTeacherId, setCalcTeacherId] = useState("");
  const [calcFrom, setCalcFrom] = useState("");
  const [calcTo, setCalcTo] = useState("");
  const [calcBusy, setCalcBusy] = useState(false);
  const [calcError, setCalcError] = useState("");
  const [calculation, setCalculation] = useState<SalaryCalculation | null>(null);
  const [calcPeriod, setCalcPeriod] = useState<{ from: string; to: string } | null>(null);
  const [payouts, setPayouts] = useState<TeacherPayoutRecord[]>(initialPayouts);

  const teacherName = (id: string) =>
    teachers.find((t) => t.id === id)?.fullName || id;

  // Rates arrive sorted by createdAt desc, and the calculation always uses
  // the latest rate per teacher. Mark it so stale rows aren't misleading.
  const activeRateIds = useMemo(() => {
    const seen = new Set<string>();
    const active = new Set<string>();
    for (const rate of initialRates) {
      if (!seen.has(rate.teacherId)) {
        seen.add(rate.teacherId);
        active.add(rate.id);
      }
    }
    return active;
  }, [initialRates]);

  async function handleCalculate() {
    if (!calcTeacherId || !calcFrom || !calcTo) {
      setCalcError("Выберите преподавателя и период");
      return;
    }
    if (calcFrom > calcTo) {
      setCalcError("Начало периода позже конца");
      return;
    }
    setCalcBusy(true);
    setCalcError("");
    setCalculation(null);
    try {
      const result = await calculateTeacherSalary({
        teacherId: calcTeacherId,
        periodFrom: calcFrom,
        periodTo: calcTo,
      });
      if (!result.success) {
        setCalcError(result.error);
        return;
      }
      setCalculation(result.data);
      setCalcPeriod({ from: calcFrom, to: calcTo });
    } finally {
      setCalcBusy(false);
    }
  }

  async function handlePayout() {
    if (!calculation || !calcPeriod) return;
    setCalcBusy(true);
    setCalcError("");
    try {
      const result = await createTeacherPayout({
        teacherId: calculation.teacherId,
        periodFrom: calcPeriod.from,
        periodTo: calcPeriod.to,
        amount: calculation.amount,
      });
      if (!result.success) {
        setCalcError(result.error);
        return;
      }
      setPayouts((prev) => [result.data, ...prev]);
      setCalculation(null);
      setCalcPeriod(null);
    } finally {
      setCalcBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const result = await addTeacherRate({
        teacherId: formData.get("teacherId"),
        rateType: formData.get("rateType"),
        value: Number(formData.get("value")),
      });
      if (!result.success) {
        setErrorMsg(result.error);
        return;
      }
      form.reset();
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("Ошибка при сохранении");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="page-title">Зарплата преподавателей</h1>
        <p className="page-subtitle">
          Ставки, расчёт вознаграждения за период и история выплат.
        </p>
      </div>

      {/* ---------- Period breakdown ---------- */}
      <div className="card space-y-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Calculator size={17} />
          </span>
          <h2 className="section-title">Расчёт за период</h2>
        </div>

        {calcError && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <AlertCircle size={16} className="shrink-0" />
            {calcError}
          </div>
        )}

        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-4">
          <div>
            <label className="label">Преподаватель</label>
            <select
              value={calcTeacherId}
              onChange={(e) => setCalcTeacherId(e.target.value)}
              className="input"
            >
              <option value="">Выберите преподавателя</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName || t.id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Период с</label>
            <input
              type="date"
              value={calcFrom}
              onChange={(e) => setCalcFrom(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">Период по</label>
            <input
              type="date"
              value={calcTo}
              onChange={(e) => setCalcTo(e.target.value)}
              className="input"
            />
          </div>
          <button
            type="button"
            disabled={calcBusy}
            onClick={handleCalculate}
            className="btn-primary"
          >
            {calcBusy ? "Расчёт..." : "Рассчитать"}
          </button>
        </div>

        {calculation && calcPeriod && (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900">
              Расшифровка: {teacherName(calculation.teacherId)},{" "}
              {formatDay(calcPeriod.from)} — {formatDay(calcPeriod.to)}
            </div>
            <dl className="divide-y divide-slate-100 text-sm">
              <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                <dt className="text-slate-500">Тип ставки</dt>
                <dd className="font-medium text-slate-900">
                  {RATE_TYPE_LABELS[calculation.rateType]}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                <dt className="text-slate-500">Ставка</dt>
                <dd className="font-medium tabular-nums text-slate-900">
                  {formatRate(calculation.rateType, calculation.rateValue)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                <dt className="text-slate-500">
                  {BASIS_LABELS[calculation.rateType]}
                </dt>
                <dd className="font-medium tabular-nums text-slate-900">
                  {calculation.basis.toLocaleString("ru-RU")}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                <dt className="text-slate-500">Формула</dt>
                <dd className="font-mono text-xs tabular-nums text-slate-600">
                  {calculation.rateType === "PERCENTAGE"
                    ? `${calculation.basis.toLocaleString("ru-RU")} × ${calculation.rateValue}% = ${formatMoney(calculation.amount)}`
                    : `${calculation.basis.toLocaleString("ru-RU")} × ${formatMoney(calculation.rateValue)} = ${formatMoney(calculation.amount)}`}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 bg-slate-50 px-4 py-3">
                <dt className="font-medium text-slate-900">Итого к выплате</dt>
                <dd className="text-lg font-semibold tabular-nums text-slate-900">
                  {formatMoney(calculation.amount)}
                </dd>
              </div>
            </dl>

            {calculation.basis === 0 && (
              <div className="flex items-start gap-2 border-t border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                {ZERO_BASIS_HINTS[calculation.rateType]}
              </div>
            )}

            {calculation.amount > 0 && (
              <div className="flex justify-end border-t border-slate-200 px-4 py-3">
                <button
                  type="button"
                  disabled={calcBusy}
                  onClick={handlePayout}
                  className="btn-primary"
                >
                  <Wallet size={15} />
                  Зафиксировать выплату
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---------- Rates ---------- */}
      <div className="card space-y-5">
        <h2 className="section-title">Ставки преподавателей</h2>

        {errorMsg && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <AlertCircle size={16} className="shrink-0" />
            {errorMsg}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 items-end gap-4 md:grid-cols-4"
        >
          <div>
            <label className="label">Преподаватель</label>
            <select name="teacherId" required className="input">
              <option value="">Выберите преподавателя</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName || t.id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Тип ставки</label>
            <select name="rateType" className="input">
              {(Object.keys(RATE_TYPE_LABELS) as RateType[]).map((type) => (
                <option key={type} value={type}>
                  {RATE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Значение (₽ или %)</label>
            <input
              type="number"
              name="value"
              required
              min={1}
              defaultValue={1000}
              className="input"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-secondary">
            {loading ? "Сохранение..." : "Сохранить ставку"}
          </button>
        </form>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="table">
            <thead>
              <tr>
                <th>Преподаватель</th>
                <th>Тип ставки</th>
                <th>Статус</th>
                <th className="text-right">Значение</th>
              </tr>
            </thead>
            <tbody>
              {initialRates.length > 0 ? (
                initialRates.map((rate) => {
                  const isActive = activeRateIds.has(rate.id);
                  return (
                    <tr key={rate.id} className={isActive ? "" : "opacity-60"}>
                      <td className="font-medium">
                        {teacherName(rate.teacherId)}
                      </td>
                      <td className="text-slate-600">
                        {RATE_TYPE_LABELS[rate.rateType]}
                      </td>
                      <td>
                        {isActive ? (
                          <span className="badge-success">Действующая</span>
                        ) : (
                          <span className="badge-neutral">Архив</span>
                        )}
                      </td>
                      <td className="text-right font-medium tabular-nums">
                        {formatRate(rate.rateType, rate.value)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="py-10 text-center text-sm text-slate-500"
                  >
                    Ставки ещё не добавлены. Заполните форму выше.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- Payment history ---------- */}
      <div className="card space-y-5">
        <h2 className="section-title">История выплат</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="table">
            <thead>
              <tr>
                <th>Преподаватель</th>
                <th>Период</th>
                <th>Дата выплаты</th>
                <th className="text-right">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {payouts.length > 0 ? (
                payouts.map((payout) => (
                  <tr key={payout.id}>
                    <td className="font-medium">
                      {teacherName(payout.teacherId)}
                    </td>
                    <td className="text-slate-600">
                      {formatDay(payout.periodFrom)} —{" "}
                      {formatDay(payout.periodTo)}
                    </td>
                    <td className="text-slate-600">
                      {new Date(payout.createdAt).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="text-right font-semibold tabular-nums">
                      {formatMoney(payout.amount)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="py-10 text-center text-sm text-slate-500"
                  >
                    Выплаты ещё не фиксировались.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
