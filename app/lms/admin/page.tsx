import Link from "next/link";

import { requireRolePage } from "@/lms/server/auth/require-role-page";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";

export default async function AdminHomePage() {
  const user = await requireRolePage(["ADMIN", "MANAGER", "TEACHER"]);

  if (user.role === "TEACHER") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>LMS Портал</CardTitle>
            <CardDescription>Кабинет преподавателя</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Управление группами, расписанием и учениками ведется в CRM.
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Admin</CardTitle>
          <CardDescription>Админская главная</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/admin/lessons">Перейти к урокам</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
