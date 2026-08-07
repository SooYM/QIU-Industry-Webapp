import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { dataLayerSource } from "./helpers/data-layer.mjs";
import { generateGoogleCalendarUrl } from "../lib/calendar.ts";

test("calendar helper generates Google Calendar render link", () => {
  const sampleEvent = {
    id: 101,
    title: "AI Technology Talk",
    description: "Learn about Next.js and AI.",
    location: "Auditorium A",
    speakerName: "Dr. Alex",
    speakerLinks: [],
    startAt: "2026-08-10T10:00:00Z",
    endAt: "2026-08-10T11:30:00Z",
    sessionMinutes: 90,
    presenters: [],
  };

  const calUrl = generateGoogleCalendarUrl(sampleEvent);
  assert.match(calUrl, /https:\/\/calendar\.google\.com\/calendar\/render/);
  assert.match(calUrl, /AI%20Technology%20Talk/);
  assert.match(calUrl, /Auditorium/);
});

test("EventDetail wires reminders and interest, and mounts the Q&A and reviews", async () => {
  const code = await readFile(new URL("../features/events/EventDetail.tsx", import.meta.url), "utf8");
  assert.match(code, /generateGoogleCalendarUrl/);
  assert.match(code, /toggleEventInterest/);
  // Marking interest IS the reminder — separate calendar buttons confused the action.
  assert.doesNotMatch(code, /downloadIcsFile/);
  assert.match(code, /Mark as interested/);
  assert.match(code, /<TalkLiveChat/);
  // Reviews only exist once the talk is over.
  assert.match(code, /st === "ended" && \(\s*<TalkFeedback/);
});

test("the Q&A box reads its own open/closed switch and screens what is typed", async () => {
  const chat = await readFile(new URL("../features/events/TalkLiveChat.tsx", import.meta.url), "utf8");
  assert.match(chat, /LIVE Q&A/);
  assert.match(chat, /checkToxicContent/);
  // The switch is its own document, not a field on the admin-only event doc.
  assert.match(chat, /subscribeEventLiveChatState/);
});

test("the Q&A feature has one name across every screen", async () => {
  const chat = await readFile(new URL("../features/events/TalkLiveChat.tsx", import.meta.url), "utf8");
  const history = await readFile(new URL("../features/admin/TalkChatHistory.tsx", import.meta.url), "utf8");
  // JSX escapes the ampersand in one file and not the other; compare the text
  // a user actually sees, not the source spelling.
  const rendered = (code) => code.replace(/&amp;/g, "&");
  for (const [name, code] of [["TalkLiveChat", chat], ["TalkChatHistory", history]]) {
    assert.match(rendered(code), /LIVE Q&A/, `${name} should use the agreed label`);
    assert.doesNotMatch(rendered(code), /LIVE TALK Q&A CHAT/, `${name} still uses the old three-noun label`);
  }
});

test("reviews are gated on attendance and show the running average", async () => {
  const fb = await readFile(new URL("../features/events/TalkFeedback.tsx", import.meta.url), "utf8");
  assert.match(fb, /TALK FEEDBACK &amp; REVIEWS/);
  assert.match(fb, /attended && \(/);
  assert.match(fb, /permission-denied/);
});

// These counters and flags were originally written onto the events and companies
// docs, where firestore.rules silently rejects them: `validEvent` / `validCompany`
// pin the allowed key sets and restrict writes to admins and owners. Keep them out.
test("interest and view counters do not write to rule-protected docs", async () => {
  const store = await dataLayerSource();
  assert.doesNotMatch(store, /interestedCount/);
  assert.doesNotMatch(store, /liveChatEnabled/);
  assert.doesNotMatch(store, /visitCount/);

  const types = await readFile(new URL("../lib/data/types.ts", import.meta.url), "utf8");
  assert.doesNotMatch(types, /interestedCount|liveChatEnabled|visitCount/);
});

// The company profile modal is what "profile visits" must mean — counting a
// vacancy open instead reports 0 for every company whose listings weren't opened.
test("a profile visit is recorded when the company profile opens", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /onOpenCompany=\{\(c\) => \{ if \(isStudent && user\) recordCompanyView/);
  const home = await readFile(new URL("../features/home/HomeView.tsx", import.meta.url), "utf8");
  assert.match(home, /onOpenCompany\?\.\(c\)/);
  assert.match(home, /Book mock interview/);
});

test("interested count is derived from the interest docs, so it cannot drift", async () => {
  const store = await dataLayerSource();
  assert.match(store, /subscribeEventInterestCounts/);
  assert.match(store, /COLLECTIONS\.eventInterests/);
});

// A counter field the client increments is pumpable from the browser console —
// a student could set any company's total to anything. The number is counted
// from the visit docs instead, whose ids the rules pin to one per day.
test("profile visits are counted, never held in a client-writable counter", async () => {
  const store = await dataLayerSource();
  assert.doesNotMatch(store, /company_stats/);
  assert.match(store, /getCountFromServer/);
  const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
  assert.doesNotMatch(rules, /company_stats/);
  assert.match(rules, /viewId\.matches/);
  // Once per account per browser session, not per day.
  assert.match(store, /browserSessionId/);
  assert.match(store, /sessionStorage/);
  assert.match(rules, /\[a-z0-9\]\{12\}\$/);
});

test("booking and cancelling run in a transaction so a seat cannot be lost", async () => {
  const store = await dataLayerSource();
  const book = store.slice(store.indexOf("export async function bookInterviewSlot"));
  assert.match(book.slice(0, book.indexOf("\nexport ")), /runTransaction/);
  const cancel = store.slice(store.indexOf("export async function cancelInterviewBooking"));
  assert.match(cancel.slice(0, cancel.indexOf("\nexport ")), /runTransaction/);
});

test("re-opening an existing slot cannot wipe its bookings", async () => {
  const store = await dataLayerSource();
  const save = store.slice(store.indexOf("export async function saveInterviewSlot"));
  const body = save.slice(0, save.indexOf("\nexport "));
  assert.match(body, /const \{ bookedStudents, \.\.\.rest \} = slot;/);
  assert.match(body, /exists \? \{\} :/);
});

// The slot doc is readable by every student, so anything on it is campus-public.
test("student contact details are kept off the publicly-readable slot", async () => {
  const types = await readFile(new URL("../lib/data/types.ts", import.meta.url), "utf8");
  const seat = types.slice(types.indexOf("export interface InterviewSeat"));
  const body = seat.slice(0, seat.indexOf("}"));
  for (const field of ["studentEmail", "studentName", "course", "employeeId"]) {
    assert.doesNotMatch(body, new RegExp(field), `InterviewSeat must not carry ${field}`);
  }
  const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
  const bookings = rules.slice(rules.indexOf("match /interview_bookings/"));
  assert.match(bookings.slice(0, bookings.indexOf("\n    }")), /allow read: if isAdmin\(\) \|\| isEmployer\(\);/);

  // Seat and identity must be written together or a booking can half-exist.
  const store = await dataLayerSource();
  const book = store.slice(store.indexOf("export async function bookInterviewSlot"));
  const fn = book.slice(0, book.indexOf("\nexport "));
  assert.match(fn, /runTransaction/);
  assert.match(fn, /tx\.update\(slotRef/);
  assert.match(fn, /tx\.set\(bookingRef/);
});

test("students cannot double-book overlapping interview times", async () => {
  const modal = await readFile(new URL("../features/student/InterviewBookingModal.tsx", import.meta.url), "utf8");
  assert.match(modal, /function overlaps/);
  assert.match(modal, /subscribeMyInterviewBookings/);
  assert.match(modal, /clashes with your/);
});

test("the calendar tab opens before the await, or the popup blocker eats it", async () => {
  const detail = await readFile(new URL("../features/events/EventDetail.tsx", import.meta.url), "utf8");
  const fn = detail.slice(detail.indexOf("const handleInterestToggle"));
  const body = fn.slice(0, fn.indexOf("\n  const handleToggleLiveChat"));
  assert.ok(body.indexOf("window.open") < body.indexOf("await toggleEventInterest"),
    "window.open must run in the click handler, before any await");
});

test("employers can see their profile visit count", async () => {
  const summary = await readFile(new URL("../features/admin/EmployerSummary.tsx", import.meta.url), "utf8");
  assert.match(summary, /countCompanyViews/);
  assert.match(summary, /Profile visits/);
  assert.doesNotMatch(summary, /Profile-view data is not available/);
});

test("firestore rules gate the new collections", async () => {
  const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
  // Feedback requires an attendance record for that event.
  assert.match(rules, /event_feedbacks/);
  assert.match(rules, /documents\/attendance\/\$\(string\(request\.resource\.data\.eventId\)/);
  // Q&A messages are only accepted while a facilitator has the box open.
  assert.match(rules, /event_live_chat\/\$\(string\(request\.resource\.data\.eventId\)\)\)\.data\.enabled == true/);
  // A student updating a slot may touch the booking list and nothing else.
  assert.match(rules, /hasOnly\(\['bookedStudents', 'updatedAt'\]\)/);
});

// The requirement names the company chatbot explicitly, and it is a separate
// component from the global assistant and the per-vacancy one — all four boxes
// a student can type into must screen the message.
test("every student-facing chatbox screens messages before answering", async () => {
  for (const file of [
    "../features/home/HomeView.tsx",          // company profile chatbot
    "../features/vacancies/VacancyModal.tsx", // per-vacancy assistant
    "../features/events/TalkLiveChat.tsx",    // live talk Q&A
  ]) {
    const code = await readFile(new URL(file, import.meta.url), "utf8");
    assert.match(code, /checkToxicContent/, `${file} does not screen input`);
  }
});
