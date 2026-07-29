// Firestore access layer — the single integration seam between the UI and the
// database. Feature modules call these helpers; they never touch Firestore SDK
// directly. Swapping backends later means reimplementing only this file.
import {
  collection, deleteDoc, doc, onSnapshot, query, serverTimestamp,
  setDoc, updateDoc, where, type Firestore,
} from "firebase/firestore";
import { db } from "../../app/firebase-client";
import type { Application, ChatLog, Job, Resume, ViewEvent } from "./types";

export const COLLECTIONS = {
  users: "users",
  vacancies: "vacancies",
  whitelist: "whitelisted_emails",
  applications: "applications",
  viewEvents: "view_events",
  resumes: "resumes",
  chatLogs: "chat_logs",
} as const;

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
  const merged = job.pendingEdit ? { ...job, ...job.pendingEdit } : job;
  await updateDoc(doc(requireDb(), COLLECTIONS.vacancies, String(job.id)), {
    ...clean(merged), status: "approved", pendingEdit: null, updatedAt: serverTimestamp(),
  });
}

export async function rejectJob(id: number) {
  await updateDoc(doc(requireDb(), COLLECTIONS.vacancies, String(id)), {
    status: "rejected", pendingEdit: null, updatedAt: serverTimestamp(),
  });
}

// ---- Applications & view history ------------------------------------------

export async function recordApplication(app: Application) {
  await setDoc(doc(requireDb(), COLLECTIONS.applications, app.id),
    { ...clean(app), appliedAt: serverTimestamp() }, { merge: true });
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
