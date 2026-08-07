// Employer self-registration, access revocation, and the superadmin data reset.
import {
  collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where, writeBatch,
  type DocumentReference,
} from "firebase/firestore";
import { COLLECTIONS, requireDb } from "./client";
import { companyNamesMatch } from "./company-matching";
import type { Company, EmployerSignup } from "./types";

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
/**
 * Grants a registered rep access and makes sure a company profile exists for them.
 *
 * Two deliberate choices here, both learned from approvals failing in the field:
 *
 * 1. If a company with this name already exists (an admin created or imported it
 *    ahead of the event), the rep is linked to THAT profile instead of a second
 *    one being minted from their email. Otherwise "Oracle Red Bull Racing" ends
 *    up on the Home page twice.
 * 2. The notification email is written AFTER the batch, best-effort. It used to
 *    be inside it, so any problem with the mail record — which is immutable, and
 *    which nothing currently delivers anyway — failed the entire approval
 *    atomically and the admin just saw "Could not approve."
 */
export async function approveSignup(signup: EmployerSignup, approverEmail: string, existing?: readonly Company[]) {
  const database = requireDb();
  const match = existing?.find((c) => companyNamesMatch(c.name, signup.company));
  const companyId = match?.id ?? companyIdForSignup(signup.email);

  const batch = writeBatch(database);
  batch.set(doc(database, COLLECTIONS.whitelist, signup.email), {
    email: signup.email, role: "employer", company: match?.name ?? signup.company,
    active: true, addedBy: approverEmail, updatedAt: serverTimestamp(),
  }, { merge: true });

  batch.set(doc(database, COLLECTIONS.companies, String(companyId)), {
    id: companyId,
    name: match?.name ?? signup.company,
    email: signup.email,
    ...(signup.website ? { website: signup.website } : {}),
    ...(signup.logoUrl ? { logoUrl: signup.logoUrl } : {}),
    ...(signup.videoUrl ? { videoUrl: signup.videoUrl } : {}),
    ...(signup.summary ? { summary: signup.summary } : {}),
    status: "approved",
    // An update must not change createdBy — the rules reject that outright.
    createdBy: match?.createdBy ?? signup.email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  batch.delete(doc(database, COLLECTIONS.signups, signup.email));
  await batch.commit();

  // Best-effort, and outside the batch on purpose: a rejected mail record must
  // never undo an approval that has otherwise succeeded.
  await setDoc(doc(database, COLLECTIONS.mail, `registration-approved-${signup.email}-${Date.now()}`), {
    to: signup.email,
    message: {
      subject: `Company registration approved: ${signup.company}`,
      text: `Hi ${signup.name},\n\n${signup.company}'s registration for QIU Industry Day has been approved. Sign in to the portal with ${signup.email} and the password you chose to manage your company profile and vacancy listings.`,
    },
    createdAt: serverTimestamp(),
  }).catch(() => { /* No mailer is installed; the approval itself already stands. */ });
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
    COLLECTIONS.mail, COLLECTIONS.eventInterests, COLLECTIONS.eventLiveChat, COLLECTIONS.interviewSlots,
    COLLECTIONS.talkLiveChats, COLLECTIONS.eventFeedbacks, COLLECTIONS.companyViews,
    COLLECTIONS.interviewBookings,
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
