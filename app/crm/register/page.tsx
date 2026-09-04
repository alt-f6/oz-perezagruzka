"use client";

import { use, useState, useEffect, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { createLogger } from "@/shared/lib/logger";

const logger = createLogger("crm.register");

interface InviteData {
  id: string;
  email: string;
  role: string;
  acceptedAt: string | null;
}

export default function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const router = useRouter();
  const params = use(searchParams);
  const token = params.token;

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Set when the invite has already been activated: instead of a dead-end
  // error, the user is offered a direct path to log in.
  const [loginPath, setLoginPath] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    async function checkToken() {
      if (!token) {
        setErrorMessage("Токен приглашения не найден");
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/auth/register?token=${encodeURIComponent(token)}`);
      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setErrorMessage(data?.error || "Недействительное или уже использованное приглашение");
        if (data?.alreadyAccepted && typeof data.loginPath === "string") {
          setLoginPath(data.loginPath);
        }
      } else {
        setInvite(data.invite);
      }
      setLoading(false);
    }

    void checkToken();
  }, [token]);

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!invite || !token) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, password }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setErrorMessage(data?.error || "Не удалось зарегистрировать пользователя");
        // If the invite was consumed between load and submit (double-submit,
        // reused link), offer the login hand-off rather than a dead end.
        if (data?.alreadyAccepted && typeof data.loginPath === "string") {
          setInvite(null);
          setLoginPath(data.loginPath);
        }
        return;
      }

      router.refresh();
      if (data.role === "STUDENT") {
        router.push("/portal/dashboard");
      } else if (data.role === "PARENT") {
        router.push("/parent/dashboard");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      logger.error("Ошибка при регистрации", err);
      setErrorMessage("Произошла ошибка при отправке формы. Проверьте соединение и попробуйте снова.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Проверка приглашения...</p>
      </div>
    );
  }

  if (errorMessage && !invite) {
    const isAlreadyAccepted = Boolean(loginPath);
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-md p-6 bg-white rounded-xl shadow-md text-center">
          <h2
            className={`text-xl font-bold mb-2 ${isAlreadyAccepted ? "text-slate-800" : "text-red-600"}`}
          >
            {isAlreadyAccepted ? "Аккаунт уже активирован" : "Ошибка доступа"}
          </h2>
          <p className="text-gray-600 mb-4">{errorMessage}</p>
          {loginPath && (
            <a
              href={loginPath}
              className="inline-block w-full py-2 px-4 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition"
            >
              Войти в личный кабинет
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md p-6 bg-white rounded-xl shadow-md">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">Регистрация</h1>
        <p className="text-sm text-slate-500 mb-6">
          Приглашение для роль:{" "}
          <span className="font-semibold">{invite?.role}</span>
        </p>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={invite?.email || ""}
              disabled
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Имя и фамилия
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Иван Иванов"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Пароль
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 px-4 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition disabled:opacity-50"
          >
            {submitting ? "Сохранение..." : "Завершить регистрацию"}
          </button>
        </form>
      </div>
    </div>
  );
}
