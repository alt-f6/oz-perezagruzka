import { NextResponse } from "next/server";
import { requireAuth } from "@/lms/server/auth/require-auth";
import { pool } from "@/lms/server/db/pool";
import { withApiErrors } from "@/lms/server/http/api-guard";

export const GET = withApiErrors(async (req: Request) => {
  const user = await requireAuth();

  const { searchParams } = new URL(req.url);
  const lessonId = Number(searchParams.get("lessonId"));

  if (!Number.isInteger(lessonId) || lessonId <= 0) {
    return NextResponse.json({ ok: false, error: "lessonId_invalid" }, { status: 400 });
  }

  if (user.role === "STUDENT") {
    const ar = await pool.query(
      `SELECT 1 FROM assignments WHERE student_id = $1 AND lesson_id = $2 LIMIT 1`,
      [user.id, lessonId]
    );
    if (ar.rowCount === 0) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
  }

  const r = await pool.query(
    `SELECT id, title, "order"
     FROM lesson_assets
     WHERE lesson_id = $1
       AND kind = 'pdf'
       AND is_public = true
     ORDER BY "order" ASC, id ASC`,
    [lessonId]
  );

  return NextResponse.json({
    ok: true,
    assets: r.rows,
  });
});
