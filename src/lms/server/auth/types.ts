import type { Role as PrismaRole } from "@/shared/lib/auth";

export type Role = PrismaRole;

export type AuthedUser = {
  id: string;
  email: string | null;
  role: Role;
};

export const ROLE_LABELS: Record<Role, string> = {
  STUDENT: "УЧЕНИК",
  TEACHER: "ПРЕПОДАВАТЕЛЬ",
  MANAGER: "КУРАТОР",
  ADMIN: "АДМИН",
  PARENT: "РОДИТЕЛЬ",
};

export function roleHome(role: Role): string {
  switch (role) {
    case "STUDENT":
      return "/student";
    case "PARENT":
      return "/parent/dashboard";
    case "ADMIN":
    case "MANAGER":
    case "TEACHER":
      return "/admin";
    default: {
      const _exhaustive: never = role;
      throw new Error(`Unhandled role: ${_exhaustive}`);
    }
  }
}
