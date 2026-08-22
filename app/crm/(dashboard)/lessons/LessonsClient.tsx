"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { CalendarDays, ChevronRight, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { LessonFormFields } from "@/crm/components/LessonFormFields";
import { Modal } from "@/crm/components/Modal";
import { useToast } from "@/crm/components/ToastProvider";
import { lessonSchema, type LessonValues } from "@/crm/lib/schemas";
import type { ClassSessionWithGroup, Group } from "@/crm/lib/types";
import { createLesson, deleteLesson } from "./actions";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "long",
  timeStyle: "short",
});

export function LessonsClient({
  lessons,
  groups,
}: {
  lessons: ClassSessionWithGroup[];
  groups: Group[];
}) {
  const showToast = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LessonValues>({
    resolver: zodResolver(lessonSchema),
    defaultValues: { recurrence: "NONE", recurrenceDays: [] },
  });

  const onSubmit = async (values: LessonValues) => {
    try {
      const result = await createLesson(values);

      if (result?.error) {
        showToast(result.error, "error");
        return;
      }

      showToast(
        values.recurrence === "NONE" ? "Занятие создано" : "Занятия созданы",
      );
      reset();
      setIsModalOpen(false);
    } catch {
      showToast("Не удалось создать занятие", "error");
    }
  };

  const handleDelete = async (lessonId: string) => {
    setDeletingId(lessonId);
    try {
      const result = await deleteLesson(lessonId);

      if (result?.error) {
        showToast(result.error, "error");
        return;
      }

      showToast("Занятие удалено");
    } catch {
      showToast("Не удалось удалить занятие", "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="page-title">Занятия</h1>
          <p className="page-subtitle">
            Все уроки школы и переход к посещаемости
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="btn-primary"
        >
          <Plus size={16} />
          Новое занятие
        </button>
      </div>

      {lessons.length === 0 ? (
        <div className="empty-state">
          <CalendarDays size={28} className="text-slate-300" />
          <p className="font-medium text-slate-600">Пока нет занятий</p>
          <p>Запланируйте первое занятие</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lessons.map((lesson) => (
            <motion.div
              key={lesson.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="card card-hover flex items-center justify-between gap-4 p-4"
            >
              <div className="flex min-w-0 items-center gap-4">
                <div className="icon-tile h-11 w-11 bg-slate-100 text-slate-600">
                  <CalendarDays size={19} />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold tracking-tight text-slate-900">
                    {lesson.group.name}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {dateFormatter.format(new Date(lesson.scheduledAt))}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleDelete(lesson.id)}
                  disabled={deletingId === lesson.id}
                  className="icon-btn-danger"
                  title="Удалить занятие"
                >
                  <Trash2 size={16} />
                </button>
                <Link
                  href={`/lessons/${lesson.id}`}
                  className="btn-secondary px-3.5 py-2 text-xs"
                >
                  Посещаемость
                  <ChevronRight size={14} />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Modal
        open={isModalOpen}
        title="Новое занятие"
        onClose={() => setIsModalOpen(false)}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <LessonFormFields
            register={register}
            watch={watch}
            setValue={setValue}
            errors={errors}
            groups={groups}
            isSubmitting={isSubmitting}
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full"
          >
            {isSubmitting ? "Создание..." : "Создать"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
