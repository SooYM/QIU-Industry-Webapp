import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, afterEach } from "node:test";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const projectId = "demo-vacancyportal";
const testEnv = await initializeTestEnvironment({
  projectId,
  firestore: { rules: await readFile("firestore.rules", "utf8") },
});

const qiuAuth = (email) => ({
  email,
  email_verified: true,
  firebase: { sign_in_provider: "google.com" },
});

function profile(email, role) {
  return {
    email,
    displayName: "Test User",
    photoURL: "",
    role,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function vacancy(createdBy) {
  return {
    id: 1001,
    title: "Software Developer",
    company: "QIU Test",
    type: "Permanent",
    specialization: "IT - Software",
    vacancies: 1,
    location: "Perak",
    salaryLabel: "MYR3500",
    salary: 3500,
    payFrequency: "Monthly",
    minimumRequirement: "Degree",
    detailsLink: "",
    email: "",
    companySummary: "",
    companySources: [],
    isCustom: true,
    locationMode: "malaysia",
    state: "Perak",
    country: "",
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function application(overrides = {}) {
  return {
    id: "app-1",
    studentUid: "student-1",
    studentEmail: "student@qiu.edu.my",
    studentName: "Student One",
    jobId: 1001,
    jobTitle: "Software Developer",
    company: "QIU Test",
    appliedAt: serverTimestamp(),
    ...overrides,
  };
}

function resume(uid, overrides = {}) {
  return {
    id: uid,
    studentUid: uid,
    studentEmail: "student@qiu.edu.my",
    studentName: "Student One",
    source: "generated",
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

function chatLog(overrides = {}) {
  return {
    id: "chat-1",
    studentUid: "student-1",
    studentEmail: "student@qiu.edu.my",
    studentName: "Student One",
    company: "QIU Test",
    question: "What roles are open?",
    answer: "Several software roles.",
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

/** Seed user role docs (and whitelist for non-QIU emails) bypassing rules. */
async function seedUsers(rows) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    for (const [uid, email, role] of rows) {
      await setDoc(doc(context.firestore(), "users", uid), {
        email,
        role,
        updatedAt: new Date(),
      });
      if (!email.endsWith("@qiu.edu.my")) {
        await setDoc(doc(context.firestore(), "whitelisted_emails", email.toLowerCase()), {
          addedAt: new Date(),
        });
      }
    }
  });
}

afterEach(() => testEnv.clearFirestore());
after(() => testEnv.cleanup());

test("only verified qiu.edu.my accounts can read vacancies", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "vacancies", "seed"), vacancy("seed-owner"));
  });

  const qiu = testEnv.authenticatedContext("qiu-user", qiuAuth("student@qiu.edu.my"));
  const outsider = testEnv.authenticatedContext("outsider", qiuAuth("user@gmail.com"));
  const unverified = testEnv.authenticatedContext("unverified", {
    ...qiuAuth("student@qiu.edu.my"),
    email_verified: false,
  });
  const passwordUser = testEnv.authenticatedContext("password-user", {
    ...qiuAuth("student@qiu.edu.my"),
    firebase: { sign_in_provider: "password" },
  });

  await assertSucceeds(getDoc(doc(qiu.firestore(), "vacancies", "seed")));
  await assertFails(getDoc(doc(outsider.firestore(), "vacancies", "seed")));
  await assertFails(getDoc(doc(unverified.firestore(), "vacancies", "seed")));
  await assertFails(getDoc(doc(passwordUser.firestore(), "vacancies", "seed")));
});

test("inactive external whitelist entries lose access and cannot enumerate accounts", async () => {
  await seedUsers([["employer-1", "hr@acme.com", "employer"]]);
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "vacancies", "seed"), vacancy("hr@acme.com"));
    await updateDoc(doc(context.firestore(), "whitelisted_emails", "hr@acme.com"), { active: false });
    await setDoc(doc(context.firestore(), "whitelisted_emails", "other@example.com"), { active: true });
  });
  const revoked = testEnv.authenticatedContext("employer-1", qiuAuth("hr@acme.com"));
  await assertFails(getDoc(doc(revoked.firestore(), "vacancies", "seed")));
  await assertSucceeds(getDoc(doc(revoked.firestore(), "whitelisted_emails", "hr@acme.com")));
  await assertFails(getDocs(collection(revoked.firestore(), "whitelisted_emails")));
});

