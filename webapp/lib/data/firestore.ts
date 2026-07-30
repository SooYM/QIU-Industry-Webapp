// Firestore access layer — the single integration seam between the UI and the
// database. Feature modules call these helpers; they never touch Firestore SDK
// directly. Swapping backends later means reimplementing only this file.
import {
  collection, deleteDoc, doc, getDoc, increment, onSnapshot, query, serverTimestamp,
  setDoc, updateDoc, where, type Firestore,
} from "firebase/firestore";
import { db } from "../../app/firebase-client";
import type { AppSettings, Application, Attendance, ChatLog, Company, EmployerSignup, EventCode, EventItem, Job, Resume, ViewEvent } from "./types";

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
} as const;

/** Fallback settings before the settings doc loads (or if an admin hasn't saved any). */
export const DEFAULT_SETTINGS: AppSettings = {
  portalTitle: "Industry Day 2026",
  portalTagline: "QIU Industry Day 2026. Verify vacancy details directly with the employer.",
  qrRotateSeconds: 30,
  ccaPercent: 80,
  ccaFloorMinutes: 45,
  tabs: { home: true, events: true, vacancies: true, resume: true, history: true },
};

function requireDb(): Firestore {
  if (!db) throw new Error("Firestore is not configured.");
  return db;
}

const clean = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** A record with no explicit status is a legacy row and counts as approved. */
export const isApproved = (job: Job) => !job.status || job.status === "approved";

// ---- Vacancies -------------------------------------------------------------

export function subscribeVacancies(onData: (jobs: Job[]) => void, onError: () => void) {
  return onSnapshot(collection(requireDb(), COLLECTIONS.vacancies), (snap) => {
    onData(snap.docs.map((d) => d.data() as Job).sort((a, b) => b.id - a.id));
  }, onError);
}

export async function saveJob(job: Job, isEditing: boolean, creatorEmail: string) {
  const database = requireDb();
  const payload = { ...clean(job), isCustom: true, updatedAt: serverTimestamp() };
  const ref = doc(database, COLLECTIONS.vacancies, String(job.id));
  if (isEditing) await updateDoc(ref, payload);
  else await setDoc(ref, { ...payload, createdBy: creatorEmail, createdAt: serverTimestamp() });
}

export async function deleteJob(id: number) {
  await deleteDoc(doc(requireDb(), COLLECTIONS.vacancies, String(id)));
}

/** Employer edit to an approved job: stage the change, keep the live snapshot. */
export async function stageJobEdit(id: number, edit: Partial<Job>) {
  await updateDoc(doc(requireDb(), COLLECTIONS.vacancies, String(id)), {
    status: "pending_edit", pendingEdit: clean(edit), updatedAt: serverTimestamp(),
  });
}

export async function approveJob(job: Job) {
  // Patch only — never re-send createdAt/updatedAt. Round-tripping the whole doc
  // through JSON would turn the Firestore Timestamp into a plain object and the
  // immutable-createdAt rule would reject the write (this is why approve failed).
  const patch: Record<string, unknown> = { status: "approved", pendingEdit: null, updatedAt: serverTimestamp() };
  if (job.pendingEdit) Object.assign(patch, clean(job.pendingEdit)); // apply the staged edit
  await updateDoc(doc(requireDb(), COLLECTIONS.vacancies, String(job.id)), patch);
}

export async function rejectJob(id: number) {
  await updateDoc(doc(requireDb(), COLLECTIONS.vacancies, String(id)), {
    status: "rejected", pendingEdit: null, updatedAt: serverTimestamp(),
  });
}

// ---- Applications & view history ------------------------------------------

/** Public per-job applicant tally (no identities). Read by all; incremented on apply/withdraw. */
async function bumpApplicants(jobId: number, delta: number) {
  await setDoc(doc(requireDb(), COLLECTIONS.jobStats, String(jobId)), { applicants: increment(delta) }, { merge: true }).catch(() => {});
}

