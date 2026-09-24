import { requireRoleForPage } from "@/shared/lib/rbac";
import { roleHome } from "@/lms/server/auth/types";
import { getLessonsDirectory, isCatalogEditor } from "@/lms/server/admin/catalog";
import { parseLessonFilters } from "@/lms/lib/lesson-filters";
import { pluralRu } from "@/lms/lib/admin-format";
import { PageHeader } from "@/lms/components/admin/primitives";

import CreateLessonButton from "./CreateLessonButton";
import { LessonsToolbar } from "./LessonsToolbar";
import { LessonsDirectory } from "./LessonsDirectory";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminLessonsPage({ searchParams }: Props) {
  // TEACHER gets a read-only view scoped to courses they own.
  const user = await requireRoleForPage(["ADMIN", "MANAGER", "TEACHER"], {
    adminBypass: true,
    loginPath: "/login",
    forbiddenPath: (user) => roleHome(user.role),
  });

  const editor = isCatalogEditor(user);
  const filters = parseLessonFilters(await searchParams);
  const directory = await getLessonsDirectory(user, filters);
  const { totals } = directory;

  return (
    <div>
      <PageHeader
        eyebrow={editor ? "Учебный контент" : "Мои курсы"}
        title="Уроки"
        description={
          <span className="tabular-nums">
            {totals.lessons} {pluralRu(totals.lessons, ["урок", "урока", "уроков"])} · {totals.published} опубликовано ·{" "}
            {totals.lessons - totals.published} {pluralRu(totals.lessons - totals.published, ["черновик", "черновика", "черновиков"])}
          </span>
        }
        actions={editor ? <CreateLessonButton /> : null}
      />

      <LessonsToolbar filters={filters} courseOptions={directory.courseOptions} matched={totals.matched} />

      <LessonsDirectory
        // Remount on filter change so collapse/selection state resets cleanly.
        key={JSON.stringify(filters)}
        courses={directory.courses}
        moduleOptions={directory.moduleOptions}
        editable={editor}
        canAssign={user.role === "ADMIN"}
        filtered={Boolean(filters.q || filters.status || filters.exam || filters.subject || filters.course)}
      />
    </div>
  );
}
