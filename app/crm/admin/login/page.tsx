"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { LogIn, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useToast } from "@/crm/components/ToastProvider";
import { loginSchema, type LoginValues } from "@/crm/lib/schemas";

export default function LoginPage() {
  const router = useRouter();
  const showToast = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginValues) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json();

    if (!res.ok || !data?.ok) {
      showToast(data?.error || "Не удалось войти", "error");
      return;
    }

    const home =
      data.role === "STUDENT"
        ? "/portal/dashboard"
        : data.role === "PARENT"
          ? "/parent/dashboard"
          : "/groups";
    router.push(home);
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-base p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md rounded-xl border-2 border-accent bg-white p-8 shadow-xl"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-white">
            <LogIn size={20} />
          </div>
          <h1 className="text-2xl font-bold text-accent">Вход в CRM</h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-accent">
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              disabled={isSubmitting}
              {...register("email")}
              className="w-full rounded-md border border-accent/40 px-3 py-2 text-accent focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:bg-base/50"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-cancel">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-accent">
              Пароль
            </label>
            <input
              type="password"
              autoComplete="current-password"
              disabled={isSubmitting}
              {...register("password")}
              className="w-full rounded-md border border-accent/40 px-3 py-2 text-accent focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:bg-base/50"
            />
            {errors.password && (
              <p className="mt-1 text-sm text-cancel">
                {errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-accent px-4 py-2.5 font-medium text-white transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-50"
          >
            {isSubmitting ? "Вход..." : "Войти"}
          </button>
        </form>

        <p className="mt-6 flex items-center justify-center gap-1 text-sm text-accent/70">
          <Mail size={14} />
          Нет аккаунта?{" "}
          <Link
            href="/register"
            className="font-medium text-accent underline transition-all duration-200 hover:opacity-90"
          >
            Зарегистрироваться
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