test("only admins can create immutable approval mail records", async () => {
  await seedUsers([["admin-1", "admin@qiu.edu.my", "admin"]]);
  const admin = testEnv.authenticatedContext("admin-1", qiuAuth("admin@qiu.edu.my"));
  const user = testEnv.authenticatedContext("user-1", qiuAuth("user@qiu.edu.my"));
  const message = {
    to: "hr@acme.com",
    message: { subject: "Registration approved", text: "Your company is approved." },
    createdAt: serverTimestamp(),
  };
  await assertSucceeds(setDoc(doc(admin.firestore(), "mail", "approval-1"), message));
  await assertFails(setDoc(doc(user.firestore(), "mail", "approval-2"), message));
  await assertFails(updateDoc(doc(admin.firestore(), "mail", "approval-1"), { message: { subject: "Changed", text: "Changed" } }));
});

test("users can bootstrap a user profile but cannot elevate their own role", async () => {
  const user = testEnv.authenticatedContext("user-1", qiuAuth("user@qiu.edu.my"));
  const profileRef = doc(user.firestore(), "users", "user-1");

  await assertSucceeds(setDoc(profileRef, profile("user@qiu.edu.my", "user")));
  // Self-elevation to admin/employer is rejected.
  await assertFails(updateDoc(profileRef, { role: "admin", updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(profileRef, { role: "employer", updatedAt: serverTimestamp() }));
  // Normal sign-in merge (displayName/photoURL/updatedAt, role unchanged) still succeeds.
  await assertSucceeds(updateDoc(profileRef, {
    displayName: "Updated Name",
    photoURL: "https://example.com/a.png",
    updatedAt: serverTimestamp(),
  }));
  assert.equal((await getDoc(profileRef)).data().role, "user");
});

test("superadmin can assign roles but cannot be demoted or duplicated", async () => {
  const superadmin = testEnv.authenticatedContext("super-1", qiuAuth("ai@qiu.edu.my"));
  const superRef = doc(superadmin.firestore(), "users", "super-1");
  const userRef = doc(superadmin.firestore(), "users", "user-2");

  await assertSucceeds(setDoc(superRef, profile("ai@qiu.edu.my", "superadmin")));
  await assertSucceeds(setDoc(userRef, profile("user2@qiu.edu.my", "user")));
  await assertSucceeds(updateDoc(userRef, { role: "admin", updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(superRef, { role: "user", updatedAt: serverTimestamp() }));
  await assertFails(deleteDoc(superRef));
  await assertFails(setDoc(doc(superadmin.firestore(), "users", "fake-super"), profile("ai@qiu.edu.my", "superadmin")));
  await assertSucceeds(getDocs(collection(superadmin.firestore(), "users")));
});

test("only admins and superadmin can create, edit, or delete vacancies", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "users", "admin-1"), {
      email: "admin@qiu.edu.my",
      role: "admin",
      updatedAt: new Date(),
    });
  });

  const user = testEnv.authenticatedContext("user-1", qiuAuth("user@qiu.edu.my"));
  const admin = testEnv.authenticatedContext("admin-1", qiuAuth("admin@qiu.edu.my"));
  const deniedRef = doc(user.firestore(), "vacancies", "denied");
  const vacancyRef = doc(admin.firestore(), "vacancies", "allowed");

  await assertFails(setDoc(deniedRef, vacancy("user-1")));
  await assertSucceeds(setDoc(vacancyRef, vacancy("admin-1")));
  await assertSucceeds(updateDoc(vacancyRef, {
    title: "Senior Software Developer",
    updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(vacancyRef, {
    createdBy: "forged-owner",
    updatedAt: serverTimestamp(),
  }));
  await assertSucceeds(deleteDoc(vacancyRef));
});

test("employer may only self-submit a 'pending' listing, never 'approved'", async () => {
  await seedUsers([["employer-1", "hr@acme.com", "employer"]]);
  const employer = testEnv.authenticatedContext("employer-1", qiuAuth("hr@acme.com"));

  const pendingRef = doc(employer.firestore(), "vacancies", "emp-pending");
  const approvedRef = doc(employer.firestore(), "vacancies", "emp-approved");

  await assertSucceeds(setDoc(pendingRef, { ...vacancy("employer-1"), status: "pending" }));
  await assertFails(setDoc(approvedRef, { ...vacancy("employer-1"), status: "approved" }));
});

test("employer cannot self-approve, but can stage a pending_edit; admin can approve", async () => {
  await seedUsers([
    ["employer-1", "hr@acme.com", "employer"],
    ["admin-1", "admin@qiu.edu.my", "admin"],
  ]);
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "vacancies", "job-1"), {
      ...vacancy("employer-1"),
      status: "approved",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  const employer = testEnv.authenticatedContext("employer-1", qiuAuth("hr@acme.com"));
  const admin = testEnv.authenticatedContext("admin-1", qiuAuth("admin@qiu.edu.my"));

  // Employer forcing 'approved' on their own job is rejected.
  await assertFails(updateDoc(doc(employer.firestore(), "vacancies", "job-1"), {
    status: "approved",
    updatedAt: serverTimestamp(),
  }));
  // Employer staging an edit is allowed.
  await assertSucceeds(updateDoc(doc(employer.firestore(), "vacancies", "job-1"), {
    status: "pending_edit",
    pendingEdit: { title: "Senior Software Developer" },
    updatedAt: serverTimestamp(),
  }));
  // Admin approving is allowed.
  await assertSucceeds(updateDoc(doc(admin.firestore(), "vacancies", "job-1"), {
    status: "approved",
    pendingEdit: null,
    updatedAt: serverTimestamp(),
  }));
});

test("applications: students write/read only their own; employers and admins can read", async () => {
  await seedUsers([
    ["employer-1", "hr@acme.com", "employer"],
    ["admin-1", "admin@qiu.edu.my", "admin"],
  ]);
  const student = testEnv.authenticatedContext("student-1", qiuAuth("student@qiu.edu.my"));
  const other = testEnv.authenticatedContext("student-2", qiuAuth("other@qiu.edu.my"));
  const employer = testEnv.authenticatedContext("employer-1", qiuAuth("hr@acme.com"));
  const admin = testEnv.authenticatedContext("admin-1", qiuAuth("admin@qiu.edu.my"));

  const ownRef = doc(student.firestore(), "applications", "app-1");
  await assertSucceeds(setDoc(ownRef, application()));
  // Forging someone else's studentUid is denied.
  await assertFails(setDoc(doc(other.firestore(), "applications", "app-2"),
    application({ id: "app-2", studentUid: "student-1" })));

  await assertSucceeds(getDoc(doc(student.firestore(), "applications", "app-1")));
  await assertFails(getDoc(doc(other.firestore(), "applications", "app-1")));
  await assertSucceeds(getDoc(doc(employer.firestore(), "applications", "app-1")));
  await assertSucceeds(getDoc(doc(admin.firestore(), "applications", "app-1")));
});

test("view_events: private to owner and admins", async () => {
  await seedUsers([["admin-1", "admin@qiu.edu.my", "admin"]]);
  const student = testEnv.authenticatedContext("student-1", qiuAuth("student@qiu.edu.my"));
  const other = testEnv.authenticatedContext("student-2", qiuAuth("other@qiu.edu.my"));
  const admin = testEnv.authenticatedContext("admin-1", qiuAuth("admin@qiu.edu.my"));

  const view = { id: "v-1", studentUid: "student-1", jobId: 1001, jobTitle: "Dev", company: "QIU Test", viewedAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(student.firestore(), "view_events", "v-1"), view));
  await assertFails(setDoc(doc(other.firestore(), "view_events", "v-2"), { ...view, id: "v-2", studentUid: "student-1" }));

  await assertSucceeds(getDoc(doc(student.firestore(), "view_events", "v-1")));
  await assertFails(getDoc(doc(other.firestore(), "view_events", "v-1")));
  await assertSucceeds(getDoc(doc(admin.firestore(), "view_events", "v-1")));
});

