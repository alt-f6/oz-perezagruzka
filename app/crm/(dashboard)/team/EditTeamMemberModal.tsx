"use client";

import { useState } from "react";
import { Modal } from "@/crm/components/Modal";
import { useToast } from "@/crm/components/ToastProvider";
import { updateTeamMember } from "./actions";

export interface EditableMember {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  subjects: string | null;
}

export function EditTeamMemberModal({
  member,
  open,
  onClose,
}: {
  member: EditableMember | null;
  open: boolean;
  onClose: () => void;
}) {
  const showToast = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subjects, setSubjects] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prevMember, setPrevMember] = useState(member);

  if (member !== prevMember) {
    setPrevMember(member);
    if (member) {
      setFullName(member.fullName ?? "");
      setEmail(member.email ?? "");
      setPhone(member.phone ?? "");
      setSubjects(member.subjects ?? "");
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!member) return;

    setIsSubmitting(true);
    try {
      const result = await updateTeamMember({
        id: member.id,
        fullName,
        email,
        phone,
        subjects,
      });
      if (result?.error) {
        showToast(result.error, "error");
        return;
      }
      showToast("Данные сотрудника обновлены");
      onClose();
    } catch {
      showToast("Не удалось обновить сотрудника", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} title="Редактировать сотрудника" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">ФИО</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="input"
            disabled={isSubmitting}
            required
          />
        </div>
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label className="label">Телефон</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+7 900 000-00-00"
            className="input"
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label className="label">Предметы</label>
          <input
            type="text"
            value={subjects}
            onChange={(e) => setSubjects(e.target.value)}
            placeholder="Математика, Физика"
            className="input"
            disabled={isSubmitting}
          />
          <p className="mt-1.5 text-xs text-slate-500">
            Ставку оплаты можно настроить на странице «Зарплата».
          </p>
        </div>
        <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
          {isSubmitting ? "Сохранение..." : "Сохранить"}
        </button>
      </form>
    </Modal>
  );
}
