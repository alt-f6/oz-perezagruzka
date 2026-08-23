import { requireRoleForPage } from "@/shared/lib/rbac";
import AdminMessagesClient from "./ui";

export default async function AdminMessagesPage() {
    await requireRoleForPage(["ADMIN", "MANAGER"], { adminBypass: true, loginPath: "/login" });

    return <AdminMessagesClient />;
}