export function subscribeJobStats(onData: (counts: Record<number, number>) => void) {
  return onSnapshot(collection(requireDb(), COLLECTIONS.jobStats), (snap) => {
    const counts: Record<number, number> = {};
    snap.docs.forEach((d) => { counts[Number(d.id)] = Math.max(0, (d.data().applicants as number) || 0); });
    onData(counts);
  });
}

export async function recordApplication(app: Application) {
  // No pre-read: security rules deny reading a not-yet-existing application doc,
  // which previously made apply fail. The Apply button is UI-gated to a single
  // application per job, so the counter stays accurate.
  await setDoc(doc(requireDb(), COLLECTIONS.applications, app.id),
    { ...clean(app), appliedAt: serverTimestamp() }, { merge: true });
  await bumpApplicants(app.jobId, 1);
}

/** Student withdraws an application they changed their mind about. */
export async function deleteApplication(id: string) {
  await deleteDoc(doc(requireDb(), COLLECTIONS.applications, id));
  const jobId = Number(id.split("_")[1]);
  if (jobId) await bumpApplicants(jobId, -1);
}

export async function recordView(event: ViewEvent) {
  await setDoc(doc(requireDb(), COLLECTIONS.viewEvents, event.id),
    { ...clean(event), viewedAt: serverTimestamp() }, { merge: true });
}

export function subscribeApplications(onData: (rows: Application[]) => void, studentUid?: string) {
  const col = collection(requireDb(), COLLECTIONS.applications);
  const q = studentUid ? query(col, where("studentUid", "==", studentUid)) : col;
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data() as Application)));
}

export function subscribeViews(onData: (rows: ViewEvent[]) => void, studentUid?: string) {
  const col = collection(requireDb(), COLLECTIONS.viewEvents);
  const q = studentUid ? query(col, where("studentUid", "==", studentUid)) : col;
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data() as ViewEvent)));
}

// ---- Resumes ---------------------------------------------------------------

export async function saveResume(resume: Resume) {
  await setDoc(doc(requireDb(), COLLECTIONS.resumes, resume.id),
    { ...clean(resume), updatedAt: serverTimestamp() }, { merge: true });
}

export async function deleteResume(uid: string) {
  await deleteDoc(doc(requireDb(), COLLECTIONS.resumes, uid));
}

export function subscribeResumes(onData: (rows: Resume[]) => void) {
  return onSnapshot(collection(requireDb(), COLLECTIONS.resumes),
    (snap) => onData(snap.docs.map((d) => d.data() as Resume)));
}

/** Student view: watch only their own resume doc (id === uid). */
export function subscribeMyResume(uid: string, onData: (resume: Resume | null) => void) {
  return onSnapshot(doc(requireDb(), COLLECTIONS.resumes, uid),
    (snap) => onData(snap.exists() ? (snap.data() as Resume) : null));
}

// ---- Chat logs -------------------------------------------------------------

export async function logChat(entry: ChatLog) {
  await setDoc(doc(requireDb(), COLLECTIONS.chatLogs, entry.id),
    { ...clean(entry), createdAt: serverTimestamp() });
}

/** Admin view: every chat, with student identity. */
export function subscribeAllChats(onData: (rows: ChatLog[]) => void) {
  return onSnapshot(collection(requireDb(), COLLECTIONS.chatLogs),
    (snap) => onData(snap.docs.map((d) => d.data() as ChatLog)));
}

/** Employer view: only their company's chats (identity stripped at the UI layer). */
export function subscribeCompanyChats(company: string, onData: (rows: ChatLog[]) => void) {
  const q = query(collection(requireDb(), COLLECTIONS.chatLogs), where("company", "==", company));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data() as ChatLog)));
}

// ---- Events ----------------------------------------------------------------

