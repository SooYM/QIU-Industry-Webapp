// Talks: the events themselves, the rotating attendance code, attendance records,
// student interest, the live Q&A box and post-event reviews.
import {
  collection, deleteDoc, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where,
  getCountFromServer,
} from "firebase/firestore";
import { clean, COLLECTIONS, DEFAULT_SETTINGS, requireDb } from "./client";
import type { AppSettings, Attendance, EventCode, EventFeedback, EventItem, TalkLiveChatMessage } from "./types";

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

// ---- Event Interests & Reminders -------------------------------------------

/**
 * Marks/unmarks interest in a talk, returning the new state. There is no counter
 * field to keep in sync: one doc per student per event IS the count, so the tally
 * in `subscribeEventInterestCounts` can never drift from reality.
 */
export async function toggleEventInterest(eventId: number, studentUid: string, studentEmail: string, studentName: string): Promise<boolean> {
  const database = requireDb();
  const interestId = `${eventId}_${studentUid}`;
  const interestRef = doc(database, COLLECTIONS.eventInterests, interestId);

  if ((await getDoc(interestRef)).exists()) {
    await deleteDoc(interestRef);
    return false;
  }
  await setDoc(interestRef, {
    id: interestId,
    eventId,
    studentUid,
    studentEmail,
    studentName,
    createdAt: serverTimestamp(),
  });
  return true;
}

/**
 * Interested-student count per event id.
 *
 * Counted server-side, one aggregation query per event. A live subscription over
 * the whole collection would be simpler, but every client would then stream every
 * student's interest doc — ~10k docs on a 1,900-student campus, re-fanned to every
 * listener on each tap — which does not survive an event day.
 */
export async function countEventInterests(eventIds: number[]): Promise<Record<number, number>> {
  const database = requireDb();
  const counts: Record<number, number> = {};
  await Promise.all(eventIds.map(async (id) => {
    const q = query(collection(database, COLLECTIONS.eventInterests), where("eventId", "==", id));
    counts[id] = (await getCountFromServer(q)).data().count;
  }));
  return counts;
}

export function subscribeMyEventInterests(studentUid: string, onData: (interests: Record<number, boolean>) => void) {
  if (!studentUid) {
    onData({});
    return () => {};
  }
  const q = query(collection(requireDb(), COLLECTIONS.eventInterests), where("studentUid", "==", studentUid));
  return onSnapshot(q, (snap) => {
    const interests: Record<number, boolean> = {};
    snap.docs.forEach((d) => {
      const data = d.data();
      if (data.eventId) interests[Number(data.eventId)] = true;
    });
    onData(interests);
  });
}

// ---- Talk Live Chat --------------------------------------------------------

const millis = (ts: unknown) => (ts as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;

/**
 * Opens/closes the Q&A box for a talk. Kept in its own doc so an admin-assigned
 * presenter can flip it without holding write access to the event itself.
 */
export async function toggleEventLiveChat(eventId: number, enabled: boolean) {
  await setDoc(doc(requireDb(), COLLECTIONS.eventLiveChat, String(eventId)), {
    eventId,
    enabled,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export function subscribeEventLiveChatState(eventId: number, onData: (enabled: boolean) => void) {
  return onSnapshot(doc(requireDb(), COLLECTIONS.eventLiveChat, String(eventId)), (snap) => {
    onData(Boolean(snap.exists() && snap.data()?.enabled));
  });
}

export async function sendTalkLiveChatMessage(eventId: number, studentUid: string, studentName: string, studentEmail: string, message: string) {
  const database = requireDb();
  const msgId = `${eventId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  await setDoc(doc(database, COLLECTIONS.talkLiveChats, msgId), {
    id: msgId,
    eventId,
    studentUid,
    studentName,
    studentEmail,
    message: message.trim(),
    approved: false,
    createdAt: serverTimestamp(),
  });
}

/**
 * Approves (or un-approves) one question. Only an admin or the talk's presenter
 * may flip the flag — the rules enforce that this is the only field they change.
 */
export async function approveTalkLiveChatMessage(messageId: string, approved: boolean) {
  await updateDoc(doc(requireDb(), COLLECTIONS.talkLiveChats, messageId), { approved });
}

/**
 * Removes one question from a talk's feed. Permitted for an admin or the
 * presenter assigned to that event, so abuse can be taken down mid-talk rather
 * than only stopped by closing the whole Q&A.
 */
export async function deleteTalkLiveChatMessage(messageId: string) {
  await deleteDoc(doc(requireDb(), COLLECTIONS.talkLiveChats, messageId));
}

/** Every Q&A message across all talks, newest last. Admin history view. */
export function subscribeAllTalkLiveChats(onData: (messages: TalkLiveChatMessage[]) => void) {
  return onSnapshot(collection(requireDb(), COLLECTIONS.talkLiveChats), (snap) => {
    const msgs = snap.docs.map((d) => d.data() as TalkLiveChatMessage);
    msgs.sort((a, b) => millis(a.createdAt) - millis(b.createdAt));
    onData(msgs);
  });
}

export function subscribeTalkLiveChat(eventId: number, onData: (messages: TalkLiveChatMessage[]) => void) {
  const q = query(collection(requireDb(), COLLECTIONS.talkLiveChats), where("eventId", "==", eventId));
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs.map((d) => d.data() as TalkLiveChatMessage);
    msgs.sort((a, b) => millis(a.createdAt) - millis(b.createdAt));
    onData(msgs);
  });
}

// ---- Post-Event Feedbacks & Reviews ---------------------------------------

export async function submitEventFeedback(feedback: EventFeedback) {
  const database = requireDb();
  await setDoc(doc(database, COLLECTIONS.eventFeedbacks, feedback.id), {
    ...clean(feedback),
    createdAt: serverTimestamp(),
  }, { merge: true });
}

export function subscribeEventFeedbacks(eventId: number, onData: (feedbacks: EventFeedback[]) => void) {
  const q = query(collection(requireDb(), COLLECTIONS.eventFeedbacks), where("eventId", "==", eventId));
  return onSnapshot(q, (snap) => {
    onData(snap.docs.map((d) => d.data() as EventFeedback));
  });
}
