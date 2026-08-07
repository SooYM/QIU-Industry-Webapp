// Vacancies, the applications and view history that hang off them, and student resumes.
import {
  collection, deleteDoc, doc, getDoc, increment, onSnapshot, query, serverTimestamp, setDoc,
  updateDoc, where, writeBatch,
} from "firebase/firestore";
import { clean, COLLECTIONS, requireDb } from "./client";
import type { Application, Job, Resume, ViewEvent } from "./types";

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
  // Same immutability trap as registration approvals: a fixed id blocks any
  // re-approval of the same vacancy after a staged edit.
  const mailRef = doc(database, COLLECTIONS.mail, `vacancy-approved-${job.id}-${Date.now()}`);
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
