import { NextRequest, NextResponse } from "next/server";
import { requireRole, rbacErrorResponse } from "@/shared/lib/rbac";
import { CRM_ROLES } from "@/shared/lib/auth";
import { parsePaginationParams } from "@/shared/lib/pagination";
import { listLessons } from "@/crm/lib/services/lesson-list.service";

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

  const { lessons, nextCursor } = await listLessons({ sessionUser, cursor, limit });

  return NextResponse.json({ ok: true, lessons, nextCursor });
}
