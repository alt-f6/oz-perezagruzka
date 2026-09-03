import { redirect } from "next/navigation";
import { getSessionUser } from "@/shared/lib/auth";
import { roleHome } from "@/lms/server/auth/types";

/**
 * LMS subdomain root (`lms.perezagruzka-edu.ru/`).
 *
 * Previously there was no page here, so an authenticated LMS user hitting the
 * bare root fell through to `app/lms/not-found.tsx` and saw a raw 404 (SEC-02).
 * Now the root inspects the session and routes deterministically: no session →
 * `/login`, otherwise the user's role dashboard. The edge proxy already blocks
 * disallowed roles/anonymous users from LMS paths, so `getSessionUser` here is
 * a defensive fallback rather than the primary gate.
 */
export default async function LmsRootPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  redirect(roleHome(user.role));
}
