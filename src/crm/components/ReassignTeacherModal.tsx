"use client";

import { useState } from "react";
import { Modal } from "@/crm/components/Modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";

export function ReassignTeacherModal({
  open,
  sessionCount,
  teachers,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  sessionCount: number;
  teachers: { id: string; fullName: string }[];
  busy: boolean;
  onConfirm: (newTeacherId: string) => void;
  onClose: () => void;
}) {
  const [teacherId, setTeacherId] = useState("");

  return (
    <Modal open={open} title="Сменить преподавателя" onClose={busy ? () => {} : onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Занятий к переносу: {sessionCount}. Групповые занятия недоступны для массового переноса — смените
          преподавателя группы на странице группы.
        </p>
        <Select value={teacherId} onValueChange={setTeacherId}>
          <SelectTrigger>
            <SelectValue placeholder="Выберите преподавателя" />
          </SelectTrigger>
          <SelectContent>
            {teachers.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex justify-end gap-2.5">
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">
            Отмена
          </button>
          <button
            type="button"
            onClick={() => teacherId && onConfirm(teacherId)}
            disabled={busy || !teacherId}
            className="btn-primary"
          >
            {busy ? "Сохранение..." : "Сменить"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
