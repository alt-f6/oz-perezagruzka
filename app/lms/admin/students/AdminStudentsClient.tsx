"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { KeyRound, RefreshCw, Trash2 } from "lucide-react";

import { Badge } from "@/shared/components/ui/badge";
import { Button, buttonVariants } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/components/ui/alert-dialog";

type Student = {
  id: string;
  email: string;
  role: "STUDENT";
  fullName: string;
};

const ERROR_COPY: Record<string, string> = {
  email_exists: "Email уже существует",
  weak_password: "Пароль минимум 8 символов",
  bad_email: "Некорректный email",
  bad_name: "Имя и фамилия обязательны",
};

export default function AdminStudentsClient() {
  const [students, setStudents] = useState<Student[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, startCreateTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  async function load() {
    const r = await fetch("/api/admin/students", { cache: "no-store" });
    const j = await r.json();
    if (j.ok) setStudents(j.students ?? []);
  }

  useEffect(() => {
    load().finally(() => setIsLoading(false));
  }, []);

  async function refresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  const canCreate = useMemo(() => {
    return (
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      email.trim().length > 0 &&
      password.length >= 8 &&
      !isCreating
    );
  }, [firstName, lastName, email, password, isCreating]);

  function createStudent() {
    if (!canCreate) return;
    setCreateError(null);

    startCreateTransition(async () => {
      const r = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          password,
        }),
      });
      const j = await r.json().catch(() => ({}));

      if (!r.ok || !j.ok) {
        setCreateError(ERROR_COPY[j?.error] ?? "Ошибка создания");
        return;
      }

      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      await load();
    });
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Ученики</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Клик по ученику откроет страницу доступов.
          </p>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Создать аккаунт ученика</CardTitle>
          </CardHeader>

          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createStudent();
              }}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              <div className="grid gap-1.5">
                <Label htmlFor="firstName">Имя</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Иван"
                  autoComplete="off"
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="lastName">Фамилия</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Иванов"
                  autoComplete="off"
                />
              </div>

              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="studentEmail">Email</Label>
                <Input
                  id="studentEmail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@example.com"
                  autoComplete="off"
                />
              </div>

              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="studentPassword">Временный пароль</Label>
                <Input
                  id="studentPassword"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="минимум 8 символов"
                  autoComplete="new-password"
                />
              </div>

              <Button
                type="submit"
                className="sm:col-span-2"
                disabled={!canCreate}
                loading={isCreating}
              >
                {isCreating ? "Создаю..." : "Создать ученика"}
              </Button>

              {createError ? (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive-foreground sm:col-span-2"
                >
                  {createError}
                </p>
              ) : null}

              <p className="text-xs leading-relaxed text-muted-foreground sm:col-span-2">
                Пароль сообщи ученику. Потом можно добавить смену пароля.
              </p>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>Список</CardTitle>
            <Button variant="outline" size="sm" onClick={refresh} loading={refreshing}>
              <RefreshCw className={refreshing ? "hidden" : undefined} />
              Обновить
            </Button>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <StudentsTableSkeleton />
            ) : students.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Пока пусто</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ученик</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((st) => {
                    const full = st.fullName?.trim() ?? "";
                    const label = full || st.email;

                    return (
                      <TableRow key={st.id}>
                        <TableCell>
                          <Link
                            href={`/admin/assignments?studentId=${st.id}`}
                            className="flex min-w-0 items-center gap-2"
                          >
                            <Badge variant="outline" className="shrink-0">
                              #{st.id}
                            </Badge>
                            <span className="truncate font-semibold">
                              {full || "Без имени"}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {st.email}
                            </span>
                          </Link>
                        </TableCell>

                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <ResetPasswordDialog studentId={st.id} label={label} />
                            <DeleteStudentDialog
                              studentId={st.id}
                              label={label}
                              onDeleted={load}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function StudentsTableSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-md px-3 py-2">
          <div className="h-5 w-10 rounded-full bg-white/[0.06]" />
          <div className="h-4 w-32 rounded-md bg-white/[0.06]" />
          <div className="h-4 w-40 rounded-md bg-white/[0.06]" />
          <div className="ml-auto h-8 w-24 rounded-md bg-white/[0.06]" />
        </div>
      ))}
    </div>
  );
}

function DeleteStudentDialog({
  studentId,
  label,
  onDeleted,
}: {
  studentId: string;
  label: string;
  onDeleted: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onConfirm(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const r = await fetch(`/api/admin/students/${studentId}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));

      if (!r.ok || !j.ok) {
        setError("Не удалось удалить. Возможно, у ученика есть связанные данные (доступы/задания).");
        return;
      }

      setOpen(false);
      await onDeleted();
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(null);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 />
          Удалить
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить ученика?</AlertDialogTitle>
          <AlertDialogDescription>
            {label}. Это действие необратимо.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error ? (
          <p role="alert" className="text-sm font-semibold text-destructive-foreground">
            {error}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "Удаляю..." : "Удалить"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ResetPasswordDialog({ studentId, label }: { studentId: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(false);
  }

  function onConfirm(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("Пароль минимум 8 символов");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    startTransition(async () => {
      const r = await fetch(`/api/admin/students/${studentId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword, confirmPassword }),
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok || !j.ok) {
        const msg =
          j?.error === "password_too_short"
            ? "Пароль минимум 8 символов"
            : j?.error === "password_mismatch"
            ? "Пароли не совпадают"
            : j?.error === "not_found"
            ? "Ученик не найден"
            : "Ошибка смены пароля";
        setError(msg);
        return;
      }

      setSuccess(true);
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <KeyRound />
          Задать пароль
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Новый пароль</AlertDialogTitle>
          <AlertDialogDescription>
            Для: {label}. Минимум 8 символов. Все активные сессии ученика будут сброшены.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {success ? (
          <p className="text-sm font-semibold text-foreground">
            Пароль обновлён. Все активные сессии ученика сброшены.
          </p>
        ) : (
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor={`newPassword-${studentId}`}>Новый пароль</Label>
              <Input
                id={`newPassword-${studentId}`}
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor={`confirmPassword-${studentId}`}>Повторите пароль</Label>
              <Input
                id={`confirmPassword-${studentId}`}
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            {error ? (
              <p role="alert" className="text-sm font-semibold text-destructive-foreground">
                {error}
              </p>
            ) : null}
          </div>
        )}

        <AlertDialogFooter>
          {success ? (
            <AlertDialogAction onClick={() => setOpen(false)}>Готово</AlertDialogAction>
          ) : (
            <>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction onClick={onConfirm} disabled={isPending}>
                {isPending ? "Сохраняю..." : "Сохранить"}
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