test("resumes: owner writes; owner, employers, and admins read; outsiders cannot", async () => {
  await seedUsers([
    ["employer-1", "hr@acme.com", "employer"],
    ["admin-1", "admin@qiu.edu.my", "admin"],
  ]);
  const student = testEnv.authenticatedContext("student-1", qiuAuth("student@qiu.edu.my"));
  const other = testEnv.authenticatedContext("student-2", qiuAuth("other@qiu.edu.my"));
  const employer = testEnv.authenticatedContext("employer-1", qiuAuth("hr@acme.com"));
  const admin = testEnv.authenticatedContext("admin-1", qiuAuth("admin@qiu.edu.my"));

  await assertSucceeds(setDoc(doc(student.firestore(), "resumes", "student-1"), resume("student-1")));
  // Cannot write to a resume doc keyed to another uid.
  await assertFails(setDoc(doc(other.firestore(), "resumes", "student-1"), resume("student-1")));

  await assertSucceeds(getDoc(doc(student.firestore(), "resumes", "student-1")));
  await assertSucceeds(getDoc(doc(employer.firestore(), "resumes", "student-1")));
  await assertSucceeds(getDoc(doc(admin.firestore(), "resumes", "student-1")));
  await assertFails(getDoc(doc(other.firestore(), "resumes", "student-1")));
});

