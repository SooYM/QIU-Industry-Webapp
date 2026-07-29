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

test("catch-all denies unknown collections", async () => {
  const user = testEnv.authenticatedContext("user-1", qiuAuth("user@qiu.edu.my"));
  await assertFails(getDoc(doc(user.firestore(), "secret_stuff", "x")));
  await assertFails(setDoc(doc(user.firestore(), "secret_stuff", "x"), { any: "thing" }));
});
