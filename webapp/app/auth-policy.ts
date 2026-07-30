export type UserRole = "user" | "admin" | "superadmin" | "employer";

export const SUPERADMIN_EMAIL = "ai@qiu.edu.my";
export const DEFAULT_YOUTUBE_PLACEHOLDER = "https://www.youtube.com/watch?v=5qap5aO4i9A";

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

export function getYouTubeEmbedUrl(url?: string): string {
  if (!url || !url.trim()) {
    return "https://www.youtube.com/embed/5qap5aO4i9A";
  }
  const clean = url.trim();
  let videoId = "";

  if (clean.includes("youtube.com/watch")) {
    const match = clean.match(/[?&]v=([^&]+)/);
    if (match) videoId = match[1];
  } else if (clean.includes("youtu.be/")) {
    const parts = clean.split("youtu.be/");
    if (parts[1]) videoId = parts[1].split("?")[0];
  } else if (clean.includes("youtube.com/embed/")) {
    const parts = clean.split("youtube.com/embed/");
    if (parts[1]) videoId = parts[1].split("?")[0];
  }

  return videoId ? `https://www.youtube.com/embed/${videoId}` : "https://www.youtube.com/embed/5qap5aO4i9A";
}
