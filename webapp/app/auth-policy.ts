export type UserRole = "user" | "admin" | "superadmin";

export const SUPERADMIN_EMAIL = "ai@qiu.edu.my";

export function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

export function isAllowedQiuEmail(email: string | null | undefined) {
  const normalized = normalizeEmail(email);
  return normalized.slice(normalized.lastIndexOf("@") + 1) === "qiu.edu.my";
}

export function roleForEmail(email: string | null | undefined, storedRole?: unknown): UserRole {
  if (normalizeEmail(email) === SUPERADMIN_EMAIL) return "superadmin";
  return storedRole === "admin" ? "admin" : "user";
}

export function canManageVacancies(role: UserRole | null) {
  return role === "admin" || role === "superadmin";
}
