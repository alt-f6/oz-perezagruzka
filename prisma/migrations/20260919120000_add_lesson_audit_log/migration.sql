-- CreateTable
CREATE TABLE "LessonAuditLog" (
    "id" TEXT NOT NULL,
    "classSessionId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonAuditLog_classSessionId_changedAt_idx" ON "LessonAuditLog"("classSessionId", "changedAt");

-- AddForeignKey
ALTER TABLE "LessonAuditLog" ADD CONSTRAINT "LessonAuditLog_classSessionId_fkey" FOREIGN KEY ("classSessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonAuditLog" ADD CONSTRAINT "LessonAuditLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