export function subscribeEvents(onData: (rows: EventItem[]) => void, onError?: () => void) {
  return onSnapshot(collection(requireDb(), COLLECTIONS.events),
    (snap) => onData(snap.docs.map((d) => d.data() as EventItem).sort((a, b) => a.startAt.localeCompare(b.startAt))),
    onError);
}

export async function saveEvent(event: EventItem, isEditing: boolean, creatorEmail: string) {
  const database = requireDb();
  const payload = { ...clean(event), updatedAt: serverTimestamp() };
  const ref = doc(database, COLLECTIONS.events, String(event.id));
  if (isEditing) await updateDoc(ref, payload);
  else await setDoc(ref, { ...payload, createdBy: creatorEmail, createdAt: serverTimestamp() });
}

export async function deleteEvent(id: number) {
  await deleteDoc(doc(requireDb(), COLLECTIONS.events, String(id)));
}

/** Presenter: publish the current rotating code + step for an event. */
export async function setEventCode(eventId: number, code: EventCode) {
  await setDoc(doc(requireDb(), COLLECTIONS.eventCodes, String(eventId)), clean(code));
}

export async function stopEventCode(eventId: number) {
  await setDoc(doc(requireDb(), COLLECTIONS.eventCodes, String(eventId)),
    { activeStep: "none", activeCode: "", codeExpiry: 0 });
}

// ---- Attendance ------------------------------------------------------------

/** CCA threshold: a % of the scheduled session (admin-tunable), else a minutes floor. */
export function ccaThresholdMinutes(sessionMinutes: number, settings?: Pick<AppSettings, "ccaPercent" | "ccaFloorMinutes">) {
  const percent = settings?.ccaPercent ?? DEFAULT_SETTINGS.ccaPercent;
  const floor = settings?.ccaFloorMinutes ?? DEFAULT_SETTINGS.ccaFloorMinutes;
  return sessionMinutes > 0 ? Math.round((percent / 100) * sessionMinutes) : floor;
}

export async function checkInAttendance(event: EventItem, uid: string, name: string, email: string, code: string) {
  await setDoc(doc(requireDb(), COLLECTIONS.attendance, `${event.id}_${uid}`), {
    id: `${event.id}_${uid}`, eventId: event.id, eventTitle: event.title,
    studentUid: uid, studentEmail: email, studentName: name,
    code, step: "checkin", checkInMs: Date.now(), checkInAt: serverTimestamp(),
  });
}

export async function checkOutAttendance(event: EventItem, uid: string, code: string, existing: Attendance, settings?: Pick<AppSettings, "ccaPercent" | "ccaFloorMinutes">) {
  const checkOutMs = Date.now();
  const durationMinutes = existing.checkInMs ? Math.round((checkOutMs - existing.checkInMs) / 60000) : 0;
  const caEligible = durationMinutes >= ccaThresholdMinutes(event.sessionMinutes, settings);
  await updateDoc(doc(requireDb(), COLLECTIONS.attendance, `${event.id}_${uid}`), {
    code, step: "checkout", checkOutMs, durationMinutes, caEligible, checkOutAt: serverTimestamp(),
  });
}

export async function getMyAttendance(eventId: number, uid: string): Promise<Attendance | null> {
  const snap = await getDoc(doc(requireDb(), COLLECTIONS.attendance, `${eventId}_${uid}`));
  return snap.exists() ? (snap.data() as Attendance) : null;
}

export function subscribeAttendance(onData: (rows: Attendance[]) => void, studentUid?: string) {
  const col = collection(requireDb(), COLLECTIONS.attendance);
  const q = studentUid ? query(col, where("studentUid", "==", studentUid)) : col;
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data() as Attendance)));
}

// ---- Exhibitors (Home showcase) --------------------------------------------

export function subscribeCompanies(onData: (rows: Company[]) => void, onError?: () => void) {
  return onSnapshot(collection(requireDb(), COLLECTIONS.companies), (snap) => {
    onData(snap.docs.map((d) => d.data() as Company).sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name),
    ));
  }, onError);
}

