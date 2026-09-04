"use server";

import { revalidatePath } from "next/cache";
import { randomBytes, randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/shared/lib/db";
import { getSessionUser, hashPassword } from "@/shared/lib/auth";
import { buildAbsoluteUrl } from "@/shared/lib/url";
import { russianPhoneSchema } from "@/shared/validation/phone";
import { emailSchema } from "@/shared/validation/email";
import type { ActionResult } from "@/crm/lib/types";

const INVITE_TTL_MS = 48 * 60 * 60 * 1000;

type InviteResult = ActionResult & { inviteLink?: string; inviteExpiresAt?: string };

async function requireStaff() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return { error: "Требуется авторизация" } as const;
  }

  if (!["ADMIN"].includes(sessionUser.role)) {
    return { error: "У вас нет прав для приглашения" } as const;
  }

  return { staffId: sessionUser.id } as const;
}

function buildInviteLink(token: string): Promise<string> {
  return buildAbsoluteUrl("crm", `/register?token=${token}`);
}

/**
 * Idempotently issues (or re-issues) a STUDENT invite for a student.
 *
 * Reissue-first, never-block semantics: rather than surfacing a "приглашение
 * уже создано" dead-end when a token already exists, we reuse the student's
 * own pending invite (rotating its token + expiry) or reclaim a stale invite
 * that happens to hold this email (Invite.email is globally unique). The only
 * hard stop is an email already bound to an *accepted* invite — that person
 * has registered and should log in, not be re-invited.
 *
 * Returns the pending invite's token + expiry, or an error string.
 */
