import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const data = await readFile(new URL("../lib/data/firestore.ts", import.meta.url), "utf8");
const auth = await readFile(new URL("../app/auth-context.tsx", import.meta.url), "utf8");
const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");

test("registration and vacancy approvals atomically enqueue bounded emails", () => {
  assert.match(data, /export async function approveJob[\s\S]*?writeBatch\(database\)[\s\S]*?vacancy-approved-/);
  assert.match(data, /export async function approveSignup[\s\S]*?writeBatch\(database\)[\s\S]*?registration-approved-/);
  assert.match(data, /Company registration approved:/);
  assert.match(rules, /match \/mail\/\{mailId\}[\s\S]*allow create: if isAdmin\(\)/);
  assert.match(rules, /allow update, delete: if false/);
});

test("employer revoke removes access, company profiles, vacancies, and counters", () => {
  assert.match(data, /export async function revokeEmployerAccess/);
  assert.match(data, /where\("createdBy", "==", owner\)/);
  assert.match(data, /where\("company", "==", company\)/);
  assert.match(data, /where\("name", "==", company\)/);
  assert.match(data, /COLLECTIONS\.jobStats/);
  assert.match(data, /COLLECTIONS\.whitelist, owner/);
  assert.match(auth, /Revoke and delete company/);
  assert.match(auth, /No access changes were applied/);
  assert.match(rules, /'active' in get[\s\S]*?active == true/);
});

test("authentication checks only the caller's whitelist record", () => {
  assert.match(auth, /getDoc\(doc\(activeDb, "whitelisted_emails", email\)\)/);
  assert.match(rules, /emailId == request\.auth\.token\.email\.lower\(\) \|\| isAdmin\(\)/);
});
