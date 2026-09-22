import { cookies } from "next/headers";
import { getUserTimezone } from "@/shared/lib/auth";
import { requireRoleForPage } from "@/shared/lib/rbac";
import { CRM_DISPLAY_TZ_COOKIE, isCrmTimezone } from "@/shared/lib/timezone";
import { ScheduleClient } from "./ScheduleClient";
import { loadScheduleData } from "./schedule-data";

export default async function SchedulePage() {
  const sessionUser = await requireRoleForPage(["ADMIN", "MANAGER", "TEACHER"], {
    loginPath: "/admin/login",
    forbiddenPath: () => "/access-denied",
  });

  const userTimezone = await getUserTimezone(sessionUser.id);
  const cookieTz = (await cookies()).get(CRM_DISPLAY_TZ_COOKIE)?.value;
  const displayTimezone = cookieTz && isCrmTimezone(cookieTz) ? cookieTz : userTimezone;

  // Data-layer failures resolve to a local error state here (never a throw),
  // so a calendar loading problem renders inline and can never be mistaken for
  // an auth failure or kick the authenticated user to login.
  const result = await loadScheduleData(sessionUser);

  if (!result.ok) {
    return (
      <ScheduleClient
        lessons={[]}
        groups={[]}
        teachers={[]}
        students={[]}
        userRole={sessionUser.role}
        userTimezone={userTimezone}
        displayTimezone={displayTimezone}
        loadError={result.error}
      />
    );
  }

  return (
    <ScheduleClient
      lessons={result.data.lessons}
      groups={result.data.groups}
      teachers={result.data.teachers}
      students={result.data.students}
      userRole={sessionUser.role}
      userTimezone={userTimezone}
      displayTimezone={displayTimezone}
    />
  );
}
