import type { AttendanceStatus } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "@/crm/lib/prisma";
import { getNotificationProvider } from "@/crm/lib/services/notification.service";
import { createLogger } from "@/shared/lib/logger";

const log = createLogger("billing");

export class BillingService {
  static async markAttendanceAndCharge(
    classSessionId: string,
    studentId: string,
    status: AttendanceStatus,
  ) {
    const result = await prisma.$transaction(
      async (tx) => {
        // Student.id is a text column (Prisma String id), so no uuid cast here.
        await tx.$queryRaw`SELECT * FROM "Student" WHERE "id" = ${studentId} FOR UPDATE`;

        const classSession = await tx.classSession.findUniqueOrThrow({
          where: { id: classSessionId },
          include: { group: true },
        });

        const currentPrice = classSession.group.pricePerLesson;

        const isBillableStatus = status === "PRESENT" || status === "ABSENT";

        // Freeze bounds are DATE columns (UTC midnight), so truncate the
        // session start to its UTC calendar day. That way a freeze covering
        // that day, including its last day, suppresses the charge.
        const sessionDay = new Date(
          Date.UTC(
            classSession.scheduledAt.getUTCFullYear(),
            classSession.scheduledAt.getUTCMonth(),
            classSession.scheduledAt.getUTCDate(),
          ),
        );
        const activeFreeze = isBillableStatus
          ? await tx.freeze.findFirst({
              where: {
                studentId,
                startDate: { lte: sessionDay },
                endDate: { gte: sessionDay },
              },
              select: { id: true },
            })
          : null;

        const shouldCharge = isBillableStatus && !activeFreeze;
        const transactionAmount = shouldCharge ? -Number(currentPrice) : 0;

        const attendance = await tx.attendance.upsert({
          where: {
            classSessionId_studentId: { classSessionId, studentId },
          },
          update: {
            status,
            priceAtTime: currentPrice,
          },
          create: {
            classSessionId,
            studentId,
            status,
            priceAtTime: currentPrice,
          },
        });

        await tx.transaction.deleteMany({
          where: {
            studentId,
            classSessionId,
            type: "LESSON_CHARGE",
          },
        });

        if (shouldCharge) {
          await tx.transaction.create({
            data: {
              studentId,
              classSessionId,
              amount: transactionAmount,
              type: "LESSON_CHARGE",
              // Deterministic per (session, student, type): a retried charge for
              // the same lesson/student naturally collides on this key instead
              // of relying solely on the separate composite unique constraint.
              idempotencyKey: `lesson_charge:${classSessionId}:${studentId}`,
            },
          });
        }

        return attendance;
      },
      {
        isolationLevel: "Serializable",
        maxWait: 5000,
        timeout: 10000,
      },
    );

    if (status === "PRESENT" || status === "ABSENT") {
      try {
        await BillingService.notifyIfBalanceNegative(studentId);
      } catch (err) {
        log.error("Не удалось отправить уведомление о задолженности", err, {
          studentId,
          classSessionId,
        });
      }
    }

    return result;
  }

  private static async notifyIfBalanceNegative(studentId: string) {
    const balance = await prisma.transaction.aggregate({
      where: { studentId },
      _sum: { amount: true },
    });
    const totalBalance = Number(balance._sum.amount ?? 0);
    if (totalBalance >= 0) return;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { parents: { include: { parent: { include: { user: true } } } } },
    });
    if (!student) return;

    const provider = getNotificationProvider();
    await Promise.all(
      student.parents.map(({ parent }) =>
        provider.sendDebtReminder(
          { telegramChatId: parent.telegramChatId, email: parent.user?.email, fullName: student.fullName },
          totalBalance,
        ),
      ),
    );
  }
}
