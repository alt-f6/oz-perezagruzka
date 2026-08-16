"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Award, Calendar, Plus, Trash2, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { ConfirmDialog } from "@/crm/components/ConfirmDialog";
import { Modal } from "@/crm/components/Modal";
import { useToast } from "@/crm/components/ToastProvider";
import {
  examGoalSchema,
  examResultSchema,
  type ExamGoalValues,
  type ExamResultValues,
} from "@/crm/lib/schemas";
import type { StudentExamGoal, StudentExamResult } from "@/crm/lib/types";
import { addExamResult, deleteExamResult, saveStudentExamGoal } from "./exam-actions";

export function ExamTrackerSection({
  studentId,
  initialGoals,
  initialResults,
}: {
  studentId: string;
  initialGoals: StudentExamGoal[];
  initialResults: StudentExamResult[];
}) {
  const showToast = useToast();
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [deleteResultId, setDeleteResultId] = useState<string | null>(null);
  const [isDeletingResult, setIsDeletingResult] = useState(false);

  const goalForm = useForm<z.input<typeof examGoalSchema>, unknown, ExamGoalValues>({
    resolver: zodResolver(examGoalSchema),
  });
  const resultForm = useForm<z.input<typeof examResultSchema>, unknown, ExamResultValues>({
    resolver: zodResolver(examResultSchema),
    defaultValues: { maxScore: 100, testedAt: new Date().toISOString().split("T")[0] },
  });

  const onSubmitGoal = async (values: ExamGoalValues) => {
    const result = await saveStudentExamGoal(studentId, values);
    if (result?.error) {
      showToast(result.error, "error");
      return;
    }
    showToast("Цель сохранена");
    goalForm.reset();
    setIsGoalModalOpen(false);
  };

  const onSubmitResult = async (values: ExamResultValues) => {
    const result = await addExamResult(studentId, values);
    if (result?.error) {
      showToast(result.error, "error");
      return;
    }
    showToast("Результат добавлен");
    resultForm.reset();
    setIsResultModalOpen(false);
  };

  const handleDeleteResult = async (resultId: string) => {
    setIsDeletingResult(true);
    const result = await deleteExamResult(resultId, studentId);
    setIsDeletingResult(false);
    setDeleteResultId(null);
    if (result?.error) {
      showToast(result.error, "error");
    }
  };

  return (
    <div className="card space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Award size={18} />
            </span>
            Подготовка к экзаменам (ОГЭ / ЕГЭ)
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Цели, история пробников и динамика роста баллов.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsResultModalOpen(true)}
            className="btn-primary"
          >
            <Plus size={16} />
            Добавить пробник
          </button>
          <button
            type="button"
            onClick={() => setIsGoalModalOpen(true)}
            className="btn-secondary px-3.5 py-2"
          >
            Настроить цели
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {initialGoals.length > 0 ? (
          initialGoals.map((goal) => {
            const subjectResults = initialResults.filter(
              (r) => r.subject.toLowerCase() === goal.subject.toLowerCase(),
            );
            const latestResult = subjectResults[0] ?? null;
            const currentScore = latestResult ? latestResult.currentScore : goal.startScore;
            const range = goal.targetScore - goal.startScore;
            const progress = currentScore - goal.startScore;
            let percent = range > 0 ? Math.round((progress / range) * 100) : 0;
            percent = Math.max(0, Math.min(100, percent));

            return (
              <div
                key={goal.id}
                className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5 transition-colors hover:border-accent/20"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-base font-semibold tracking-tight text-slate-900">
                    {goal.subject}
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="badge-neutral">
                      Старт: {goal.startScore}
                    </span>
                    <span className="badge-success">
                      Цель: {goal.targetScore}
                    </span>
                  </div>
                </div>
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="overline block">Текущий балл</span>
                    <span className="text-3xl font-semibold tracking-tight text-slate-900">
                      {currentScore}
                    </span>
                    {latestResult && (
                      <span className="ml-2 text-xs text-slate-500">
                        ({latestResult.testName})
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="overline block">Прогресс</span>
                    <span className="text-sm font-semibold text-emerald-600">{percent}%</span>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty-state col-span-full py-10">
            Цели по экзаменам еще не заданы. Нажмите «Настроить цели».
          </div>
        )}
      </div>

      <div className="divider space-y-3 pt-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <TrendingUp size={16} className="text-slate-500" />
          История сданных пробников и срезов
        </h3>
        {initialResults.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Предмет</th>
                  <th>Название работы</th>
                  <th className="text-right">Балл</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {initialResults.map((res) => (
                  <tr key={res.id}>
                    <td className="text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-slate-400" />
                        {new Date(res.testedAt).toLocaleDateString("ru-RU")}
                      </span>
                    </td>
                    <td className="font-semibold">{res.subject}</td>
                    <td className="text-slate-600">{res.testName}</td>
                    <td className="text-right font-semibold tabular-nums text-emerald-600">
                      {res.currentScore}{" "}
                      <span className="text-xs font-normal text-slate-500">
                        / {res.maxScore}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => setDeleteResultId(res.id)}
                        className="icon-btn-danger h-8 w-8"
                        title="Удалить результат"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-2 text-sm text-slate-500">История пробников пока пуста.</p>
        )}
      </div>

      <ConfirmDialog
        open={deleteResultId !== null}
        title="Удалить результат пробника?"
        message="Запись будет удалена из истории срезов."
        confirmLabel="Удалить"
        danger
        busy={isDeletingResult}
        onConfirm={() => deleteResultId && handleDeleteResult(deleteResultId)}
        onClose={() => setDeleteResultId(null)}
      />

      <Modal
        open={isGoalModalOpen}
        title="Установка целей по предмету"
        onClose={() => setIsGoalModalOpen(false)}
      >
        <form onSubmit={goalForm.handleSubmit(onSubmitGoal)} className="space-y-4">
          <div>
            <label className="label">Предмет</label>
            <input
              type="text"
              placeholder="Математика"
              disabled={goalForm.formState.isSubmitting}
              {...goalForm.register("subject")}
              className="input"
            />
            {goalForm.formState.errors.subject && (
              <p className="field-error">
                {goalForm.formState.errors.subject.message}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">
                Стартовый балл
              </label>
              <input
                type="number"
                defaultValue={0}
                disabled={goalForm.formState.isSubmitting}
                {...goalForm.register("startScore")}
                className="input"
              />
              {goalForm.formState.errors.startScore && (
                <p className="field-error">
                  {goalForm.formState.errors.startScore.message}
                </p>
              )}
            </div>
            <div>
              <label className="label">
                Целевой балл
              </label>
              <input
                type="number"
                defaultValue={80}
                disabled={goalForm.formState.isSubmitting}
                {...goalForm.register("targetScore")}
                className="input"
              />
              {goalForm.formState.errors.targetScore && (
                <p className="field-error">
                  {goalForm.formState.errors.targetScore.message}
                </p>
              )}
            </div>
          </div>
          <button
            type="submit"
            disabled={goalForm.formState.isSubmitting}
            className="btn-primary w-full"
          >
            {goalForm.formState.isSubmitting ? "Сохранение..." : "Сохранить цель"}
          </button>
        </form>
      </Modal>

      <Modal
        open={isResultModalOpen}
        title="Добавить результат пробника"
        onClose={() => setIsResultModalOpen(false)}
      >
        <form onSubmit={resultForm.handleSubmit(onSubmitResult)} className="space-y-4">
          <div>
            <label className="label">Предмет</label>
            <input
              type="text"
              placeholder="Математика"
              disabled={resultForm.formState.isSubmitting}
              {...resultForm.register("subject")}
              className="input"
            />
            {resultForm.formState.errors.subject && (
              <p className="field-error">
                {resultForm.formState.errors.subject.message}
              </p>
            )}
          </div>
          <div>
            <label className="label">
              Название работы / среза
            </label>
            <input
              type="text"
              placeholder="Пробник №1 (СтатГрад)"
              disabled={resultForm.formState.isSubmitting}
              {...resultForm.register("testName")}
              className="input"
            />
            {resultForm.formState.errors.testName && (
              <p className="field-error">
                {resultForm.formState.errors.testName.message}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">
                Набранный балл
              </label>
              <input
                type="number"
                placeholder="68"
                disabled={resultForm.formState.isSubmitting}
                {...resultForm.register("currentScore")}
                className="input"
              />
              {resultForm.formState.errors.currentScore && (
                <p className="field-error">
                  {resultForm.formState.errors.currentScore.message}
                </p>
              )}
            </div>
            <div>
              <label className="label">
                Максимум баллов
              </label>
              <input
                type="number"
                defaultValue={100}
                disabled={resultForm.formState.isSubmitting}
                {...resultForm.register("maxScore")}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="label">
              Дата проведения
            </label>
            <input
              type="date"
              disabled={resultForm.formState.isSubmitting}
              {...resultForm.register("testedAt")}
              className="input"
            />
            {resultForm.formState.errors.testedAt && (
              <p className="field-error">
                {resultForm.formState.errors.testedAt.message}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={resultForm.formState.isSubmitting}
            className="btn-primary w-full"
          >
            {resultForm.formState.isSubmitting ? "Сохранение..." : "Добавить результат"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
