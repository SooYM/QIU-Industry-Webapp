// Exhibitor profiles shown on Home, and the profile-visit log behind the
// employer dashboard's visit count.
import {
  collection, deleteDoc, deleteField, doc, getCountFromServer, onSnapshot, query, serverTimestamp,
  setDoc, updateDoc, where,
} from "firebase/firestore";
import { clean, COLLECTIONS, requireDb } from "./client";
import { companyNameKey } from "./company-matching";
import type { Company } from "./types";

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

// ---- Company Profile View Counter ------------------------------------------

/**
 * Logs a profile visit, at most one per student per company per browser session.
 *
 * The dedupe is enforced by the rules, not by us: the doc id is pinned to
 * `{companyId}_{uid}_{sessionId}` and the collection is create-only, so
 * re-opening the same profile in one session is simply rejected. There is no counter field anywhere
 * — a counter a client increments directly can be pumped to any value from the
 * console, which would let a student (or a rival employer) fake another
 * company's numbers. The total is counted from these docs instead.
 */
/**
 * A per-browser-session id, so a visit counts once per account per session
 * rather than once per day.
 *
 * It lives in sessionStorage: it survives a refresh (so re-opening a profile
 * mid-visit does not inflate the count) and dies with the tab (so a return visit
 * later in the day counts again). The id is part of the document id, and the
 * rules pin its shape, which is what stops a client minting unlimited views.
 */
function browserSessionId(): string {
  const KEY = "industryday-session";
  try {
    const existing = window.sessionStorage.getItem(KEY);
    if (existing && /^[a-z0-9]{12}$/.test(existing)) return existing;
    const fresh = Array.from({ length: 12 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");
    window.sessionStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    // Private mode with storage disabled: fall back to a per-page-load id.
    return Array.from({ length: 12 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");
  }
}

export async function recordCompanyView(companyId: number, companyName: string, studentUid: string) {
  const database = requireDb();
  const viewId = `${companyId}_${studentUid}_${browserSessionId()}`;
  await setDoc(doc(database, COLLECTIONS.companyViews, viewId), {
    id: viewId,
    companyId,
    companyName,
    // Counting keys off the raw name silently returns zero whenever the
    // employer account's spelling differs from the exhibitor profile's
    // ("Acme Solutions" vs "Acme Solutions Sdn Bhd"). The canonical key is what
    // the rest of the app already matches on.
    companyKey: companyNameKey(companyName),
    studentUid,
    viewedAt: serverTimestamp(),
  }).catch(() => { /* Already counted this session — the rules reject the rewrite. */ });
}

/** Total profile visits for one company. Server-side count: does not download the docs. */
export async function countCompanyViews(companyName: string): Promise<number> {
  const q = query(
    collection(requireDb(), COLLECTIONS.companyViews),
    where("companyKey", "==", companyNameKey(companyName)),
  );
  return (await getCountFromServer(q)).data().count;
}

/** Profile visits across every company, for the admin dashboard. */
export async function countAllCompanyViews(): Promise<number> {
  return (await getCountFromServer(collection(requireDb(), COLLECTIONS.companyViews))).data().count;
}
