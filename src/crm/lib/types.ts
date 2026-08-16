import type { Role } from "@prisma/client";

export type { Role };
// Kept as an alias for existing call sites; the single source of truth is
// the Prisma-generated `Role` enum, not a hand-maintained union.
export type UserRole = Role;

export type AttendanceStatus =
  | "PRESENT"
  | "ABSENT"
  | "EXCUSED"
  | "CANCELLED_BY_CENTER";

export interface Transaction {
  id: string;
  studentId: string;
  amount: number;
  type: string;
  classSessionId?: string | null;
  createdAt: string;
}

export interface Student {
  id: string;
  fullName: string;
  phone: string | null;
  deletedAt?: string | null;
  transactions?: Transaction[];
}

export interface User {
  id: string;
  fullName?: string | null;
  role?: UserRole;
}

export interface Group {
  id: string;
  name: string;
  teacherId: string | null;
  pricePerLesson?: number;
}

export interface GroupWithStudents extends Group {
  students: Student[];
}

export interface GroupWithDetails extends Group {
  teacher?: {
    fullName?: string | null;
  } | null;
  students?: {
    id: string;
    fullName: string;
    phone?: string | null;
    balance?: number;
  }[];
}

export interface ClassSession {
  id: string;
  groupId: string;
  teacherId: string;
  scheduledAt: string;
  status: string;
}

export interface ClassSessionWithGroup extends ClassSession {
  group: Group;
}

export interface AttendanceRecord {
  id: string;
  classSessionId: string;
  studentId: string;
  status: AttendanceStatus;
  priceAtTime: number;
  grade?: number | null;
  homeworkCompleted: boolean;
  comment?: string | null;
  makeup?: MakeupLesson | MakeupLesson[] | null;
}

export interface MakeupLesson {
  id: string;
  excusedAbsenceId: string;
  targetClassSessionId: string;
  targetClassSession?: {
    id: string;
    scheduledAt: string;
    group?: { name: string } | { name: string }[] | null;
  } | null;
}

export interface MakeupLessonOption {
  id: string;
  scheduledAt: string;
  group?: { id: string; name: string } | { id: string; name: string }[] | null;
}

export interface StudentExamGoal {
  id: string;
  studentId: string;
  subject: string;
  startScore: number;
  targetScore: number;
}

export interface StudentExamResult {
  id: string;
  studentId: string;
  subject: string;
  testName: string;
  currentScore: number;
  maxScore: number;
  testedAt: string;
}

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "Присутствовал",
  ABSENT: "Отсутствовал",
  EXCUSED: "Уважительная причина",
  CANCELLED_BY_CENTER: "Отменено центром",
};

export const ATTENDANCE_STATUS_CLASSES: Record<AttendanceStatus, string> = {
  PRESENT: "bg-emerald-100 text-emerald-800",
  ABSENT: "bg-amber-100 text-amber-800",
  EXCUSED: "bg-slate-100 text-slate-600",
  CANCELLED_BY_CENTER: "bg-rose-100 text-rose-700",
};

export type ActionResult = { error: string } | { error?: undefined };

export interface Profile {
  id: string;
  fullName: string | null;
  role: UserRole;
  balance: number;
}

export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "DIAGNOSTIC_SCHEDULED"
  | "DIAGNOSTIC_CONDUCTED"
  | "CONVERTED"
  | "LOST"
  | "CLOSED_LOST";

export interface Lead {
  id: string;
  name: string;
  parentName: string | null;
  phone: string;
  subject: string | null;
  notes: string | null;
  status: LeadStatus;
  closedLostReason: string | null;
  convertedUserId: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  clickId: string | null;
  referrer: string | null;
  landingPage: string | null;
  sessionId: string | null;
  readinessScore: number | null;
  ipHash: string | null;
  createdAt: string;
  updatedAt: string;
}

// CONVERTED is reached two ways: `advanceLeadStatus` bumps the Kanban column
// as soon as the diagnostic is done (no account exists yet), while
// `convertLeadToStudent` is what actually creates the User/Student and sets
// `convertedUserId`. The static label reflects the former ("ready", no LMS
// access yet), so UI code must check `lead.convertedUserId` to show
// "Зачислен" once the real account exists (see LeadsClient.tsx).
export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "Новая заявка",
  CONTACTED: "Связались",
  QUALIFIED: "Квалифицирован",
  DIAGNOSTIC_SCHEDULED: "Диагностика назначена",
  DIAGNOSTIC_CONDUCTED: "Диагностика проведена",
  CONVERTED: "Готов к зачислению",
  LOST: "Потерян",
  CLOSED_LOST: "Отказ",
};

export const LEAD_STATUS_CLASSES: Record<LeadStatus, string> = {
  NEW: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  CONTACTED: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  QUALIFIED: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  DIAGNOSTIC_SCHEDULED: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  DIAGNOSTIC_CONDUCTED: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  CONVERTED: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  LOST: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  CLOSED_LOST: "bg-rose-500/10 text-rose-600 border-rose-500/20",
};

export const LEAD_STATUS_ORDER: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "DIAGNOSTIC_SCHEDULED",
  "DIAGNOSTIC_CONDUCTED",
  "CONVERTED",
];

// Terminal/rejected statuses are excluded from the linear advance chain.
// A lead can be marked lost from any non-terminal column via `markLeadLost`.
export const LEAD_STATUS_TERMINAL: LeadStatus[] = ["LOST", "CLOSED_LOST"];
