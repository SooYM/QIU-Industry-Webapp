// Firestore access layer — the single integration seam between the UI and the
// database. Feature modules call these helpers; they never touch Firestore SDK
// directly. Swapping backends later means reimplementing only this file.
import {
  collection, deleteDoc, deleteField, doc, getDoc, getDocs, increment, onSnapshot, query, serverTimestamp,
  setDoc, updateDoc, where, writeBatch, type DocumentReference, type Firestore,
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
  mail: "mail",
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
  const database = requireDb();
  const batch = writeBatch(database);
  batch.update(doc(database, COLLECTIONS.vacancies, String(job.id)), patch);
  const recipient = job.createdBy?.trim().toLowerCase() ?? "";
  const mailRef = doc(database, COLLECTIONS.mail, `vacancy-approved-${job.id}`);
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient) && !(await getDoc(mailRef)).exists()) {
    batch.set(mailRef, {
      to: recipient,
      message: {
        subject: `Vacancy approved: ${job.title}`,
        text: `Your vacancy listing "${job.title}" for ${job.company} has been approved by the QIU Industry Day administrator. It is now available in the portal.`,
      },
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
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
    { activeStep: "none", activeCode: "", codeExpiry: 0, previousCode: "", previousCodeExpiry: 0 });
}

// ---- Attendance ------------------------------------------------------------

/** CCA threshold: an admin-tunable percentage of the scheduled session. */
export function ccaThresholdMinutes(sessionMinutes: number, settings?: Pick<AppSettings, "ccaPercent">) {
  const percent = settings?.ccaPercent ?? DEFAULT_SETTINGS.ccaPercent;
  return sessionMinutes > 0 ? Math.ceil((percent / 100) * sessionMinutes) : 0;
}

export async function checkInAttendance(event: EventItem, uid: string, name: string, email: string, code: string) {
  await setDoc(doc(requireDb(), COLLECTIONS.attendance, `${event.id}_${uid}`), {
    id: `${event.id}_${uid}`, eventId: event.id, eventTitle: event.title,
    studentUid: uid, studentEmail: email, studentName: name,
    code, step: "checkin", checkInMs: Date.now(), checkInAt: serverTimestamp(),
  });
}

export async function checkOutAttendance(event: EventItem, uid: string, code: string, existing: Attendance, settings?: Pick<AppSettings, "ccaPercent">) {
  const checkOutMs = Date.now();
  const durationMinutes = existing.checkInMs ? Math.floor((checkOutMs - existing.checkInMs) / 60000) : 0;
  const caEligible = event.sessionMinutes > 0 && durationMinutes >= ccaThresholdMinutes(event.sessionMinutes, settings);
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
    onData(snap.docs.map((d) => d.data() as Company).sort((a, b) => a.name.localeCompare(b.name)));
  }, onError);
}

// Optional company fields that an editor can blank out. On edit, a cleared value
// must be removed from the doc — clean() drops undefined keys, so updateDoc would
// otherwise leave the old value (e.g. a "deleted" logo would linger).
const COMPANY_OPTIONAL: (keyof Company)[] = ["logoUrl", "website", "videoUrl", "summary", "boothNumber"];