export async function saveCompany(company: Company, isEditing: boolean, creatorEmail: string) {
  const database = requireDb();
  const payload = { ...clean(company), updatedAt: serverTimestamp() };
  const ref = doc(database, COLLECTIONS.companies, String(company.id));
  if (isEditing) await updateDoc(ref, payload);
  else await setDoc(ref, { ...payload, createdBy: creatorEmail, createdAt: serverTimestamp() });
}

export async function deleteCompany(id: number) {
  await deleteDoc(doc(requireDb(), COLLECTIONS.companies, String(id)));
}

/** Approve a pending employer-submitted exhibitor. Patch only — re-sending the
 * whole doc would JSON-corrupt the createdAt Timestamp and the rule would reject it. */
export async function approveCompany(id: number) {
  await updateDoc(doc(requireDb(), COLLECTIONS.companies, String(id)), { status: "approved", updatedAt: serverTimestamp() });
}

/** One-click clear: remove every exhibitor (admin only, enforced by rules). */
export async function clearCompanies(ids: number[]) {
  await Promise.all(ids.map((id) => deleteDoc(doc(requireDb(), COLLECTIONS.companies, String(id))).catch(() => {})));
}

// ---- App settings ----------------------------------------------------------

const SETTINGS_DOC = "app";

export function subscribeSettings(onData: (settings: AppSettings) => void) {
  return onSnapshot(doc(requireDb(), COLLECTIONS.settings, SETTINGS_DOC), (snap) => {
    const stored = snap.exists() ? (snap.data() as Partial<AppSettings>) : {};
    onData({
      ...DEFAULT_SETTINGS,
      ...stored,
      tabs: { ...DEFAULT_SETTINGS.tabs, ...(stored.tabs ?? {}) },
    });
  });
}

export async function saveSettings(settings: AppSettings) {
  await setDoc(doc(requireDb(), COLLECTIONS.settings, SETTINGS_DOC),
    { ...clean(settings), updatedAt: serverTimestamp() }, { merge: true });
}

// ---- Employer self-registration --------------------------------------------

/** A non-QIU visitor submits their own signup (doc id = lowercased email). */
export async function submitSignup(email: string, data: { name: string; company: string; contact?: string }) {
  const id = email.trim().toLowerCase();
  await setDoc(doc(requireDb(), COLLECTIONS.signups, id), {
    email: id, name: data.name.trim(), company: data.company.trim(),
    ...(data.contact?.trim() ? { contact: data.contact.trim() } : {}),
    status: "pending", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }, { merge: true });
}

/** Watch a single visitor's own signup (so they can see approval status). */
export function subscribeMySignup(email: string, onData: (s: EmployerSignup | null) => void) {
  return onSnapshot(doc(requireDb(), COLLECTIONS.signups, email.trim().toLowerCase()),
    (snap) => onData(snap.exists() ? (snap.data() as EmployerSignup) : null), () => onData(null));
}

/** Admin: every pending/approved signup request. */
export function subscribeSignups(onData: (rows: EmployerSignup[]) => void) {
  return onSnapshot(collection(requireDb(), COLLECTIONS.signups), (snap) => onData(snap.docs.map((d) => d.data() as EmployerSignup)));
}

/** Admin approves a signup: whitelist the email as an employer with their company. */
export async function approveSignup(signup: EmployerSignup, approverEmail: string) {
  const database = requireDb();
  await setDoc(doc(database, COLLECTIONS.whitelist, signup.email), {
    email: signup.email, role: "employer", company: signup.company, active: true, addedBy: approverEmail, updatedAt: serverTimestamp(),
  }, { merge: true });
  await updateDoc(doc(database, COLLECTIONS.signups, signup.email), { status: "approved", updatedAt: serverTimestamp() });
}

export async function deleteSignup(email: string) {
  await deleteDoc(doc(requireDb(), COLLECTIONS.signups, email.trim().toLowerCase()));
}
