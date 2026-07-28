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
  await assertFails(updateDoc(profileRef, { role: "admin", updatedAt: serverTimestamp() }));
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
