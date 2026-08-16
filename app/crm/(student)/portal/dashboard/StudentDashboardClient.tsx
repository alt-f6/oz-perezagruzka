"use client";

import { BookOpen, Calendar } from "lucide-react";
import { PortalTopBar } from "@/crm/components/PortalTopBar";
import {
  ATTENDANCE_STATUS_CLASSES,
  ATTENDANCE_STATUS_LABELS,
  type AttendanceRecord,
  type StudentExamGoal,
  type StudentExamResult,
} from "@/crm/lib/types";
import type { StudentLessonRow } from "./page";
import { OgeProgressChart } from "./OgeProgressChart";

function getGroupName(lesson: StudentLessonRow): string {
  const group = Array.isArray(lesson.group) ? lesson.group[0] : lesson.group;
  return group?.name ?? "Группа";
}

export function StudentDashboardClient({
  studentName,
  upcomingLessons,
  pastLessons,
  attendance,
  examGoals,
  examResults,
}: {
  studentName: string;
  upcomingLessons: StudentLessonRow[];
  pastLessons: StudentLessonRow[];
  attendance: AttendanceRecord[];
  examGoals: StudentExamGoal[];
  examResults: StudentExamResult[];
}) {
  const attendanceByLesson = new Map(attendance.map((a) => [a.classSessionId, a]));

  return (
    <div className="space-y-4">
      <PortalTopBar
        title={`Здравствуйте, ${studentName}!`}
        subtitle="Личный кабинет ученика"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-accent">
            <Calendar size={18} className="text-accent/60" />
            Ближайшие занятия
          </h2>
          {upcomingLessons.length > 0 ? (
            <div className="divide-y divide-border">
              {upcomingLessons.map((lesson) => (
                <div key={lesson.id} className="py-2.5">
                  <p className="text-sm font-semibold text-accent">
                    {getGroupName(lesson)}
                  </p>
                  <p className="text-xs text-accent/50">
                    {new Date(lesson.scheduledAt).toLocaleString("ru-RU", {
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-accent/40">
              Занятий не запланировано
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-accent">
            <BookOpen size={18} className="text-accent/60" />
            Прошедшие занятия
          </h2>
          {pastLessons.length > 0 ? (
            <div className="divide-y divide-border">
              {[...pastLessons].reverse().map((lesson) => {
                const record = attendanceByLesson.get(lesson.id);
                return (
                  <div key={lesson.id} className="py-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-accent">
                        {getGroupName(lesson)}
                      </p>
                      {record && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ATTENDANCE_STATUS_CLASSES[record.status]}`}
                        >
                          {ATTENDANCE_STATUS_LABELS[record.status]}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-accent/50">
                      {new Date(lesson.scheduledAt).toLocaleDateString("ru-RU")}
                      {record?.grade != null && ` · Оценка: ${record.grade}`}
                      {record && ` · ДЗ: ${record.homeworkCompleted ? "выполнено" : "не выполнено"}`}
                    </p>
                    {record?.comment && (
                      <p className="text-xs italic text-accent/70">
                        «{record.comment}»
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-accent/40">
              Занятий ещё не было
            </p>
          )}
        </div>
      </div>

      <OgeProgressChart examGoals={examGoals} examResults={examResults} />
    </div>
  );
}
