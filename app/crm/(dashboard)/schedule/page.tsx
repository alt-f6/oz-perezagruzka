import { requireRole } from "@/shared/lib/rbac";
import { ScheduleClient } from "./ScheduleClient";
import { loadScheduleData } from "./schedule-data";

export default async function SchedulePage() {
  const sessionUser = await requireRole(["ADMIN", "MANAGER", "TEACHER"]);

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
    />
  );
}
