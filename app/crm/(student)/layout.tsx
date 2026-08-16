import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSessionUser } from "@/shared/lib/auth";

export default async function StudentLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getSessionUser();

  if (!user) {
    redirect("/admin/login");
  }

  if (user.role !== "STUDENT") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-[var(--color-base)] p-4">
      <div className="mx-auto max-w-5xl space-y-4">{children}</div>
    </div>
  );
}
