export const ADMIN_SCOPES = [
  "content:read",
  "content:write",
  "publish",
  "files:write",
  "students:read",
  "access:write",
] as const;

export type AdminScope = (typeof ADMIN_SCOPES)[number];

export function isAdminScope(value: string): value is AdminScope {
  return (ADMIN_SCOPES as readonly string[]).includes(value);
}
