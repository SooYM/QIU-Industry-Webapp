// Persisted assistant turns. Admins read all; employers read only their own company.
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { clean, COLLECTIONS, requireDb } from "./client";
import type { ChatLog } from "./types";

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
