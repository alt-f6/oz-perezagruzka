import { requireRolePage } from "@/lms/server/auth/require-role-page";
import AdminLessonEditClient from "./ui";

type Props = { params: Promise<{ id: string }> };

export default async function AdminLessonEditPage({ params }: Props) {
  await requireRolePage(["ADMIN", "MANAGER"]);

  const { id } = await params;
  const lessonId = id;

  if (!lessonId || typeof lessonId !== "string") {
    return (
      <div style={{ padding: 24 }}>
        <a href="/admin/lessons" style={{ textDecoration: "underline" }}>
          ← Назад к урокам
        </a>
        <div style={{ marginTop: 12, fontWeight: 900 }}>Некорректный ID урока</div>
      </div>
    );
  }

  return <AdminLessonEditClient lessonId={lessonId} />;
}
