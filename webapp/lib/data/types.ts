// Canonical domain types for the QIU Industry Day 2026 portal.
// Every feature module and the Firestore access layer depend on these.
import type { UserRole } from "../../app/auth-policy";

export type { UserRole } from "../../app/auth-policy";

/** Employer listings are gated; admin/superadmin listings publish immediately. */
export type JobStatus = "approved" | "pending" | "pending_edit" | "rejected";

export interface Job {
  id: number;
  title: string;
  company: string;
  type: string;
  specialization: string;
  vacancies: number;
  location: string;
  locationMode?: "malaysia" | "international";
  state?: string;
  country?: string;
  mapX?: number;
  mapY?: number;
  salaryLabel: string;
  salary: number;
  payFrequency: string;
  minimumRequirement: string;
  detailsLink: string;
  email: string;
  companySummary: string;
  companySources: string[];
  jobScope?: string;      // employer-entered responsibilities/scope
  requirement?: string;   // employer-entered requirements
  youtubeUrl?: string;
  isCustom?: boolean;
  /** Approval workflow. Absent = legacy record, treated as approved. */
  status?: JobStatus;
  /** Employer edits to an approved job are staged here until an admin approves. */
  pendingEdit?: Partial<Job> | null;
  createdBy?: string;
}

/** A student's application to a vacancy (history + employer resume context). */
export interface Application {
  id: string;              // `${studentUid}_${jobId}`
  studentUid: string;
  studentEmail: string;
  studentName: string;
  jobId: number;
  jobTitle: string;
  company: string;
  studentEmployeeId?: string; // Workspace employee/student ID, stamped at apply
  resumeId?: string;
  resumeChoice?: "generated" | "link"; // which resume the student attached at apply
  appliedAt?: unknown;     // Firestore serverTimestamp
}

/** A "viewed job" event powering the student history tab. */
export interface ViewEvent {
  id: string;              // `${studentUid}_${jobId}`
  studentUid: string;
  jobId: number;
  jobTitle: string;
  company: string;
  viewedAt?: unknown;
}

/**
 * Structured CV fields a student fills in. The portal renders these into a
 * clean, printable CV (see GeneratedCV) — employers view it in-app and the
 * student can Print → Save as PDF. No file hosting required (free plan).
 */
export interface ResumeProfile {
  headline?: string;       // e.g. "Final-year Computer Science student"
  summary?: string;
  phone?: string;
  cgpa?: string;
  fypTitle?: string;
  fypSummary?: string;
  skills?: string;         // free text (comma / newline separated)
  education?: string;      // multiline
  experience?: string;     // multiline
  achievements?: string;   // multiline
  links?: string[];        // portfolio / GitHub / LinkedIn URLs
}

/** True when the profile carries enough to render a generated CV. */
export function hasGeneratedCV(profile?: ResumeProfile | null): boolean {
  if (!profile) return false;
  return Boolean(
    profile.summary || profile.cgpa || profile.fypTitle || profile.skills ||
    profile.education || profile.experience || profile.achievements ||
    (profile.links && profile.links.length),
  );
}

/** A resume a student submits; employers/admins read these. */
export interface Resume {
  id: string;              // studentUid
  studentUid: string;
  studentEmail: string;
  studentName: string;
  course?: string;
  employeeId?: string;     // Workspace employee/student ID, for hiring reference
  fileUrl?: string;        // external shareable link (no Storage on the free plan)
  fileName?: string;
  source: "upload" | "generated" | "link";
  profile?: ResumeProfile; // structured fields powering the generated CV
  updatedAt?: unknown;
}

/**
 * A persisted assistant chat turn.
 * Admins read all with identity; employers read only their own company,
 * anonymized (studentUid/email are omitted from the employer view).
 */
export interface ChatLog {
  id: string;
  studentUid: string;
  studentEmail: string;
  studentName: string;
  company: string | null;  // detected company the question is about, if any
  question: string;
  answer: string;
  createdAt?: unknown;
}

/** A live/upcoming Industry Day event. Only admins/superadmin manage these. */
export interface Speaker {
  name: string;
  photoUrl?: string;
  links?: string[];
}

