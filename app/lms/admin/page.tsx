import Link from "next/link";

import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";

export default function AdminHomePage() {
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
