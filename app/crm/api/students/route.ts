import { NextRequest, NextResponse } from "next/server";
import { requireRole, rbacErrorResponse } from "@/shared/lib/rbac";
import { CRM_ROLES } from "@/shared/lib/auth";
import { parsePaginationParams } from "@/shared/lib/pagination";
import { listStudents } from "@/crm/lib/services/student-list.service";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  let sessionUser;
  try {
    sessionUser = await requireRole(CRM_ROLES);
  } catch (err) {
    return rbacErrorResponse(err);
  }

  const url = new URL(req.url);
  const { cursor, limit } = parsePaginationParams(url.searchParams);
  const search = url.searchParams.get("search") ?? undefined;

  const { students, nextCursor } = await listStudents({ sessionUser, search, cursor, limit });

  return NextResponse.json({ ok: true, students, nextCursor });
}
