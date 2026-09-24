"use client";

import { useRouter } from "next/navigation";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";

/** Narrow-screen course switcher for /admin/access (desktop uses the side list). */
export function CoursePicker({ courses, value }: { courses: { id: string; title: string }[]; value: string }) {
  const router = useRouter();
  return (
    <Select value={value} onValueChange={(id) => router.push(`/admin/access?course=${id}`)}>
      <SelectTrigger aria-label="Курс">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {courses.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