test("chat_logs: students append their own; admins and employers read; no student read", async () => {
  await seedUsers([
    ["employer-1", "hr@acme.com", "employer"],
    ["admin-1", "admin@qiu.edu.my", "admin"],
  ]);
  const student = testEnv.authenticatedContext("student-1", qiuAuth("student@qiu.edu.my"));
  const other = testEnv.authenticatedContext("student-2", qiuAuth("other@qiu.edu.my"));
  const employer = testEnv.authenticatedContext("employer-1", qiuAuth("hr@acme.com"));
  const admin = testEnv.authenticatedContext("admin-1", qiuAuth("admin@qiu.edu.my"));

  await assertSucceeds(setDoc(doc(student.firestore(), "chat_logs", "chat-1"), chatLog()));
  // Forging another student's uid is denied.
  await assertFails(setDoc(doc(other.firestore(), "chat_logs", "chat-2"), chatLog({ id: "chat-2", studentUid: "student-1" })));

  await assertSucceeds(getDoc(doc(admin.firestore(), "chat_logs", "chat-1")));
  await assertSucceeds(getDoc(doc(employer.firestore(), "chat_logs", "chat-1")));
  await assertFails(getDoc(doc(student.firestore(), "chat_logs", "chat-1")));
});

test("attendance accepts the previous rotating QR only during its grace interval", async () => {
  const student = testEnv.authenticatedContext("student-1", qiuAuth("student@qiu.edu.my"));
  const other = testEnv.authenticatedContext("student-2", qiuAuth("other@qiu.edu.my"));
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "event_codes", "42"), {
      activeStep: "checkin",
      activeCode: "current-code",
      codeExpiry: Date.now() + 60_000,
      previousCode: "previous-code",
      previousCodeExpiry: Date.now() + 30_000,
    });
  });
  const attendance = {
    id: "42_student-1", eventId: 42, eventTitle: "Industry Talk",
    studentUid: "student-1", studentEmail: "student@qiu.edu.my", studentName: "Student One",
    code: "previous-code", step: "checkin", checkInMs: Date.now(), checkInAt: serverTimestamp(),
  };
  await assertSucceeds(setDoc(doc(student.firestore(), "attendance", attendance.id), attendance));

  await testEnv.withSecurityRulesDisabled(async (context) => {
    await updateDoc(doc(context.firestore(), "event_codes", "42"), { previousCodeExpiry: 0 });
  });
  await assertFails(setDoc(doc(other.firestore(), "attendance", "42_student-2"), {
    ...attendance, id: "42_student-2", studentUid: "student-2",
  }));
});

