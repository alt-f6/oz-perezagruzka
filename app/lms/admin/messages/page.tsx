import { requireRolePage } from "@/lms/server/auth/require-role-page";
import AdminMessagesClient from "./ui";

export default async function AdminMessagesPage() {
    await requireRolePage(["ADMIN", "MANAGER"]);

    return <AdminMessagesClient />;
}