"use client";

import { useRouter } from "next/navigation";
import type { ChildOption } from "./page";

export function ChildSwitcher({
  childStudents,
  activeChildId,
}: {
  childStudents: ChildOption[];
  activeChildId: string;
}) {
  const router = useRouter();

  if (childStudents.length < 2) return null;

  return (
    <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-white p-2 shadow-sm">
      {childStudents.map((child) => (
        <button
          key={child.id}
          type="button"
          onClick={() => router.push(`/parent/dashboard?studentId=${child.id}`)}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
            child.id === activeChildId
              ? "bg-accent text-white"
              : "text-accent/70 hover:bg-base"
          }`}
        >
          {child.fullName}
        </button>
      ))}
    </div>
  );
}
