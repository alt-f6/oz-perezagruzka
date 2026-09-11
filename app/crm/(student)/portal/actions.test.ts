import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  student: { findFirst: vi.fn() },
  classSession: { findUnique: vi.fn() },
  groupStudent: { findUnique: vi.fn() },
  submission: { findUnique: vi.fn(), upsert: vi.fn() },
}));

const rbacMock = vi.hoisted(() => ({
  requireRole: vi.fn(),
}));

const r2Mock = vi.hoisted(() => ({
  signPutObject: vi.fn(),
}));

vi.mock("@/shared/lib/db", () => ({ db: dbMock }));
vi.mock("@/shared/lib/rbac", () => rbacMock);
vi.mock("@/lms/server/r2/signed", () => r2Mock);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { getSubmissionUploadUrl, submitHomework } = await import("./actions");

const STUDENT_USER = { id: "user_1", email: "s@a.com", role: "STUDENT" };

beforeEach(() => {
  vi.clearAllMocks();
  rbacMock.requireRole.mockResolvedValue(STUDENT_USER);
  dbMock.student.findFirst.mockResolvedValue({ id: "student_1" });
});

describe("getSubmissionUploadUrl", () => {
  it("mints an upload URL scoped to the lesson and student for an individual lesson", async () => {
    dbMock.classSession.findUnique.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      studentId: "student_1",
      groupId: null,
    });
    r2Mock.signPutObject.mockResolvedValue("https://r2.example.com/put");

    const result = await getSubmissionUploadUrl("11111111-1111-4111-8111-111111111111", {
      name: "answer.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
    });

    expect(result.error).toBeUndefined();
    expect("fileKey" in result && result.fileKey.startsWith("homework-submissions/11111111-1111-4111-8111-111111111111/student_1/")).toBe(
      true,
    );
    expect(r2Mock.signPutObject).toHaveBeenCalledWith(
      expect.stringContaining("homework-submissions/11111111-1111-4111-8111-111111111111/student_1/"),
      "application/pdf",
    );
  });

  it("mints an upload URL for a GROUP lesson when the student is on the roster", async () => {
    dbMock.classSession.findUnique.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      studentId: null,
      groupId: "group_1",
    });
    dbMock.groupStudent.findUnique.mockResolvedValue({ studentId: "student_1" });
    r2Mock.signPutObject.mockResolvedValue("https://r2.example.com/put");

    const result = await getSubmissionUploadUrl("11111111-1111-4111-8111-111111111111", {
      name: "answer.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
    });

    expect(dbMock.groupStudent.findUnique).toHaveBeenCalledWith({
      where: { groupId_studentId: { groupId: "group_1", studentId: "student_1" } },
      select: { studentId: true },
    });
    expect(result.error).toBeUndefined();
  });

  it("rejects a lesson the student has no relationship to", async () => {
    dbMock.classSession.findUnique.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      studentId: "someone_else",
      groupId: "group_1",
    });
    dbMock.groupStudent.findUnique.mockResolvedValue(null);

    const result = await getSubmissionUploadUrl("11111111-1111-4111-8111-111111111111", {
      name: "answer.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
    });

    expect(result.error).toBeTruthy();
    expect(r2Mock.signPutObject).not.toHaveBeenCalled();
  });

  it("rejects a file over the size limit before signing", async () => {
    dbMock.classSession.findUnique.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      studentId: "student_1",
      groupId: null,
    });

    const result = await getSubmissionUploadUrl("11111111-1111-4111-8111-111111111111", {
      name: "big.mp4",
      mimeType: "video/mp4",
      sizeBytes: 26 * 1024 * 1024,
    });

    expect(result.error).toBeTruthy();
    expect(r2Mock.signPutObject).not.toHaveBeenCalled();
  });

  it("returns a handled error when the caller has no Student profile", async () => {
    dbMock.student.findFirst.mockResolvedValue(null);

    const result = await getSubmissionUploadUrl("11111111-1111-4111-8111-111111111111", {
      name: "answer.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
    });

    expect(result.error).toBeTruthy();
    expect(dbMock.classSession.findUnique).not.toHaveBeenCalled();
  });
});

