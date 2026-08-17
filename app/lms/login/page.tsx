"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { roleHome, type Role } from "@/lms/server/auth/types";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await r.json();
      if (!r.ok || !data?.ok) {
        setError(data?.error || "Login failed");
        return;
      }

      const me: { ok: boolean; user?: { role: Role } } = await fetch("/api/auth/me").then((x) =>
        x.json(),
      );
      if (!me.ok || !me.user) {
        router.push("/");
        return;
      }
      router.push(roleHome(me.user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-start justify-center overflow-hidden px-6 py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 size-96 -translate-x-1/2 rounded-full bg-radial from-primary/25 to-transparent blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -right-16 size-96 rounded-full bg-radial from-primary-2/15 to-transparent blur-3xl"
      />

      <Card className="relative z-10 w-full max-w-md">
        <CardHeader>
          <Badge className="w-fit">Перезагрузка</Badge>
          <h1 className="text-3xl font-black tracking-tight">Вход</h1>
          <p className="text-sm text-muted-foreground">Введите почту и пароль</p>
        </CardHeader>

        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" size="lg" className="w-full" loading={loading}>
              {loading ? "Входим..." : "Войти"}
            </Button>

            {error ? (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive-foreground"
              >
                {error}
              </p>
            ) : null}

            <Link
              href="/"
              className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              На главную
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