test("admin settings allow static QR and configurable event specializations", async () => {
  await seedUsers([["admin-1", "admin@qiu.edu.my", "admin"]]);
  const admin = testEnv.authenticatedContext("admin-1", qiuAuth("admin@qiu.edu.my"));
  await assertSucceeds(setDoc(doc(admin.firestore(), "app_settings", "app"), {
    portalTitle: "Industry Day",
    qrRotateSeconds: 0,
    ccaPercent: 80,
    eventSpecializations: ["Software Engineering", "Other"],
    tabs: { events: true },
    updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(admin.firestore(), "app_settings", "app"), {
    qrRotateSeconds: 1,
    updatedAt: serverTimestamp(),
  }));
});

// Company reps whose employer runs its own mail server have no Google account,
// so they register with email + password. Students must NOT be able to: a qiu.edu.my
// address arriving through the link provider would be indistinguishable from a
// real student, and the superadmin address is a qiu.edu.my one.
test("email+password sign-in works for whitelisted companies but can never impersonate QIU", async () => {
  const passwordAuth = (email) => ({
    email,
    email_verified: true,
    firebase: { sign_in_provider: "password" },
  });

  await seedUsers([["employer-1", "hr@acme.com", "employer"]]);
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "vacancies", "1001"), vacancy("admin@qiu.edu.my"));
  });

  // A whitelisted company rep signed in by link gets normal employer access.
  const linkEmployer = testEnv.authenticatedContext("employer-1", passwordAuth("hr@acme.com"));
  await assertSucceeds(getDoc(doc(linkEmployer.firestore(), "vacancies", "1001")));

  // The same provider with a QIU address gets nothing — it is not a QIU user.
  const fakeStudent = testEnv.authenticatedContext("fake-1", passwordAuth("student@qiu.edu.my"));
  await assertFails(getDoc(doc(fakeStudent.firestore(), "vacancies", "1001")));

  // And it cannot claim the superadmin identity.
  const fakeSuper = testEnv.authenticatedContext("fake-2", passwordAuth("ai@qiu.edu.my"));
  await assertFails(setDoc(doc(fakeSuper.firestore(), "users", "fake-2"), profile("ai@qiu.edu.my", "superadmin")));

  // Verification is NOT required — Firebase's mail does not reach several company
  // providers. Admin approval (the whitelist) is the gate instead, so an
  // unverified but whitelisted rep works…
  const unverified = testEnv.authenticatedContext("employer-1", {
    email: "hr@acme.com", email_verified: false, firebase: { sign_in_provider: "password" },
  });
  await assertSucceeds(getDoc(doc(unverified.firestore(), "vacancies", "1001")));

  // …while an unapproved address still gets nothing, verified or not.
  const stranger = testEnv.authenticatedContext("stranger-1", passwordAuth("someone@elsewhere.com"));
  await assertFails(getDoc(doc(stranger.firestore(), "vacancies", "1001")));
});

// A crafted client could previously bootstrap its own user document with
// role:"admin" — create accepted any role. Only an admin may mint one.
test("a user cannot create itself with a privileged role", async () => {
  await seedUsers([["admin-1", "admin@qiu.edu.my", "admin"]]);
  const user = testEnv.authenticatedContext("user-9", qiuAuth("user9@qiu.edu.my"));
  await assertFails(setDoc(doc(user.firestore(), "users", "user-9"), profile("user9@qiu.edu.my", "admin")));
  await assertFails(setDoc(doc(user.firestore(), "users", "user-9"), profile("user9@qiu.edu.my", "employer")));
  await assertSucceeds(setDoc(doc(user.firestore(), "users", "user-9"), profile("user9@qiu.edu.my", "user")));
  // …and cannot plant a document for somebody else's uid either.
  await assertFails(setDoc(doc(user.firestore(), "users", "someone-else"), profile("other@qiu.edu.my", "user")));
  // An admin still assigns roles normally.
  const admin = testEnv.authenticatedContext("admin-1", qiuAuth("admin@qiu.edu.my"));
  await assertSucceeds(setDoc(doc(admin.firestore(), "users", "user-8"), profile("user8@qiu.edu.my", "employer")));
});

// Regression: tightening the create rule to block self-assigned roles also blocked
// an approved employer's FIRST sign-in, which must create users/{uid} with the
// role the admin granted. The app surfaced that as "Your account could not be
// checked" and every approved rep was locked out the moment they were approved.
test("an approved employer can bootstrap their own user document on first sign-in", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "whitelisted_emails", "hr@acme.com"),
      { email: "hr@acme.com", role: "employer", company: "Acme", active: true });
    // A whitelist entry carrying no role at all must still work.
    await setDoc(doc(context.firestore(), "whitelisted_emails", "plain@acme.com"), { addedAt: new Date() });
  });

  const employer = testEnv.authenticatedContext("employer-new", qiuAuth("hr@acme.com"));
  await assertSucceeds(setDoc(doc(employer.firestore(), "users", "employer-new"), profile("hr@acme.com", "employer")));

  // …but not a role the admin never granted.
  const other = testEnv.authenticatedContext("employer-x", qiuAuth("plain@acme.com"));
  await assertFails(setDoc(doc(other.firestore(), "users", "employer-x"), profile("plain@acme.com", "employer")));
  await assertSucceeds(setDoc(doc(other.firestore(), "users", "employer-x"), profile("plain@acme.com", "user")));
});

