"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Plus,
  Trash2,
  Phone,
  Search,
  Wallet,
  MoreVertical,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { ConfirmDialog } from "@/crm/components/ConfirmDialog";
import { Modal } from "@/crm/components/Modal";
import { useToast } from "@/crm/components/ToastProvider";
import { studentSchema, type StudentValues } from "@/crm/lib/schemas";
import type { Group, Student } from "@/crm/lib/types";
import { createStudent, deleteStudent, updateStudentBalance } from "./actions";
import Link from "next/link";

type StudentRow = Omit<Student, "transactions"> & {
  groups: Group[];
  transactions?: { amount: number }[];
};

export function StudentsClient({
  initialStudents,
  initialNextCursor,
  groups,
  userRole,
}: {
  initialStudents: StudentRow[];
  initialNextCursor: string | null;
  groups: Group[];
  userRole?: string;
}) {
  const showToast = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [students, setStudents] = useState(initialStudents);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [balanceModal, setBalanceModal] = useState<{
    open: boolean;
    studentId: string | null;
  }>({ open: false, studentId: null });

  const isTeacher = userRole === "TEACHER";

  useEffect(() => {
    if (searchQuery === "") {
      setStudents(initialStudents);
      setNextCursor(initialNextCursor);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await fetch(`/crm/api/students?search=${encodeURIComponent(searchQuery)}`);
      const json = await res.json();
      if (json.ok) {
        setStudents(json.students);
        setNextCursor(json.nextCursor);
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const loadMore = async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    const params = new URLSearchParams({ cursor: nextCursor });
    if (searchQuery) params.set("search", searchQuery);
    const res = await fetch(`/crm/api/students?${params.toString()}`);
    const json = await res.json();
    if (json.ok) {
      setStudents((prev) => [...prev, ...json.students]);
      setNextCursor(json.nextCursor);
    }
    setIsLoadingMore(false);
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(studentSchema),
    defaultValues: { name: "", phone: "", groupId: "" },
  });

  const onSubmit = async (data: StudentValues) => {
    const res = await createStudent(data);
    if (res?.error) {
      showToast(res.error, "error");
      return;
    }
    showToast("Студент успешно добавлен");
    setIsModalOpen(false);
    reset();
  };

  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(
    null,
  );

  const handleDelete = async (id: string) => {
    setBusyStudentId(id);
    const res = await deleteStudent(id);
    setBusyStudentId(null);
    setOpenMenuId(null);
    setDeleteCandidateId(null);
    if (res?.error) {
      showToast(res.error, "error");
      return;
    }
    showToast("Студент удален");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="page-title">Студенты</h1>
          <p className="page-subtitle">
            Управление базой учеников онлайн-школы
          </p>
        </div>
        {!isTeacher && (
          <button onClick={() => setIsModalOpen(true)} className="btn-primary">
            <Plus size={16} />
            Добавить студента
          </button>
        )}
      </div>

      <div className="flex max-w-md items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 shadow-sm transition-colors duration-150 focus-within:border-slate-400 focus-within:ring-4 focus-within:ring-slate-900/5">
        <Search size={17} className="shrink-0 text-slate-400" />
        <input
          type="text"
          placeholder="Поиск по имени или телефону..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Имя</th>
              {!isTeacher && <th>Телефон</th>}
              <th>Группы</th>
              {!isTeacher && <th className="text-right">Баланс</th>}
              {!isTeacher && <th className="w-10"></th>}
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const computedBalance =
                student.transactions?.reduce((sum, t) => sum + t.amount, 0) ||
                0;
              const isDebt = computedBalance < 0;

              return (
                <tr key={student.id}>
                  <td className="font-medium">
                    <Link
                      href={`/students/${student.id}`}
                      className="text-slate-900 underline-offset-2 transition-colors hover:text-accent hover:underline"
                    >
                      {student.fullName}
                    </Link>
                  </td>
                  {!isTeacher && (
                    <td className="text-slate-600">
                      {student.phone ? (
                        <span className="flex items-center gap-1.5">
                          <Phone size={14} className="text-slate-400" />
                          {student.phone}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  )}
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {student.groups?.length > 0 ? (
                        student.groups.map((g) => (
                          <span key={g.id} className="badge-neutral">
                            {g.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">
                          Не распределен
                        </span>
                      )}
                    </div>
                  </td>
                  {!isTeacher && (
                    <td className="text-right">
                      <span
                        className={`tabular-nums ${
                          isDebt
                            ? "badge-warning"
                            : computedBalance === 0
                              ? "badge-neutral"
                              : "badge-success"
                        }`}
                      >
                        {computedBalance.toLocaleString("ru-RU")} ₽
                      </span>
                    </td>
                  )}
                  {!isTeacher && (
                    <td className="relative">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            setBalanceModal({
                              open: true,
                              studentId: student.id,
                            })
                          }
                          className="icon-btn h-8 w-8"
                          title="Пополнить баланс"
                        >
                          <Wallet size={16} />
                        </button>
                        <button
                          onClick={() =>
                            setOpenMenuId(
                              openMenuId === student.id ? null : student.id,
                            )
                          }
                          className="icon-btn h-8 w-8"
                        >
                          <MoreVertical size={16} />
                        </button>
                      </div>

                      {openMenuId === student.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setOpenMenuId(null)}
                          />
                          <div className="absolute right-6 top-12 z-20 w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-card-hover">
                            <button
                              onClick={() => {
                                setOpenMenuId(null);
                                setDeleteCandidateId(student.id);
                              }}
                              disabled={busyStudentId === student.id}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-cancel transition-colors hover:bg-cancel/10 disabled:opacity-50"
                            >
                              <Trash2 size={14} />
                              Удалить
                            </button>
                          </div>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {students.length === 0 && (
              <tr>
                <td
                  colSpan={isTeacher ? 2 : 5}
                  className="px-6 py-12 text-center text-sm text-slate-500"
                >
                  Студенты не найдены
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <div className="flex justify-center">
          <button onClick={loadMore} disabled={isLoadingMore} className="btn-secondary">
            {isLoadingMore ? "Загрузка..." : "Показать ещё"}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={deleteCandidateId !== null}
        title="Удалить студента?"
        message="Карточка студента и его привязки к группам будут удалены."
        confirmLabel="Удалить"
        danger
        busy={busyStudentId !== null}
        onConfirm={() => deleteCandidateId && handleDelete(deleteCandidateId)}
        onClose={() => setDeleteCandidateId(null)}
      />

      <Modal
        open={isModalOpen}
        title="Добавить нового студента"
        onClose={() => setIsModalOpen(false)}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div>
            <label className="label">
              ФИО Студента *
            </label>
            <input
              {...register("name")}
              placeholder="Иванов Иван"
              className="input"
            />
            {errors.name && (
              <p className="field-error">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="label">
              Телефон
            </label>
            <input
              {...register("phone")}
              placeholder="+79991112233"
              className="input"
            />
            {errors.phone && (
              <p className="field-error">{errors.phone.message}</p>
            )}
          </div>

          <div>
            <label className="label">
              Начальная группа
            </label>
            <select
              {...register("groupId")}
              className="input"
            >
              <option value="">Выберите группу (необязательно)</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="btn-primary mt-2 w-full"
          >
            Создать карточку студента
          </button>
        </form>
      </Modal>

      <Modal
        open={balanceModal.open}
        title="Внести операцию (Ledger)"
        onClose={() => setBalanceModal({ open: false, studentId: null })}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const amount = Number(formData.get("amount"));
            const desc = formData.get("description") as string;

            if (balanceModal.studentId) {
              const res = await updateStudentBalance(
                balanceModal.studentId,
                amount,
                desc,
              );
              if (res?.error) {
                showToast(res.error, "error");
                return;
              }
              setBalanceModal({ open: false, studentId: null });
              showToast("Транзакция успешно зафиксирована");
            }
          }}
          className="space-y-4 pt-2"
        >
          <div>
            <label className="label">
              Сумма операции (₽) *
            </label>
            <input
              name="amount"
              type="number"
              placeholder="Пример: 5000 для прихода или -600 для списания"
              className="input"
              required
            />
            <p className="mt-1 text-xs text-slate-500">
              Положительное число — пополнение баланса, отрицательное — ручное
              списание.
            </p>
          </div>

          <div>
            <label className="label">
              Основание / Комментарий
            </label>
            <input
              name="description"
              placeholder="Оплата абонемента на октябрь / Корректировка"
              className="input"
            />
          </div>

          <button
            type="submit"
            className="btn-primary mt-2 w-full"
          >
            Провести транзакцию
          </button>
        </form>
      </Modal>
    </div>
  );
}
