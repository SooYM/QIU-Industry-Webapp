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
  fileUrl?: string;        // Firebase Storage download URL (uploaded PDF)
  fileName?: string;
  source: "upload" | "generated";
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
