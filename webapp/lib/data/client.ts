// Firestore connection plumbing shared by every data module in this folder.
// Nothing here is domain logic — see the sibling modules for that.
import type { Firestore } from "firebase/firestore";
import { db } from "../../app/firebase-client";
import type { AppSettings, Job } from "./types";

export const COLLECTIONS = {
  users: "users",
  vacancies: "vacancies",
  whitelist: "whitelisted_emails",
  applications: "applications",
  viewEvents: "view_events",
  resumes: "resumes",
  chatLogs: "chat_logs",
  events: "events",
  eventCodes: "event_codes",
  attendance: "attendance",
  jobStats: "job_stats",
  companies: "companies",
  settings: "app_settings",
  signups: "employer_signups",
  mail: "mail",
  eventInterests: "event_interests",
  eventLiveChat: "event_live_chat",
  interviewSlots: "interview_slots",
  interviewBookings: "interview_bookings",
  talkLiveChats: "talk_live_chats",
  eventFeedbacks: "event_feedbacks",
  companyViews: "company_views",
} as const;

/** Fallback settings before the settings doc loads (or if an admin hasn't saved any). */
export const DEFAULT_SETTINGS: AppSettings = {
  portalTitle: "Industry Day 2026",
  portalTagline: "QIU Industry Day 2026. Verify vacancy details directly with the company.",
  qrRotateSeconds: 30,
  ccaPercent: 80,
  eventSpecializations: [
    "AI & Machine Learning", "Cybersecurity", "Web Development", "Data Analytics", "Software Engineering",
    "Networking & Cloud", "Accounting", "Finance", "Business & Management", "Hospitality & Tourism",
    "Marketing", "Engineering", "Food Technology", "Education", "Psychology & HR", "Pharmacy & Healthcare",
    "Design & Multimedia", "Telecommunications", "Other",
  ],
  tabs: { home: true, events: true, vacancies: true, resume: true, history: true },
};

/** @internal Shared by the sibling data modules; not for feature code. */
export function requireDb(): Firestore {
  if (!db) throw new Error("Firestore is not configured.");
  return db;
}

/** @internal Strips `undefined` so Firestore accepts the payload. */
export const clean = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** A record with no explicit status is a legacy row and counts as approved. */
export const isApproved = (job: Job) => !job.status || job.status === "approved";