async function issueStudentInvite(
  staffId: string,
  studentId: string,
  email: string,
): Promise<{ token: string; expiresAt: Date } | { error: string }> {
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const token = randomUUID();

  // 1. Prefer the student's own pending invite — pure reissue.
  const own = await db.invite.findFirst({
    where: { studentId, role: "STUDENT", acceptedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (own) {
    const updated = await db.invite.update({
      where: { id: own.id },
      data: { token, email, expiresAt },
      select: { token: true, expiresAt: true },
    });
    return updated;
  }

  // 2. No pending invite for this student yet — create one.
  try {
    return await db.invite.create({
      data: { email, role: "STUDENT", invitedBy: staffId, studentId, token, expiresAt },
      select: { token: true, expiresAt: true },
    });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
      throw err;
    }
    // 3. Email collision with an existing invite row. Reclaim it if it's still
    //    pending; otherwise it's been accepted (already registered).
    const byEmail = await db.invite.findUnique({
      where: { email },
      select: { id: true, acceptedAt: true },
    });
    if (byEmail && !byEmail.acceptedAt) {
      const updated = await db.invite.update({
        where: { id: byEmail.id },
        data: { token, role: "STUDENT", studentId, invitedBy: staffId, expiresAt },
        select: { token: true, expiresAt: true },
      });
      return updated;
    }
    return { error: "Этот email уже зарегистрирован — используйте вход в кабинет." };
  }
}

/**
 * Provisions (or re-provisions) LMS access for a student, given an email.
 * Persists the email onto the student record and issues an invite. Idempotent:
 * calling it again reissues a fresh link instead of erroring.
 */
export async function inviteStudentPortal(
  studentId: string,
  email: string,
): Promise<InviteResult> {
  const auth = await requireStaff();
  if ("error" in auth) return auth;
  const { staffId } = auth;

  const parsedEmail = emailSchema.safeParse(email);
  if (!parsedEmail.success) {
    return { error: parsedEmail.error.issues[0]?.message ?? "Некорректный email" };
  }

  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { id: true, userId: true },
  });

  if (!student) {
    return { error: "Ученик не найден" };
  }
  if (student.userId) {
    return { error: "У ученика уже есть аккаунт" };
  }

  // Keep the student record's email in sync with the address we're inviting.
  try {
    await db.student.update({ where: { id: studentId }, data: { email: parsedEmail.data } });
  } catch (err) {
    return {
      error: `Не удалось сохранить email: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const issued = await issueStudentInvite(staffId, studentId, parsedEmail.data);
  if ("error" in issued) return issued;

  revalidatePath(`/students/${studentId}`);
  return {
    inviteLink: await buildInviteLink(issued.token),
    inviteExpiresAt: issued.expiresAt.toISOString(),
  };
}

/**
 * Regenerates the student's invite link using the email already on file.
 * Used by the "обновить ссылку" action when a pending invite exists.
 */
export async function reissueStudentInvite(studentId: string): Promise<InviteResult> {
  const auth = await requireStaff();
  if ("error" in auth) return auth;
  const { staffId } = auth;

  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { id: true, userId: true, email: true },
  });

  if (!student) {
    return { error: "Ученик не найден" };
  }
  if (student.userId) {
    return { error: "У ученика уже есть аккаунт" };
  }

  // Fall back to the most recent pending invite's email if the student record
  // has none stored (older invites created before the email column existed).
  let email = student.email;
  if (!email) {
    const pending = await db.invite.findFirst({
      where: { studentId, role: "STUDENT", acceptedAt: null },
      orderBy: { createdAt: "desc" },
      select: { email: true },
    });
    email = pending?.email ?? null;
  }

  if (!email) {
    return { error: "Сначала укажите email ученика" };
  }

  const issued = await issueStudentInvite(staffId, studentId, email);
  if ("error" in issued) return issued;

  revalidatePath(`/students/${studentId}`);
  return {
    inviteLink: await buildInviteLink(issued.token),
    inviteExpiresAt: issued.expiresAt.toISOString(),
  };
}

/**
 * Resets a registered student's password to a freshly generated one and
 * invalidates their existing sessions. Returns the temporary password for the
 * operator to relay. Recovery path for the "already registered" state.
 */
export async function resetStudentPassword(
  studentId: string,
): Promise<ActionResult & { tempPassword?: string }> {
  const auth = await requireStaff();
  if ("error" in auth) return auth;

  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { userId: true },
  });
  if (!student?.userId) {
    return { error: "У ученика ещё нет аккаунта" };
  }

  // URL-safe, ~12-char temporary password (well above the 8-char minimum).
  const tempPassword = randomBytes(9).toString("base64url");
  const passwordHash = await hashPassword(tempPassword);

  try {
    await db.$transaction([
      db.user.update({ where: { id: student.userId }, data: { passwordHash } }),
      db.session.deleteMany({ where: { userId: student.userId } }),
    ]);
  } catch (err) {
    return {
      error: `Не удалось сбросить пароль: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  return { tempPassword };
}

export async function inviteParentPortal(
  studentId: string,
  parentName: string,
  parentPhone: string,
  email: string,
): Promise<InviteResult> {
  const auth = await requireStaff();
  if ("error" in auth) return auth;
  const { staffId } = auth;

  const name = parentName.trim();
  if (!name) {
    return { error: "Укажите имя родителя" };
  }

  const parsedPhone = russianPhoneSchema.safeParse(parentPhone);
  if (!parsedPhone.success) {
    return { error: parsedPhone.error.issues[0]?.message ?? "Некорректный телефон" };
  }
  const phone = parsedPhone.data;

  const parsedEmail = emailSchema.safeParse(email);
  if (!parsedEmail.success) {
    return { error: parsedEmail.error.issues[0]?.message ?? "Некорректный email" };
  }

  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { id: true },
  });
  if (!student) {
    return { error: "Ученик не найден" };
  }

  const parent = await db.$transaction(async (tx) => {
    const upserted = await tx.parent.upsert({
      where: { phone },
      update: {},
      create: { fullName: name, phone },
      select: { id: true, userId: true },
    });

    await tx.parentStudent.upsert({
      where: { parentId_studentId: { parentId: upserted.id, studentId } },
      update: {},
      create: { parentId: upserted.id, studentId },
    });

    return upserted;
  });

  revalidatePath(`/students/${studentId}`);

  if (parent.userId) {
    return { error: "У этого родителя уже есть аккаунт — ученик привязан к нему" };
  }

  const issued = await issueParentInvite(staffId, studentId, parent.id, parsedEmail.data);
  if ("error" in issued) return issued;

  return {
    inviteLink: await buildInviteLink(issued.token),
    inviteExpiresAt: issued.expiresAt.toISOString(),
  };
}

/**
 * Parent-side twin of issueStudentInvite: reissue-first, never-block. Keyed on
 * the parent so re-inviting the same parent reuses their pending invite.
 */
async function issueParentInvite(
  staffId: string,
  studentId: string,
  parentId: string,
  email: string,
): Promise<{ token: string; expiresAt: Date } | { error: string }> {
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const token = randomUUID();

  const own = await db.invite.findFirst({
    where: { parentId, role: "PARENT", acceptedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (own) {
    return db.invite.update({
      where: { id: own.id },
      data: { token, email, expiresAt, studentId },
      select: { token: true, expiresAt: true },
    });
  }

  try {
    return await db.invite.create({
      data: { email, role: "PARENT", invitedBy: staffId, studentId, parentId, token, expiresAt },
      select: { token: true, expiresAt: true },
    });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
      throw err;
    }
    const byEmail = await db.invite.findUnique({
      where: { email },
      select: { id: true, acceptedAt: true },
    });
    if (byEmail && !byEmail.acceptedAt) {
      return db.invite.update({
        where: { id: byEmail.id },
        data: { token, role: "PARENT", studentId, parentId, invitedBy: staffId, expiresAt },
        select: { token: true, expiresAt: true },
      });
    }
    return { error: "Этот email уже зарегистрирован — используйте вход в кабинет." };
  }
}
