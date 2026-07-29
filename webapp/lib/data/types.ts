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
  resumeId?: string;
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

/** A resume a student submits; employers/admins read these. */
export interface Resume {
  id: string;              // studentUid
  studentUid: string;
  studentEmail: string;
  studentName: string;
  course?: string;
  fileUrl?: string;        // Storage download URL (upload) or an external link
  fileName?: string;
  source: "upload" | "generated" | "link";
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
export interface EventItem {
  id: number;
  title: string;
  description: string;
  location: string;
  speakerName: string;
  speakerEmail: string;
  startAt: string;        // datetime-local value, e.g. "2026-08-01T14:00"
  endAt: string;
  sessionMinutes: number; // scheduled length, drives the CCA eligibility threshold
  createdBy?: string;
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
  company?: string;        // employer's company, assigned by an admin
}
