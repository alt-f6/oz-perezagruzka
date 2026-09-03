"use client";

import { ArrowLeft } from "lucide-react";
import NextLink from "next/link";
import { useState } from "react";
import { useToast } from "@/crm/components/ToastProvider";
import {
  ATTENDANCE_STATUS_CLASSES,
  ATTENDANCE_STATUS_LABELS,
  type AttendanceRecord,
  type AttendanceStatus,
  type ClassSessionWithGroup,
  type MakeupLessonOption,
  type Student,
} from "@/crm/lib/types";
import { assignMakeupLesson, setAttendance } from "../actions";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "long",
  timeStyle: "short",
});

const ATTENDANCE_STATUSES: { value: AttendanceStatus; label: string }[] = [
  { value: "PRESENT", label: "Был" },
  { value: "ABSENT", label: "Прогул (списание)" },
  { value: "EXCUSED", label: "Болезнь (справка)" },
  { value: "CANCELLED_BY_CENTER", label: "Отменено центром" },
];

const GRADES = [0, 1, 2, 3, 4, 5];

type StudentWithTransactions = Student & {
  transactions?: { amount: number }[];
};

export function AttendanceClient({
  lesson,
  students,
  attendance,
  userRole,
  makeupOptions,
}: {
  lesson: ClassSessionWithGroup;
  students: StudentWithTransactions[];
  attendance: AttendanceRecord[];
  userRole?: string;
  makeupOptions: MakeupLessonOption[];
}) {
  const showToast = useToast();
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);

  const isTeacher = userRole === "TEACHER";

  const recordFor = (studentId: string) =>
    attendance.find((record) => record.studentId === studentId);

  const updateAttendanceData = async (
    studentId: string,
    update: {
      status?: AttendanceStatus;
      grade?: number | null;
      homeworkCompleted?: boolean;
    },
  ) => {
    setBusyStudentId(studentId);
    try {
      const result = await setAttendance(lesson.id, studentId, update);
      if (result?.error) {
        showToast(result.error, "error");
        return;
      }
      showToast("Журнал обновлен");
    } catch {
      showToast("Не удалось обновить данные", "error");
    } finally {
      setBusyStudentId(null);
    }
  };

  const [makeupSelection, setMakeupSelection] = useState<
    Record<string, string>
  >({});
  const [busyMakeupId, setBusyMakeupId] = useState<string | null>(null);

  const handleAssignMakeup = async (
    attendanceId: string,
    targetLessonId: string,
  ) => {
    if (!targetLessonId) {
      showToast("Выберите занятие для отработки", "error");
      return;
    }
    setBusyMakeupId(attendanceId);
    try {
      const result = await assignMakeupLesson({
        attendanceId,
        targetLessonId,
      });
      if (result?.error) {
        showToast(result.error, "error");
        return;
      }
      showToast("Отработка назначена");
    } catch {
      showToast("Не удалось назначить отработку", "error");
    } finally {
      setBusyMakeupId(null);
    }
  };

  return (
    <div className="space-y-6">
      <NextLink
        href="/lessons"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900"
      >
        <ArrowLeft size={15} />
        Все занятия
      </NextLink>

      <div>
        <h1 className="page-title">
          {lesson.group?.name ??
            lesson.student?.fullName ??
            "Индивидуальное занятие"}
        </h1>
        <p className="page-subtitle">
          {lesson.group ? "Групповое занятие · " : "Индивидуальное занятие · "}
          {dateFormatter.format(new Date(lesson.scheduledAt))}
        </p>
      </div>

      {students.length === 0 ? (
        <div className="empty-state bg-white">
          {lesson.group
            ? "В этой группе пока нет студентов."
            : "К этому занятию не привязан ученик."}
        </div>
      ) : (
        <div className="table-wrap">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Студент</th>
                  {!isTeacher && <th>Баланс</th>}
                  <th>Посещаемость</th>
                  <th>Оценка</th>
                  <th>Домашнее задание</th>
                  <th>Отработка</th>
                  {!isTeacher && <th>Списание</th>}
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const record = recordFor(student.id);
                  const isBusy = busyStudentId === student.id;

                  const currentStatus = record?.status ?? "PRESENT";
                  const currentHomeworkCompleted =
                    record?.homeworkCompleted ?? false;
                  const currentGrade = record?.grade ?? "";

                  const currentBalance =
                    student.transactions?.reduce(
                      (sum, t) => sum + Number(t.amount),
                      0,
                    ) || 0;

                  return (
                    <tr key={student.id}>
                      <td className="whitespace-nowrap font-semibold">
                        {student.fullName}
                      </td>

                      {!isTeacher && (
                        <td className="whitespace-nowrap">
                          <span
                            className={`tabular-nums ${
                              currentBalance < 0
                                ? "badge-warning"
                                : currentBalance === 0
                                  ? "badge-neutral"
                                  : "badge-success"
                            }`}
                          >
                            {currentBalance.toLocaleString("ru-RU")} ₽
                          </span>
                        </td>
                      )}

                      <td className="whitespace-nowrap">
                        <select
                          value={currentStatus}
                          disabled={isBusy}
                          onChange={(e) =>
                            updateAttendanceData(student.id, {
                              status: e.target.value as AttendanceStatus,
                            })
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-sm outline-none transition-all duration-200 focus:border-accent/50 focus:ring-2 focus:ring-accent/10 disabled:opacity-50"
                        >
                          {ATTENDANCE_STATUSES.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="whitespace-nowrap">
                        <select
                          value={currentGrade}
                          disabled={isBusy}
                          onChange={(e) =>
                            updateAttendanceData(student.id, {
                              grade: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-sm outline-none transition-all duration-200 focus:border-accent/50 focus:ring-2 focus:ring-accent/10 disabled:opacity-50"
                        >
                          <option value="">Нет оценки</option>
                          {GRADES.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={currentHomeworkCompleted}
                          disabled={isBusy}
                          onChange={(e) =>
                            updateAttendanceData(student.id, {
                              homeworkCompleted: e.target.checked,
                            })
                          }
                          className="h-4 w-4 rounded border-slate-200 accent-accent"
                        />
                      </td>

                      <td className="whitespace-nowrap">
                        {currentStatus !== "EXCUSED" || !record ? (
                          <span className="text-xs text-slate-500">—</span>
                        ) : (() => {
                            const makeupRecord = Array.isArray(record.makeup)
                              ? record.makeup[0]
                              : record.makeup;
                            if (makeupRecord) {
                              const targetGroup = Array.isArray(
                                makeupRecord.targetClassSession?.group,
                              )
                                ? makeupRecord.targetClassSession?.group[0]
                                : makeupRecord.targetClassSession?.group;
                              return (
                                <span className="text-xs font-medium text-slate-900">
                                  {targetGroup?.name ?? "Группа"}
                                  {makeupRecord.targetClassSession &&
                                    ` · ${new Date(
                                      makeupRecord.targetClassSession.scheduledAt,
                                    ).toLocaleDateString("ru-RU")}`}
                                </span>
                              );
                            }
                            return (
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={makeupSelection[record.id] ?? ""}
                                  disabled={busyMakeupId === record.id}
                                  onChange={(e) =>
                                    setMakeupSelection((prev) => ({
                                      ...prev,
                                      [record.id]: e.target.value,
                                    }))
                                  }
                                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-sm outline-none transition-all duration-200 focus:border-accent/50 focus:ring-2 focus:ring-accent/10 disabled:opacity-50"
                                >
                                  <option value="">Выбрать занятие...</option>
                                  {makeupOptions.map((option) => {
                                    const group = Array.isArray(option.group)
                                      ? option.group[0]
                                      : option.group;
                                    return (
                                      <option key={option.id} value={option.id}>
                                        {group?.name ?? "Группа"} ·{" "}
                                        {new Date(
                                          option.scheduledAt,
                                        ).toLocaleDateString("ru-RU")}
                                      </option>
                                    );
                                  })}
                                </select>
                                <button
                                  type="button"
                                  disabled={busyMakeupId === record.id}
                                  onClick={() =>
                                    handleAssignMakeup(
                                      record.id,
                                      makeupSelection[record.id] ?? "",
                                    )
                                  }
                                  className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-accent/90 active:scale-[0.98] disabled:opacity-50"
                                >
                                  Назначить
                                </button>
                              </div>
                            );
                          })()}
                      </td>

                      {!isTeacher && (
                        <td className="whitespace-nowrap">
                          <span
                            className={`rounded-lg px-2.5 py-1 text-xs font-medium border ${ATTENDANCE_STATUS_CLASSES[currentStatus]}`}
                          >
                            {ATTENDANCE_STATUS_LABELS[currentStatus]}
                          </span>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
