"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Plus,
  Trash2,
  Users,
  Banknote,
  UserPlus,
  X,
  CalendarX,
  Pencil,
  Loader2,
} from "lucide-react";
import React, { useOptimistic, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { ConfirmDialog } from "@/crm/components/ConfirmDialog";
import { Modal } from "@/crm/components/Modal";
import { useToast } from "@/crm/components/ToastProvider";
import { groupSchema, type GroupValues } from "@/crm/lib/schemas";
import type { GroupWithDetails, User } from "@/crm/lib/types";
import {
  assignStudentToGroup,
  removeStudentFromGroup,
} from "../students/actions";
import {
  assignTeacherToGroup,
  cancelGroupUpcomingSessions,
  createGroup,
  deleteGroup,
  updateGroup,
} from "./actions";

interface StudentLookup {
  id: string;
  fullName: string;
}

export function GroupsClient({
  groups,
  teachers,
  allStudents,
  userRole,
}: {
  groups: GroupWithDetails[];
  teachers: User[];
  allStudents: StudentLookup[];
  userRole?: string;
}) {
  const showToast = useToast();
  const isTeacher = userRole === "TEACHER";

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [manageGroup, setManageGroup] = useState<GroupWithDetails | null>(null);
  const [editGroup, setEditGroup] = useState<GroupWithDetails | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(
    null,
  );
  const [clearScheduleCandidateId, setClearScheduleCandidateId] = useState<string | null>(null);
  const [isClearingSchedule, setIsClearingSchedule] = useState(false);
  const [isUpdatingStudents, setIsUpdatingStudents] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");

  const [savingTeacherGroupId, setSavingTeacherGroupId] = useState<
    string | null
  >(null);
  const [, startTeacherTransition] = useTransition();
  const [optimisticGroups, applyOptimisticTeacher] = useOptimistic(
    groups,
    (
      state: GroupWithDetails[],
      update: { groupId: string; teacherId: string | null; teacherName: string | null },
    ) =>
      state.map((g) =>
        g.id === update.groupId
          ? {
              ...g,
              teacherId: update.teacherId,
              teacher: update.teacherName ? { fullName: update.teacherName } : null,
            }
          : g,
      ),
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GroupValues>({
    resolver: zodResolver(groupSchema),
  });

  const onSubmit = async (
    data: GroupValues,
    event?: React.BaseSyntheticEvent,
  ) => {
    try {
      if (!event) return;

      const targetForm = event.target as HTMLFormElement;
      const formData = new globalThis.FormData(targetForm);

      const teacherId = (formData.get("teacherId") as string) || undefined;
      const priceInput = formData.get("price");
      const price = priceInput ? Number(priceInput) : undefined;

      const result = await createGroup({
        ...data,
        teacherId,
        price,
      });

      if (result?.error) {
        showToast(result.error, "error");
        return;
      }

      showToast("Группа создана");
      reset();
      setIsModalOpen(false);
    } catch {
      showToast("Не удалось создать группу", "error");
    }
  };

  const handleDelete = async (groupId: string) => {
    setDeletingId(groupId);
    setDeleteCandidateId(null);
    try {
      const result = await deleteGroup(groupId);
      if (result?.error) {
        showToast(result.error, "error");
      } else {
        showToast("Группа удалена");
      }
    } catch {
      showToast("Не удалось удалить группу", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearSchedule = async (groupId: string) => {
    setIsClearingSchedule(true);
    try {
      const result = await cancelGroupUpcomingSessions(groupId);
      if (result?.error) {
        showToast(result.error, "error");
      } else {
        showToast("Расписание группы очищено");
      }
    } catch {
      showToast("Не удалось очистить расписание", "error");
    } finally {
      setIsClearingSchedule(false);
      setClearScheduleCandidateId(null);
    }
  };

  const handleAddStudent = async () => {
    if (!manageGroup || !selectedStudentId) return;
    setIsUpdatingStudents(true);
    try {
      const result = await assignStudentToGroup(
        selectedStudentId,
        manageGroup.id,
      );
      if (result?.error) {
        showToast(result.error, "error");
      } else {
        showToast("Ученик добавлен в группу");
        setSelectedStudentId("");
        setManageGroup(null);
      }
    } catch {
      showToast("Ошибка при добавлении ученика", "error");
    } finally {
      setIsUpdatingStudents(false);
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (!manageGroup) return;
    setIsUpdatingStudents(true);
    try {
      const result = await removeStudentFromGroup(studentId, manageGroup.id);
      if (result?.error) {
        showToast(result.error, "error");
      } else {
        showToast("Ученик удален из группы");
        setManageGroup(null);
      }
    } catch {
      showToast("Ошибка при удалении ученика", "error");
    } finally {
      setIsUpdatingStudents(false);
    }
  };

  const handleAssignTeacher = (groupId: string, teacherId: string) => {
    const teacherName =
      teachers.find((t) => t.id === teacherId)?.fullName ?? null;
    setSavingTeacherGroupId(groupId);
    startTeacherTransition(async () => {
      applyOptimisticTeacher({
        groupId,
        teacherId: teacherId || null,
        teacherName: teacherId ? teacherName : null,
      });
      try {
        const result = await assignTeacherToGroup(groupId, teacherId || null);
        if (result?.error) {
          showToast(result.error, "error");
        } else {
          showToast("Преподаватель обновлён");
        }
      } catch {
        showToast("Не удалось назначить преподавателя", "error");
      } finally {
        setSavingTeacherGroupId(null);
      }
    });
  };

  const handleEditGroup = async (
    data: { name: string; teacherId: string; price: string },
  ) => {
    if (!editGroup) return;
    setIsSavingEdit(true);
    try {
      const result = await updateGroup(editGroup.id, {
        name: data.name,
        teacherId: data.teacherId || null,
        price: Number(data.price),
      });
      if (result?.error) {
        showToast(result.error, "error");
      } else {
        showToast("Группа обновлена");
        setEditGroup(null);
      }
    } catch {
      showToast("Не удалось обновить группу", "error");
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="page-title">Группы</h1>
          <p className="page-subtitle">
            Учебные потоки, составы и стоимость занятий
          </p>
        </div>
        {!isTeacher && (
          <button onClick={() => setIsModalOpen(true)} className="btn-primary">
            <Plus size={16} /> Добавить группу
          </button>
        )}
      </div>

      {optimisticGroups.length === 0 && (
        <div className="empty-state">
          <Users size={28} className="text-slate-300" />
          <p className="font-medium text-slate-600">Групп пока нет</p>
          {!isTeacher && <p>Создайте первую группу, чтобы начать работу</p>}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {optimisticGroups.map((group) => (
          <div
            key={group.id}
            className="card card-hover flex flex-col justify-between p-5"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold tracking-tight text-slate-900">
                  {group.name}
                </h3>
                {!isTeacher && (
                  <div className="-mr-1.5 -mt-1 flex items-center gap-1">
                    <button
                      onClick={() => setEditGroup(group)}
                      className="icon-btn"
                      title="Редактировать группу"
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      onClick={() => setClearScheduleCandidateId(group.id)}
                      className="icon-btn-danger"
                      title="Очистить будущее расписание"
                    >
                      <CalendarX size={17} />
                    </button>
                    <button
                      onClick={() => setDeleteCandidateId(group.id)}
                      disabled={deletingId === group.id}
                      className="icon-btn-danger"
                      title="Удалить группу"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {!isTeacher && (
                  <span className="badge-neutral">
                    <Banknote size={13} />{" "}
                    {(group.pricePerLesson || 0).toLocaleString("ru-RU")} ₽ / урок
                  </span>
                )}
                <span className="badge-neutral">
                  <Users size={13} /> Студентов: {group.students?.length || 0}
                </span>
                {!isTeacher && (
                  <span className="badge-info relative inline-flex items-center gap-1.5 pr-1">
                    <select
                      value={group.teacherId ?? ""}
                      disabled={savingTeacherGroupId === group.id}
                      onChange={(e) => handleAssignTeacher(group.id, e.target.value)}
                      className="cursor-pointer appearance-none bg-transparent pr-1 outline-none disabled:cursor-wait"
                      title="Изменить преподавателя"
                    >
                      <option value="">Без преподавателя</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.fullName}
                        </option>
                      ))}
                    </select>
                    {savingTeacherGroupId === group.id && (
                      <Loader2 size={12} className="animate-spin" />
                    )}
                  </span>
                )}
              </div>

              <div className="mt-5">
                <p className="overline mb-2">Состав группы</p>
                {group.students && group.students.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {group.students.map((st) => (
                      <span
                        key={st.id}
                        className="inline-block rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                      >
                        {st.fullName}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    Студенты ещё не добавлены
                  </p>
                )}
              </div>
            </div>

            {!isTeacher && (
              <div className="divider mt-5 pt-3.5">
                <button
                  onClick={() => setManageGroup(group)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 transition-colors hover:text-slate-900"
                >
                  <UserPlus size={14} /> Управлять составом группы
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={deleteCandidateId !== null}
        title="Удалить группу?"
        message="Группа и её расписание будут удалены. Ученики останутся в базе."
        confirmLabel="Удалить"
        danger
        busy={deletingId !== null}
        onConfirm={() => deleteCandidateId && handleDelete(deleteCandidateId)}
        onClose={() => setDeleteCandidateId(null)}
      />

      <ConfirmDialog
        open={clearScheduleCandidateId !== null}
        title="Очистить будущее расписание группы?"
        message="Будут отменены все предстоящие занятия этой группы. Прошедшие занятия и история посещаемости затронуты не будут."
        confirmLabel="Очистить"
        danger
        busy={isClearingSchedule}
        reasonLabel="Причина"
        reasonPlaceholder="Например: группа расформирована"
        onConfirm={() =>
          clearScheduleCandidateId && handleClearSchedule(clearScheduleCandidateId)
        }
        onClose={() => setClearScheduleCandidateId(null)}
      />

      {!isTeacher && (
        <Modal
          open={isModalOpen}
          title="Новая группа"
          onClose={() => setIsModalOpen(false)}
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Название группы</label>
              <input
                type="text"
                disabled={isSubmitting}
                {...register("name")}
                className="input"
              />
              {errors.name && (
                <p className="field-error">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="label">Стоимость одного занятия (₽)</label>
              <input
                type="number"
                disabled={isSubmitting}
                name="price"
                placeholder="0"
                className="input"
              />
            </div>

            <div>
              <label className="label">Назначить педагога</label>
              <select disabled={isSubmitting} name="teacherId" className="input">
                <option value="">Без преподавателя</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full"
            >
              {isSubmitting ? "Создание..." : "Создать"}
            </button>
          </form>
        </Modal>
      )}

      {!isTeacher && (
        <Modal
          open={manageGroup !== null}
          title={`Состав группы: ${manageGroup?.name || ""}`}
          onClose={() => setManageGroup(null)}
        >
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="overline mb-2 block">
                Добавить ученика в группу
              </label>
              <div className="mt-1 flex gap-2">
                <select
                  value={selectedStudentId}
                  disabled={isUpdatingStudents}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="input flex-1 py-2"
                >
                  <option value="">Выберите ученика...</option>
                  {allStudents
                    .filter(
                      (st) =>
                        !manageGroup?.students?.some(
                          (curr) => curr.id === st.id,
                        ),
                    )
                    .map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.fullName}
                      </option>
                    ))}
                </select>
                <button
                  onClick={handleAddStudent}
                  disabled={isUpdatingStudents || !selectedStudentId}
                  className="btn-primary shrink-0 px-3.5 py-2 text-xs"
                >
                  Добавить
                </button>
              </div>
            </div>

            <div>
              <label className="overline mb-2 block">
                Текущие студенты ({manageGroup?.students?.length || 0})
              </label>

              {manageGroup?.students && manageGroup.students.length > 0 ? (
                <div className="max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                  {manageGroup.students.map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between py-2 pl-3.5 pr-2 text-sm transition-colors hover:bg-slate-50"
                    >
                      <span className="font-medium text-slate-900">
                        {student.fullName}
                      </span>
                      <button
                        onClick={() => handleRemoveStudent(student.id)}
                        disabled={isUpdatingStudents}
                        className="icon-btn-danger h-8 w-8"
                        title="Исключить из группы"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
                  В группе пока нет учеников
                </p>
              )}
            </div>
          </div>
        </Modal>
      )}

      {!isTeacher && (
        <Modal
          open={editGroup !== null}
          title="Редактировать группу"
          onClose={() => setEditGroup(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new globalThis.FormData(e.currentTarget);
              handleEditGroup({
                name: String(formData.get("name") || ""),
                teacherId: String(formData.get("teacherId") || ""),
                price: String(formData.get("price") || "0"),
              });
            }}
            className="space-y-4"
          >
            <div>
              <label className="label">Название группы</label>
              <input
                type="text"
                name="name"
                defaultValue={editGroup?.name}
                disabled={isSavingEdit}
                className="input"
              />
            </div>

            <div>
              <label className="label">Стоимость одного занятия (₽)</label>
              <input
                type="number"
                name="price"
                defaultValue={editGroup?.pricePerLesson ?? 0}
                disabled={isSavingEdit}
                className="input"
              />
            </div>

            <div>
              <label className="label">Преподаватель</label>
              <select
                name="teacherId"
                defaultValue={editGroup?.teacherId ?? ""}
                disabled={isSavingEdit}
                className="input"
              >
                <option value="">Без преподавателя</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={isSavingEdit}
              className="btn-primary w-full"
            >
              {isSavingEdit ? "Сохранение..." : "Сохранить"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