test("catch-all denies unknown collections", async () => {
  const user = testEnv.authenticatedContext("user-1", qiuAuth("user@qiu.edu.my"));
  await assertFails(getDoc(doc(user.firestore(), "secret_stuff", "x")));
  await assertFails(setDoc(doc(user.firestore(), "secret_stuff", "x"), { any: "thing" }));
});

// ---- Industry Day engagement features --------------------------------------

/** Seed an event (and optionally an attendance record) with rules disabled. */
async function seedEvent(eventId, presenters = []) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "events", String(eventId)), {
      id: eventId,
      title: "AI in Industry",
      description: "",
      location: "Hall A",
      speakerName: "Dr Alex",
      speakerLinks: [],
      startAt: "2026-08-10T10:00",
      endAt: "2026-08-10T11:00",
      sessionMinutes: 60,
      presenters,
      createdBy: "admin@qiu.edu.my",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });
}

async function seedAttendance(eventId, uid) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "attendance", `${eventId}_${uid}`), {
      id: `${eventId}_${uid}`, eventId, studentUid: uid, step: "checkin",
    });
  });
}

test("event interest: one doc per student per event, and only the owner may remove it", async () => {
  await seedUsers([["student-1", "student@qiu.edu.my", "student"], ["student-2", "other@qiu.edu.my", "student"]]);
  const student = testEnv.authenticatedContext("student-1", qiuAuth("student@qiu.edu.my"));
  const other = testEnv.authenticatedContext("student-2", qiuAuth("other@qiu.edu.my"));

  const mine = { eventId: 7, studentUid: "student-1", studentEmail: "student@qiu.edu.my", studentName: "S" };
  await assertSucceeds(setDoc(doc(student.firestore(), "event_interests", "7_student-1"), mine));
  // A second doc for the same event would double-count this student.
  await assertFails(setDoc(doc(student.firestore(), "event_interests", "7_student-1-again"), mine));
  // Can't mark interest on someone else's behalf, or delete their mark.
  await assertFails(setDoc(doc(student.firestore(), "event_interests", "7_student-2"),
    { ...mine, studentUid: "student-2" }));
  await assertFails(deleteDoc(doc(other.firestore(), "event_interests", "7_student-1")));
  await assertSucceeds(deleteDoc(doc(student.firestore(), "event_interests", "7_student-1")));
});

test("live Q&A: only an admin or this event's presenter can open the box", async () => {
  await seedUsers([
    ["admin-1", "admin@qiu.edu.my", "admin"],
    ["pres-1", "speaker@qiu.edu.my", "student"],
    ["student-1", "student@qiu.edu.my", "student"],
  ]);
  await seedEvent(7, ["speaker@qiu.edu.my"]);
  await seedEvent(8, []);

  const admin = testEnv.authenticatedContext("admin-1", qiuAuth("admin@qiu.edu.my"));
  const presenter = testEnv.authenticatedContext("pres-1", qiuAuth("speaker@qiu.edu.my"));
  const student = testEnv.authenticatedContext("student-1", qiuAuth("student@qiu.edu.my"));

  await assertSucceeds(setDoc(doc(presenter.firestore(), "event_live_chat", "7"), { eventId: 7, enabled: true }));
  await assertSucceeds(setDoc(doc(admin.firestore(), "event_live_chat", "8"), { eventId: 8, enabled: true }));
  // A presenter for event 7 has no authority over event 8, and students have none at all.
  await assertFails(setDoc(doc(presenter.firestore(), "event_live_chat", "8"), { eventId: 8, enabled: false }));
  await assertFails(setDoc(doc(student.firestore(), "event_live_chat", "7"), { eventId: 7, enabled: false }));
});