export interface EventItem {
  id: number;
  title: string;
  description: string;
  location: string;
  speakerName: string;    // legacy/summary: names joined, kept for search + old events
  speakerLinks: string[]; // legacy: flattened links, kept for old events
  speakerPhotoUrl?: string; // legacy: first speaker's headshot, kept for old events
  speakers?: Speaker[];   // distinct speakers/hosts, each with their own photo & links
  startAt: string;        // datetime-local value, e.g. "2026-08-01T14:00"
  endAt: string;
  sessionMinutes: number; // scheduled length, drives the CCA eligibility threshold
  presenters: string[];   // extra emails allowed to present this event's QR only
  qrRotateSeconds?: number; // per-event QR rotation; falls back to the global default
  specialization?: string;    // legacy single field (kept for older events)
  specializations?: string[]; // target fields, e.g. ["AI & Machine Learning", "Data Analytics"]
  createdBy?: string;
}

/** An event's target fields as an array, tolerating the legacy single field. */
export function eventSpecializations(e: Pick<EventItem, "specialization" | "specializations">): string[] {
  if (e.specializations && e.specializations.length) return e.specializations;
  return e.specialization ? [e.specialization] : [];
}

/** An event's speakers as an array, tolerating the legacy flat speaker fields. */
export function eventSpeakers(e: Pick<EventItem, "speakers" | "speakerName" | "speakerPhotoUrl" | "speakerLinks">): Speaker[] {
  if (e.speakers && e.speakers.length) return e.speakers;
  if (e.speakerName || e.speakerPhotoUrl || (e.speakerLinks && e.speakerLinks.length)) {
    return [{ name: e.speakerName || "", photoUrl: e.speakerPhotoUrl, links: e.speakerLinks }];
  }
  return [];
}

/**
 * The live rotating attendance code for an event, written by the presenter every
 * ~25s. Stored in a separate collection students CANNOT read — the attendance
 * write is validated against it in security rules, so a shared screenshot is
 * useless once the code rotates.
 */
export interface EventCode {
  activeStep: "checkin" | "checkout" | "none";
  activeCode: string;
  codeExpiry: number;     // epoch ms
}

/** A student's attendance record for one event (doc id `${eventId}_${uid}`). */
export interface Attendance {
  id: string;
  eventId: number;
  eventTitle: string;
  studentUid: string;
  studentEmail: string;
  studentName: string;
  code: string;           // last validated rotating code (rules check it)
  step: "checkin" | "checkout";
  checkInMs?: number;     // client epoch, for duration math
  checkOutMs?: number;
  durationMinutes?: number;
  caEligible?: boolean;
  checkInAt?: unknown;
  checkOutAt?: unknown;
}

export interface UserRecord {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  course?: string;         // resolved course name (e.g. "Computer Science")
  courseCode?: string;     // raw directory code (e.g. "BCS")
  employeeId?: string;     // Google Workspace employee/student ID, if present
  company?: string;        // employer's company, assigned by an admin
}

/**
 * An exhibitor attending Industry Day, shown on the Home landing. Managed by
 * admins. Logo/video are external URLs (no Storage on the free plan).
 */
export interface Company {
  id: number;
  name: string;
  website?: string;
  logoUrl?: string;
  videoUrl?: string;       // YouTube corporate video URL
  summary?: string;
  boothNumber?: string;    // booth/stand number at the venue
  logoBackground?: "auto" | "light" | "dark"; // tile behind the logo; auto = detect
  /** Employer submissions are gated; admin listings publish immediately. Absent = approved. */
  status?: "approved" | "pending" | "pending_edit";
  /** An employer's edit to an already-approved profile, staged until an admin approves. */
  pendingEdit?: Partial<Company> | null;
  createdBy?: string;
}

/** Shown on Home while live: approved, legacy (no status), or an approved profile with a staged edit. */
export const isApprovedCompany = (c: Company) => !c.status || c.status === "approved" || c.status === "pending_edit";

/**
 * A self-service employer registration request (doc id = lowercased email).
 * A non-QIU visitor submits this; an admin approves it, which whitelists them as
 * an employer with the given company — no more entering emails one by one.
 */
export interface EmployerSignup {
  email: string;
  name: string;
  company: string;
  contact?: string;
  website?: string;
  logoUrl?: string;
  videoUrl?: string;
  summary?: string;
  status: "pending" | "approved";
  createdAt?: unknown;
  updatedAt?: unknown;
}

/**
 * Portal-wide settings an admin can edit from the Settings panel — no code
 * change needed. Stored as a single doc so non-IT staff can retheme copy,
 * tune the attendance rules, and toggle whole sections on/off.
 */
export interface AppSettings {
  portalTitle: string;
  portalTagline: string;
  qrRotateSeconds: number; // default QR rotation when an event doesn't override it
  ccaPercent: number;      // % of session length needed for CCA credit
  ccaFloorMinutes: number; // minimum minutes floor when a session has no length
  tabs: { home: boolean; events: boolean; vacancies: boolean; resume: boolean; history: boolean };
}