export async function saveCompany(company: Company, isEditing: boolean, creatorEmail: string) {
  const database = requireDb();
  const ref = doc(database, COLLECTIONS.companies, String(company.id));
  if (isEditing) {
    const payload: Record<string, unknown> = { ...clean(company), updatedAt: serverTimestamp() };
    for (const key of COMPANY_OPTIONAL) if (company[key] == null || company[key] === "") payload[key] = deleteField();
    await updateDoc(ref, payload);
  } else {
    await setDoc(ref, { ...clean(company), createdBy: creatorEmail, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
}

export async function deleteCompany(id: number) {
  await deleteDoc(doc(requireDb(), COLLECTIONS.companies, String(id)));
}

/** Approve a pending employer-submitted exhibitor. Patch only — re-sending the
 * whole doc would JSON-corrupt the createdAt Timestamp and the rule would reject it. */
export async function approveCompany(id: number) {
  await updateDoc(doc(requireDb(), COLLECTIONS.companies, String(id)), { status: "approved", updatedAt: serverTimestamp() });
}

/** Employer edit to an approved profile: stage it, keep the live profile on Home. */
export async function stageCompanyEdit(id: number, edit: Partial<Company>) {
  await updateDoc(doc(requireDb(), COLLECTIONS.companies, String(id)), {
    status: "pending_edit", pendingEdit: clean(edit), updatedAt: serverTimestamp(),
  });
}

/** Admin approves a staged company edit: apply the change, clear the stage. Patch only. */
export async function applyCompanyEdit(company: Company) {
  const patch: Record<string, unknown> = { status: "approved", pendingEdit: null, updatedAt: serverTimestamp() };
  if (company.pendingEdit) Object.assign(patch, clean(company.pendingEdit));
  await updateDoc(doc(requireDb(), COLLECTIONS.companies, String(company.id)), patch);
}

/** Admin rejects a staged edit: revert to the live approved profile. */
export async function rejectCompanyEdit(id: number) {
  await updateDoc(doc(requireDb(), COLLECTIONS.companies, String(id)), { status: "approved", pendingEdit: null, updatedAt: serverTimestamp() });
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

type SignupInput = { name: string; company: string; contact?: string; website?: string; logoUrl?: string; videoUrl?: string; summary?: string };

/** A non-QIU visitor submits their own signup (doc id = lowercased email). */
export async function submitSignup(email: string, data: SignupInput) {
  const id = email.trim().toLowerCase();
  await setDoc(doc(requireDb(), COLLECTIONS.signups, id), {
    email: id, name: data.name.trim(), company: data.company.trim(),
    ...(data.contact?.trim() ? { contact: data.contact.trim() } : {}),
    ...(data.website?.trim() ? { website: data.website.trim() } : {}),
    ...(data.logoUrl?.trim() ? { logoUrl: data.logoUrl.trim() } : {}),
    ...(data.videoUrl?.trim() ? { videoUrl: data.videoUrl.trim() } : {}),
    ...(data.summary?.trim() ? { summary: data.summary.trim() } : {}),
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

/**
 * Admin approves a registration: (1) whitelist the email as an employer with
 * their company, (2) publish their exhibitor profile straight into the Home
 * showcase from the details they submitted, (3) clear the request. The employer
 * can then edit that same profile later (createdBy = their email).
 */
export async function approveSignup(signup: EmployerSignup, approverEmail: string) {
  const database = requireDb();
  const companyId = companyIdForSignup(signup.email);
  const batch = writeBatch(database);
  batch.set(doc(database, COLLECTIONS.whitelist, signup.email), {
    email: signup.email, role: "employer", company: signup.company, active: true, addedBy: approverEmail, updatedAt: serverTimestamp(),
  }, { merge: true });
  batch.set(doc(database, COLLECTIONS.companies, String(companyId)), {
    id: companyId,
    name: signup.company,
    email: signup.email,
    ...(signup.website ? { website: signup.website } : {}),
    ...(signup.logoUrl ? { logoUrl: signup.logoUrl } : {}),
    ...(signup.videoUrl ? { videoUrl: signup.videoUrl } : {}),
    ...(signup.summary ? { summary: signup.summary } : {}),
    status: "approved",
    createdBy: signup.email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.delete(doc(database, COLLECTIONS.signups, signup.email));
  batch.set(doc(database, COLLECTIONS.mail, `registration-approved-${signup.email}`), {
    to: signup.email,
    message: {
      subject: `Company registration approved: ${signup.company}`,
      text: `Hi ${signup.name},\n\n${signup.company}'s registration for QIU Industry Day has been approved. Sign in to the portal with this Google account to manage your company profile and vacancy listings.`,
    },
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

function companyIdForSignup(email: string) {
  let hash = 2166136261;
  for (const char of email.trim().toLowerCase()) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return 8_000_000_000_000 + (hash >>> 0);
}

/** Revoke one employer and atomically remove their exhibitor profile, vacancies,
 * pending signup, and per-vacancy public counters. Recruitment history remains. */
export async function revokeEmployerAccess(email: string, companyName = "") {
  const database = requireDb();
  const owner = email.trim().toLowerCase();
  const company = companyName.trim();
  const [ownedJobs, companyJobs, ownedProfiles, namedProfiles] = await Promise.all([
    getDocs(query(collection(database, COLLECTIONS.vacancies), where("createdBy", "==", owner))),
    company ? getDocs(query(collection(database, COLLECTIONS.vacancies), where("company", "==", company))) : null,
    getDocs(query(collection(database, COLLECTIONS.companies), where("createdBy", "==", owner))),
    company ? getDocs(query(collection(database, COLLECTIONS.companies), where("name", "==", company))) : null,
  ]);
  const vacancyRefs = new Map<string, DocumentReference>();
  const companyRefs = new Map<string, DocumentReference>();
  for (const snapshot of [ownedJobs, companyJobs]) snapshot?.docs.forEach((entry) => vacancyRefs.set(entry.ref.path, entry.ref));
  for (const snapshot of [ownedProfiles, namedProfiles]) snapshot?.docs.forEach((entry) => companyRefs.set(entry.ref.path, entry.ref));
  const writeCount = vacancyRefs.size * 2 + companyRefs.size + 2;
  if (writeCount > 450) throw new Error("Company has too many records for one safe revoke operation.");
  const batch = writeBatch(database);
  vacancyRefs.forEach((ref) => {
    batch.delete(ref);
    batch.delete(doc(database, COLLECTIONS.jobStats, ref.id));
  });
  companyRefs.forEach((ref) => batch.delete(ref));
  batch.delete(doc(database, COLLECTIONS.signups, owner));
  batch.delete(doc(database, COLLECTIONS.whitelist, owner));
  await batch.commit();
  return { vacancies: vacancyRefs.size, profiles: companyRefs.size };
}

export async function deleteSignup(email: string) {
  await deleteDoc(doc(requireDb(), COLLECTIONS.signups, email.trim().toLowerCase()));
}

/**
 * Superadmin-only hard reset: wipes every data collection back to empty (keeps
 * portal settings and the superadmin's own account). Best-effort per document.
 */
export async function resetAllData(superadminEmail: string) {
  const database = requireDb();
  const cols = [
    COLLECTIONS.vacancies, COLLECTIONS.applications, COLLECTIONS.viewEvents, COLLECTIONS.resumes,
    COLLECTIONS.chatLogs, COLLECTIONS.events, COLLECTIONS.eventCodes, COLLECTIONS.attendance,
    COLLECTIONS.jobStats, COLLECTIONS.companies, COLLECTIONS.signups, COLLECTIONS.whitelist,
    COLLECTIONS.mail,
  ];
  for (const c of cols) {
    const snap = await getDocs(collection(database, c));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
  }
  const usersSnap = await getDocs(collection(database, COLLECTIONS.users));
  await Promise.all(usersSnap.docs
    .filter((d) => ((d.data().email as string) ?? "").toLowerCase() !== superadminEmail.toLowerCase())
    .map((d) => deleteDoc(d.ref).catch(() => {})));
}
