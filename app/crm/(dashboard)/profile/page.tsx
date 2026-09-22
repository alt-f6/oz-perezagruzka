import { getUserTimezone } from "@/shared/lib/auth";
import { requireRoleForPage } from "@/shared/lib/rbac";
import { ProfileClient } from "./ProfileClient";

export default async function ProfilePage() {
  const sessionUser = await requireRoleForPage(["ADMIN", "MANAGER", "TEACHER"], {
    loginPath: "/admin/login",
    forbiddenPath: () => "/access-denied",
  });
  const timezone = await getUserTimezone(sessionUser.id);

  return <ProfileClient initialTimezone={timezone} />;
}