test("live Q&A: messages are rejected while the box is closed", async () => {
  await seedUsers([["student-1", "student@qiu.edu.my", "student"]]);
  await seedEvent(7, []);
  const student = testEnv.authenticatedContext("student-1", qiuAuth("student@qiu.edu.my"));
  const message = {
    id: "m1", eventId: 7, studentUid: "student-1", studentName: "student@qiu.edu.my",
    studentEmail: "student@qiu.edu.my", message: "What stack do you use?",
    createdAt: serverTimestamp(),
  };

  await assertFails(setDoc(doc(student.firestore(), "talk_live_chats", "m1"), message));

  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "event_live_chat", "7"), { eventId: 7, enabled: true });
  });
  await assertSucceeds(setDoc(doc(student.firestore(), "talk_live_chats", "m1"), message));
  // Can't post under another student's name, and can't dump an essay.
  await assertFails(setDoc(doc(student.firestore(), "talk_live_chats", "m2"), { ...message, id: "m2", studentUid: "student-2" }));
  await assertFails(setDoc(doc(student.firestore(), "talk_live_chats", "m3"), { ...message, id: "m3", message: "x".repeat(501) }));
  // Posting under someone else's name would let a student impersonate a presenter.
  await assertFails(setDoc(doc(student.firestore(), "talk_live_chats", "m4"), { ...message, id: "m4", studentName: "Admin" }));
});

test("event feedback: only students who attended the talk may review it", async () => {
  await seedUsers([["student-1", "student@qiu.edu.my", "student"], ["student-2", "other@qiu.edu.my", "student"]]);
  await seedEvent(7, []);
  await seedAttendance(7, "student-1");

  const attendee = testEnv.authenticatedContext("student-1", qiuAuth("student@qiu.edu.my"));
  const absentee = testEnv.authenticatedContext("student-2", qiuAuth("other@qiu.edu.my"));
  const review = (uid, email) => ({
    id: `7_${uid}`, eventId: 7, eventTitle: "AI in Industry", studentUid: uid,
    studentEmail: email, studentName: "S", rating: 5, comment: "Great talk.",
    createdAt: serverTimestamp(),
  });

  await assertSucceeds(setDoc(doc(attendee.firestore(), "event_feedbacks", "7_student-1"), review("student-1", "student@qiu.edu.my")));
  await assertFails(setDoc(doc(absentee.firestore(), "event_feedbacks", "7_student-2"), review("student-2", "other@qiu.edu.my")));
  // Ratings stay on the 1-5 scale the UI shows.
  await assertFails(setDoc(doc(attendee.firestore(), "event_feedbacks", "7_student-1"),
    { ...review("student-1", "student@qiu.edu.my"), rating: 99 }));
});

test("interview slots: employers own them; students may only take or free a seat", async () => {
  await seedUsers([
    ["employer-1", "hr@acme.com", "employer"],
    ["student-1", "student@qiu.edu.my", "student"],
  ]);
  const employer = testEnv.authenticatedContext("employer-1", qiuAuth("hr@acme.com"));
  const student = testEnv.authenticatedContext("student-1", qiuAuth("student@qiu.edu.my"));
  const slot = {
    id: "acme_2026-08-10_1000", companyName: "Acme", date: "2026-08-10",
    startTime: "10:00", endTime: "10:30", location: "Booth 12",
    maxBookings: 1, bookedStudents: [], createdBy: "hr@acme.com",
  };

  await assertFails(setDoc(doc(student.firestore(), "interview_slots", slot.id), slot));
  await assertSucceeds(setDoc(doc(employer.firestore(), "interview_slots", slot.id), slot));

  // Seats carry uids only — the identity lives in /interview_bookings.
  const booking = [{ studentUid: "student-1" }];
  const otherBooking = [{ studentUid: "student-9" }];
  await assertSucceeds(updateDoc(doc(student.firestore(), "interview_slots", slot.id), {
    bookedStudents: booking, updatedAt: serverTimestamp(),
  }));
  // A student must not be able to widen capacity, move the slot, or delete it.
  await assertFails(updateDoc(doc(student.firestore(), "interview_slots", slot.id), { maxBookings: 50 }));
  await assertFails(updateDoc(doc(student.firestore(), "interview_slots", slot.id), { startTime: "09:00" }));
  await assertFails(deleteDoc(doc(student.firestore(), "interview_slots", slot.id)));
  // The slot is full; a second booking would oversubscribe it.
  await assertFails(updateDoc(doc(student.firestore(), "interview_slots", slot.id), {
    bookedStudents: [...booking, { studentUid: "student-2" }],
  }));
  // A student may only add or remove THEMSELF — not book on another's behalf...
  await assertFails(updateDoc(doc(student.firestore(), "interview_slots", slot.id), {
    bookedStudents: [...booking, ...otherBooking],
  }));
  // ...and not cancel someone else's seat.
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "interview_slots", slot.id), { ...slot, maxBookings: 5, bookedStudents: [...booking, ...otherBooking] });
  });
  await assertFails(updateDoc(doc(student.firestore(), "interview_slots", slot.id), { bookedStudents: booking }));
  // Freeing their own seat is still allowed.
  await assertSucceeds(updateDoc(doc(student.firestore(), "interview_slots", slot.id), { bookedStudents: otherBooking }));
});

