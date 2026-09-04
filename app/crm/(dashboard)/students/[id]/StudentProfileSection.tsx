"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/crm/components/ToastProvider";
import { gradeValues, type ExamType } from "@/crm/lib/schemas";
import { updateStudent } from "../actions";

export interface StudentProfileInitial {
  name: string;
  phone: string;
  email: string;
  parentName: string;
  parentPhone: string;
  comment: string;
  grade: number | null;
  examType: ExamType | null;
  subject: string;
}

/**
 * Editable student profile card (ADMIN/MANAGER). Provides an unambiguous save
 * control and explicit "saved" feedback, and persists parent contact, grade,
 * exam type, subject and comment through the `updateStudent` server action
 * (DATA-01/DATA-03). Values round-trip: what is saved reloads populated.
 */
export function StudentProfileSection({
  studentId,
  initial,
}: {
  studentId: string;
  initial: StudentProfileInitial;
}) {
  const showToast = useToast();
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [form, setForm] = useState({
    name: initial.name,
    phone: initial.phone,
    email: initial.email,
    parentName: initial.parentName,
    parentPhone: initial.parentPhone,
    comment: initial.comment,
    grade: initial.grade ? String(initial.grade) : "",
    examType: initial.examType ?? "",
    subject: initial.subject,
  });

  const set = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    setSavedAt(null);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateStudent(studentId, {
        name: form.name,
        phone: form.phone,
        email: form.email,
        parentName: form.parentName,
        parentPhone: form.parentPhone,
        comment: form.comment,
        grade: form.grade === "" ? undefined : Number(form.grade),
        examType: form.examType === "" ? undefined : (form.examType as ExamType),
        subject: form.subject,
      });
      if (res?.error) {
        showToast(res.error, "error");
        return;
      }
      setSavedAt(Date.now());
      showToast("Изменения сохранены");
    });
  };

  return (
    <section className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Профиль студента</h2>
        {savedAt && !pending && (
          <span className="text-sm text-emerald-600">Сохранено ✓</span>
        )}
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">ФИО студента *</label>
            <input className="input" value={form.name} onChange={set("name")} />
          </div>
          <div>
            <label className="label">Телефон</label>
            <input
              className="input"
              value={form.phone}
              onChange={set("phone")}
              placeholder="+79991112233"
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={set("email")}
              placeholder="student@example.com"
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">Имя родителя</label>
            <input
              className="input"
              value={form.parentName}
              onChange={set("parentName")}
              placeholder="Мария Иванова"
            />
          </div>
          <div>
            <label className="label">Телефон родителя</label>
            <input
              className="input"
              value={form.parentPhone}
              onChange={set("parentPhone")}
              placeholder="+79991112233"
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="label">Класс</label>
            <select className="input" value={form.grade} onChange={set("grade")}>
              <option value="">—</option>
              {gradeValues.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Экзамен</label>
            <select
              className="input"
              value={form.examType}
              onChange={set("examType")}
            >
              <option value="">—</option>
              <option value="OGE">ОГЭ</option>
              <option value="EGE">ЕГЭ</option>
            </select>
          </div>
          <div>
            <label className="label">Предмет</label>
            <input
              className="input"
              value={form.subject}
              onChange={set("subject")}
              placeholder="Математика"
            />
          </div>
        </div>

        <div>
          <label className="label">Комментарий</label>
          <textarea
            className="input"
            rows={3}
            value={form.comment}
            onChange={set("comment")}
            placeholder="Операционные заметки о студенте"
          />
        </div>

        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Сохранение…" : "Сохранить"}
        </button>
      </form>
    </section>
  );
}
