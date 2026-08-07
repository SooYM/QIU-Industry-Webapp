import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const form = await readFile(new URL("../features/events/EventForm.tsx", import.meta.url), "utf8");
const presenter = await readFile(new URL("../features/events/EventPresenter.tsx", import.meta.url), "utf8");
const eventsView = await readFile(new URL("../features/events/EventsView.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("event form keeps Other in the configured list and rejects invalid time ranges", () => {
  assert.match(form, /specializationOptions\.length \? specializationOptions : \[\.\.\.PREDEFINED_SPECS, "Other"\]/);
  assert.match(form, /\{availableSpecializations\.map/);
  assert.match(form, /min=\{draft\.startAt \|\| undefined\}/);
  assert.match(form, /End time must be after start time/);
  assert.match(form, /specializationOptions=|specializationOptions:/);
});

test("QR rotation supports static codes and publishes a one-interval previous-code buffer", () => {
  assert.match(form, /Set 0 for a static QR that does not rotate/);
  assert.match(form, /qrRotateSeconds: rotateSeconds/);
  assert.match(presenter, /const isStatic = rotateSeconds === 0/);
  assert.match(presenter, /codeExpiry = isStatic \? 8\.64e15 : now \+ refreshMs \* 2/);
  assert.match(presenter, /previousCodeExpiry: previousCode \? now \+ refreshMs : 0/);
  assert.match(presenter, /Previous QR remains valid for \{rotateSeconds\}s after rotation/);
});

test("events are split into live, upcoming and past sections with past actions restricted", () => {
  assert.match(eventsView, /title: "Live events"/);
  assert.match(eventsView, /title: "Upcoming events"/);
  assert.match(eventsView, /title: "Past events"/);
  assert.match(eventsView, /const canPresent = st !== "ended"/);
  assert.match(eventsView, /canManageEvents && st !== "ended" && <button className="edit-local"/);
  assert.match(eventsView, /canManageEvents && <button className="delete-local"/);
  assert.doesNotMatch(eventsView, /canManageEvents && st !== "ended" && <button className="delete-local"/);
  assert.match(eventsView, /canManageEvents && <button className="edit-local" onClick=\{\(\) => setViewing\(ev\)\}>Attendance/);
});

test("only live course-matched student events receive the recommendation outline", () => {
  assert.match(eventsView, /const matchesCourse = isStudent && eventMatchesCourse\(ev, course\);/);
  assert.match(eventsView, /const isRelevantLive = st === "live" && matchesCourse;/);
  assert.match(eventsView, /className=\{`event-card\$\{isRelevantLive \? " is-recommended" : ""\}`\}/);
  assert.match(eventsView, /\{matchesCourse && <span[^>]*>🌟 Relevant to you<\/span>\}/);
  assert.match(styles, /\.job-card\.is-recommended,\.event-card\.is-recommended\s*\{[^}]*border-color:var\(--success\)/s);
});
