// Mock interview slots and their bookings. The seat list lives on the slot (uid
// only, because students can read it); the contact details live in a separate
// staff-only collection, written in the same transaction.
import {
  collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, runTransaction, serverTimestamp,
  setDoc, where,
} from "firebase/firestore";
import { clean, COLLECTIONS, requireDb } from "./client";
import type { InterviewBooking, InterviewBookingStudent, InterviewSlot } from "./types";

// ---- Interview Slots & Bookings --------------------------------------------

/**
 * Creates or edits a slot. `bookedStudents` is deliberately NOT part of the
 * payload: the slot id is derived from company+date+time, so re-submitting the
 * form for an existing slot would otherwise merge an empty array over the real
 * bookings and delete them irrecoverably.
 */
export async function saveInterviewSlot(slot: InterviewSlot) {
  const database = requireDb();
  const ref = doc(database, COLLECTIONS.interviewSlots, slot.id);
  const { bookedStudents, ...rest } = slot;
  const exists = (await getDoc(ref)).exists();
  await setDoc(ref, {
    ...clean(rest),
    ...(exists ? {} : { bookedStudents: bookedStudents ?? [] }),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

/** Removes a slot and the contact details of everyone who had booked it. */
export async function deleteInterviewSlot(slotId: string) {
  const database = requireDb();
  const bookings = await getDocs(query(
    collection(database, COLLECTIONS.interviewBookings), where("slotId", "==", slotId),
  ));
  await Promise.all(bookings.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
  await deleteDoc(doc(database, COLLECTIONS.interviewSlots, slotId));
}

/**
 * Takes a seat, in a transaction.
 *
 * Two documents move together: the seat (uid only) on the publicly-readable slot,
 * and the student's contact details in the staff-only bookings collection. A
 * transaction is what keeps them consistent — and it is also what stops a lost
 * update: read-then-write without one lets two students both read N seats and
 * both write N+1, so the second silently overwrites the first, who was told they
 * were booked and would turn up on the day missing from the employer's list.
 */
export async function bookInterviewSlot(slotId: string, student: InterviewBookingStudent) {
  const database = requireDb();
  const slotRef = doc(database, COLLECTIONS.interviewSlots, slotId);
  const bookingRef = doc(database, COLLECTIONS.interviewBookings, `${slotId}_${student.studentUid}`);
  await runTransaction(database, async (tx) => {
    const snap = await tx.get(slotRef);
    if (!snap.exists()) throw new Error("Interview slot not found.");
    const slot = snap.data() as InterviewSlot;
    const booked = slot.bookedStudents ?? [];
    if (booked.some((b) => b.studentUid === student.studentUid)) {
      throw new Error("You have already booked this interview session.");
    }
    if (booked.length >= slot.maxBookings) {
      throw new Error("This interview slot is fully booked.");
    }
    tx.update(slotRef, {
      bookedStudents: [...booked, {
        studentUid: student.studentUid,
        bookedAt: Date.now(),
        sessionType: student.sessionType ?? "interview",
      }],
      updatedAt: serverTimestamp(),
    });
    tx.set(bookingRef, clean({
      id: bookingRef.id,
      slotId,
      companyName: slot.companyName,
      date: slot.date,
      startTime: slot.startTime,
      ...student,
      bookedAt: Date.now(),
    } as InterviewBooking));
  });
}

/** Frees a seat and removes the contact details with it. Transactional, same reason. */
export async function cancelInterviewBooking(slotId: string, studentUid: string) {
  const database = requireDb();
  const slotRef = doc(database, COLLECTIONS.interviewSlots, slotId);
  const bookingRef = doc(database, COLLECTIONS.interviewBookings, `${slotId}_${studentUid}`);
  await runTransaction(database, async (tx) => {
    const snap = await tx.get(slotRef);
    if (!snap.exists()) return;
    const slot = snap.data() as InterviewSlot;
    const booked = slot.bookedStudents ?? [];
    if (!booked.some((b) => b.studentUid === studentUid)) return;
    tx.update(slotRef, {
      bookedStudents: booked.filter((b) => b.studentUid !== studentUid),
      updatedAt: serverTimestamp(),
    });
    tx.delete(bookingRef);
  });
}

/** Every booking across all companies. Admin view; staff-only by rules. */
export function subscribeAllInterviewBookings(onData: (rows: InterviewBooking[]) => void) {
  return onSnapshot(collection(requireDb(), COLLECTIONS.interviewBookings), (snap) => {
    const rows = snap.docs.map((d) => d.data() as InterviewBooking);
    rows.sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
    onData(rows);
  });
}

/** Contact details for the bookings on a company's slots. Staff-only by rules. */
export function subscribeInterviewBookings(companyName: string, onData: (rows: InterviewBooking[]) => void) {
  const q = query(collection(requireDb(), COLLECTIONS.interviewBookings), where("companyName", "==", companyName));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data() as InterviewBooking)));
}

/** Slots the student holds a seat in, used to block double-booking across companies. */
export function subscribeMyInterviewBookings(studentUid: string, onData: (slots: InterviewSlot[]) => void) {
  return onSnapshot(collection(requireDb(), COLLECTIONS.interviewSlots), (snap) => {
    const mine = snap.docs
      .map((d) => d.data() as InterviewSlot)
      .filter((s) => (s.bookedStudents ?? []).some((b) => b.studentUid === studentUid));
    onData(mine);
  });
}

/** All open interview slots, or just one company's. Sorted by date then start time. */
export function subscribeInterviewSlots(onData: (slots: InterviewSlot[]) => void, companyName?: string) {
  const col = collection(requireDb(), COLLECTIONS.interviewSlots);
  const q = companyName ? query(col, where("companyName", "==", companyName)) : col;
  return onSnapshot(q, (snap) => {
    const slots = snap.docs.map((d) => d.data() as InterviewSlot);
    slots.sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
    onData(slots);
  });
}