describe("submitHomework", () => {
  beforeEach(() => {
    dbMock.classSession.findUnique.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      studentId: "student_1",
      groupId: null,
    });
    dbMock.submission.findUnique.mockResolvedValue(null);
    dbMock.submission.upsert.mockResolvedValue({ id: "sub_1" });
  });

  it("upserts a new submission with SUBMITTED status", async () => {
    const result = await submitHomework({ lessonId: "11111111-1111-4111-8111-111111111111", content: "Мой ответ" });

    expect(result.error).toBeUndefined();
    expect(dbMock.submission.upsert).toHaveBeenCalledWith({
      where: { lessonId_studentId: { lessonId: "11111111-1111-4111-8111-111111111111", studentId: "student_1" } },
      update: { content: "Мой ответ", fileKey: null, status: "SUBMITTED" },
      create: {
        lessonId: "11111111-1111-4111-8111-111111111111",
        studentId: "student_1",
        content: "Мой ответ",
        fileKey: null,
        status: "SUBMITTED",
      },
    });
  });

  it("rejects a submission with neither content nor fileKey", async () => {
    const result = await submitHomework({ lessonId: "11111111-1111-4111-8111-111111111111" });

    expect(result.error).toBeTruthy();
    expect(dbMock.submission.upsert).not.toHaveBeenCalled();
  });

  it("allows resubmission while the existing submission is still SUBMITTED", async () => {
    dbMock.submission.findUnique.mockResolvedValue({ status: "SUBMITTED" });

    const result = await submitHomework({ lessonId: "11111111-1111-4111-8111-111111111111", content: "Исправленный ответ" });

    expect(result.error).toBeUndefined();
    expect(dbMock.submission.upsert).toHaveBeenCalled();
  });

  it("allows resubmission while the existing submission is NEEDS_REVISION", async () => {
    dbMock.submission.findUnique.mockResolvedValue({ status: "NEEDS_REVISION" });

    const result = await submitHomework({ lessonId: "11111111-1111-4111-8111-111111111111", content: "Исправленный ответ" });

    expect(result.error).toBeUndefined();
    expect(dbMock.submission.upsert).toHaveBeenCalled();
  });

  it("blocks resubmission once the work has been GRADED", async () => {
    dbMock.submission.findUnique.mockResolvedValue({ status: "GRADED" });

    const result = await submitHomework({ lessonId: "11111111-1111-4111-8111-111111111111", content: "Ещё попытка" });

    expect(result.error).toBeTruthy();
    expect(dbMock.submission.upsert).not.toHaveBeenCalled();
  });

  it("blocks resubmission once the work has been REJECTED", async () => {
    dbMock.submission.findUnique.mockResolvedValue({ status: "REJECTED" });

    const result = await submitHomework({ lessonId: "11111111-1111-4111-8111-111111111111", content: "Ещё попытка" });

    expect(result.error).toBeTruthy();
    expect(dbMock.submission.upsert).not.toHaveBeenCalled();
  });

  it("rejects a lesson the student has no relationship to", async () => {
    dbMock.classSession.findUnique.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      studentId: "someone_else",
      groupId: null,
    });

    const result = await submitHomework({ lessonId: "11111111-1111-4111-8111-111111111111", content: "Мой ответ" });

    expect(result.error).toBeTruthy();
    expect(dbMock.submission.upsert).not.toHaveBeenCalled();
  });

  it("rejects a fileKey that wasn't minted for this lesson/student (IDOR guard)", async () => {
    const result = await submitHomework({
      lessonId: "11111111-1111-4111-8111-111111111111",
      fileKey: "homework-submissions/other_lesson/other_student/x-file.pdf",
    });

    expect(result.error).toBeTruthy();
    expect(dbMock.submission.upsert).not.toHaveBeenCalled();
  });

  it("accepts a fileKey correctly scoped to this lesson/student", async () => {
    const result = await submitHomework({
      lessonId: "11111111-1111-4111-8111-111111111111",
      fileKey: "homework-submissions/11111111-1111-4111-8111-111111111111/student_1/abc-file.pdf",
    });

    expect(result.error).toBeUndefined();
    expect(dbMock.submission.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          fileKey: "homework-submissions/11111111-1111-4111-8111-111111111111/student_1/abc-file.pdf",
        }),
      }),
    );
  });

  it("returns a handled error when the caller has no Student profile", async () => {
    dbMock.student.findFirst.mockResolvedValue(null);

    const result = await submitHomework({ lessonId: "11111111-1111-4111-8111-111111111111", content: "Мой ответ" });

    expect(result.error).toBeTruthy();
    expect(dbMock.classSession.findUnique).not.toHaveBeenCalled();
  });
});
