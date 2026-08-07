import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { dataLayerSource } from "./helpers/data-layer.mjs";

test("interview booking components and firestore helpers exist", async () => {
  const firestoreCode = await dataLayerSource();
  assert.match(firestoreCode, /bookInterviewSlot/);
  assert.match(firestoreCode, /cancelInterviewBooking/);
  assert.match(firestoreCode, /saveInterviewSlot/);
  assert.match(firestoreCode, /subscribeInterviewSlots/);

  const modalCode = await readFile(new URL("../features/student/InterviewBookingModal.tsx", import.meta.url), "utf8");
  assert.match(modalCode, /Book a mock interview/);
  assert.match(modalCode, /bookInterviewSlot/);

  const managerCode = await readFile(new URL("../features/admin/MockInterviews.tsx", import.meta.url), "utf8");
  assert.match(managerCode, /Add a mock interview session/);
  assert.match(managerCode, /Manage mock interview sessions/);
});

// A 09:30 and a 09:31 slot both used to be accepted because only the generated
// document id was compared, and the id is keyed on the start time alone.
test("an employer cannot open two overlapping slots on the same day", async () => {
  const code = await readFile(new URL("../features/admin/MockInterviews.tsx", import.meta.url), "utf8");
  assert.match(code, /function overlaps/);
  assert.match(code, /slot\.date === date && overlaps\(slot, \{ startTime, endTime \}\)/);
  assert.match(code, /end time must be after the start time/);
});

test("employers can see who booked them on their summary", async () => {
  const summary = await readFile(new URL("../features/admin/EmployerSummary.tsx", import.meta.url), "utf8");
  assert.match(summary, /subscribeInterviewBookings/);
  assert.match(summary, /Who booked you/);
});

test("students choose interview or consultancy, and only when both are offered", async () => {
  const modal = await readFile(new URL("../features/student/InterviewBookingModal.tsx", import.meta.url), "utf8");
  assert.match(modal, /Book a mock interview or consultancy/);
  // Asking when the employer offers only one kind would be pure friction.
  assert.match(modal, /slot\.offers === "both"/);
  assert.match(modal, /sessionType/);

  const manager = await readFile(new URL("../features/admin/MockInterviews.tsx", import.meta.url), "utf8");
  assert.match(manager, /Interview or consultancy — student chooses/);
  assert.match(manager, /export function offerLabel/);
});

// An interviewer should be able to read the candidate's CV before the session.
test("the employer booking list surfaces each student's resume", async () => {
  const manager = await readFile(new URL("../features/admin/MockInterviews.tsx", import.meta.url), "utf8");
  assert.match(manager, /subscribeResumes/);
  assert.match(manager, /resumeByUid/);
  assert.match(manager, /No resume submitted/);
});

test("students see and can withdraw their bookings; admins see all of them", async () => {
  const history = await readFile(new URL("../features/student/StudentHistory.tsx", import.meta.url), "utf8");
  assert.match(history, /subscribeMyInterviewBookings/);
  assert.match(history, /cancelInterviewBooking/);
  assert.match(history, /Withdraw/);

  const activity = await readFile(new URL("../features/admin/StudentActivity.tsx", import.meta.url), "utf8");
  assert.match(activity, /subscribeAllInterviewBookings/);
  assert.match(activity, /Mock interviews &amp; consultancies/);
  assert.match(activity, /exportBookings/);
});