test("interview bookings: contact details are staff-only and students cannot read them", async () => {
  await seedUsers([
    ["student-1", "student@qiu.edu.my", "student"],
    ["student-2", "other@qiu.edu.my", "student"],
    ["employer-1", "hr@acme.com", "employer"],
  ]);
  const student = testEnv.authenticatedContext("student-1", qiuAuth("student@qiu.edu.my"));
  const other = testEnv.authenticatedContext("student-2", qiuAuth("other@qiu.edu.my"));
  const employer = testEnv.authenticatedContext("employer-1", qiuAuth("hr@acme.com"));
  const slotId = "acme_2026-08-12_1000";
  const booking = {
    id: `${slotId}_student-1`, slotId, companyName: "Acme", date: "2026-08-12", startTime: "10:00",
    studentUid: "student-1", studentEmail: "student@qiu.edu.my", studentName: "S",
    course: "BCS", employeeId: "QIU123", bookedAt: Date.now(),
  };

  await assertSucceeds(setDoc(doc(student.firestore(), "interview_bookings", booking.id), booking));
  // This is the whole point of the split: another student cannot read the PII.
  await assertFails(getDoc(doc(other.firestore(), "interview_bookings", booking.id)));
  await assertFails(getDoc(doc(student.firestore(), "interview_bookings", booking.id)));
  await assertSucceeds(getDoc(doc(employer.firestore(), "interview_bookings", booking.id)));
  // The id is pinned to the caller, so nobody can file a booking as someone else.
  await assertFails(setDoc(doc(student.firestore(), "interview_bookings", `${slotId}_student-2`),
    { ...booking, id: `${slotId}_student-2`, studentUid: "student-2" }));
  await assertFails(deleteDoc(doc(other.firestore(), "interview_bookings", booking.id)));
  await assertSucceeds(deleteDoc(doc(student.firestore(), "interview_bookings", booking.id)));
});

test("company profile visits: id is pinned, write-once, and students cannot read them back", async () => {
  await seedUsers([["student-1", "student@qiu.edu.my", "student"], ["employer-1", "hr@acme.com", "employer"]]);
  const student = testEnv.authenticatedContext("student-1", qiuAuth("student@qiu.edu.my"));
  const employer = testEnv.authenticatedContext("employer-1", qiuAuth("hr@acme.com"));
  const view = { companyId: 5, companyName: "Acme", studentUid: "student-1", viewedAt: serverTimestamp() };

  const sessionA = "ab12cd34ef56";
  await assertSucceeds(setDoc(doc(student.firestore(), "company_views", `5_student-1_${sessionA}`), view));
  // The once-per-session dedupe is the doc id, enforced here rather than by the
  // client: an unpinned id would let one student inflate a total without limit.
  await assertFails(setDoc(doc(student.firestore(), "company_views", "5_student-1_extra"), view));
  await assertFails(setDoc(doc(student.firestore(), "company_views", "5_student-1_ABC123DEF456"), view));
  await assertFails(setDoc(doc(student.firestore(), "company_views", `5_student-2_${sessionA}`),
    { ...view, studentUid: "student-2" }));
  // Rewriting the visit doc is how a client would try to pump a total.
  await assertFails(setDoc(doc(student.firestore(), "company_views", `5_student-1_${sessionA}`), view));
  // A NEW browser session counts again — that is the point of the change.
  await assertSucceeds(setDoc(doc(student.firestore(), "company_views", "5_student-1_zz98yy76xx54"), view));
  // The docs carry student ids, so only staff may read them (employers count theirs).
  await assertSucceeds(getDoc(doc(employer.firestore(), "company_views", `5_student-1_${sessionA}`)));
  await assertFails(getDoc(doc(student.firestore(), "company_views", `5_student-1_${sessionA}`)));
});
