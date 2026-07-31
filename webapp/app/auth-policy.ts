export type UserRole = "user" | "admin" | "superadmin" | "employer";

export const SUPERADMIN_EMAIL = "ai@qiu.edu.my";

export function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

export function isAllowedQiuEmail(email: string | null | undefined) {
  const normalized = normalizeEmail(email);
  return normalized.slice(normalized.lastIndexOf("@") + 1) === "qiu.edu.my";
}

export function isAllowedAccessEmail(email: string | null | undefined, whitelistedEmails: string[] = []) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  if (isAllowedQiuEmail(normalized)) return true;
  return whitelistedEmails.map(normalizeEmail).includes(normalized);
}

export function roleForEmail(email: string | null | undefined, storedRole?: unknown): UserRole {
  if (normalizeEmail(email) === SUPERADMIN_EMAIL) return "superadmin";
  if (storedRole === "admin") return "admin";
  if (storedRole === "employer") return "employer";
  return "user";
}

export function canManageVacancies(role: UserRole | null) {
  return role === "admin" || role === "superadmin" || role === "employer";
}

export function canEditOrDeleteJob(job: { createdBy?: string }, currentUserEmail: string | null | undefined, role: UserRole | null) {
  if (role === "superadmin" || role === "admin") return true;
  if (role === "employer") {
    const userEmail = normalizeEmail(currentUserEmail);
    const creator = normalizeEmail(job.createdBy);
    return !creator || creator === userEmail;
  }
  return false;
}

/** Best-effort brand logo from a website URL (Clearbit). Empty when unparseable. */
export function logoFromWebsite(url?: string): string {
  if (!url || !url.trim()) return "";
  try {
    const host = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "");
    return host ? `https://logo.clearbit.com/${host}` : "";
  } catch { return ""; }
}

/**
 * Extract a YouTube embed URL from any common link form — watch?v=, youtu.be/,
 * /live/ (past live streams & premieres), /embed/, /shorts/, or a bare 11-char
 * ID. Returns "" when no valid ID is present so callers can hide the player
 * instead of falling back to an unrelated video.
 */
export function getYouTubeEmbedUrl(url?: string): string {
  if (!url || !url.trim()) return "";
  const clean = url.trim();
  const id =
    clean.match(/[?&]v=([A-Za-z0-9_-]{11})/)?.[1] ||
    clean.match(/(?:youtu\.be\/|youtube\.com\/(?:live|embed|shorts|v)\/)([A-Za-z0-9_-]{11})/)?.[1] ||
    (/^[A-Za-z0-9_-]{11}$/.test(clean) ? clean : "");
  return id ? `https://www.youtube.com/embed/${id}` : "";
}
