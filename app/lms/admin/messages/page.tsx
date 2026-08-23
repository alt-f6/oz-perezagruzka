import { requireRoleForPage } from "@/shared/lib/rbac";
import { roleHome } from "@/lms/server/auth/types";
import AdminMessagesClient from "./ui";

export default async function AdminMessagesPage() {
    await requireRoleForPage(["ADMIN", "MANAGER"], {
        adminBypass: true,
        loginPath: "/login",
        forbiddenPath: (user) => roleHome(user.role),
    });

    return <AdminMessagesClient />;
}