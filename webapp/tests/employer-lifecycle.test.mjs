import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { dataLayerSource } from "./helpers/data-layer.mjs";

const data = await dataLayerSource();
const auth = await readFile(new URL("../app/auth-context.tsx", import.meta.url), "utf8");
const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");

// Approval creates the company profile AND grants access in one batch, so the
// admin has a profile to fill in and the rep can sign in straight after.
test("approving a signup creates the company and whitelists the rep together", async () => {
  const data = await dataLayerSource();
  const fn = data.slice(data.indexOf("export async function approveSignup"));
  const body = fn.slice(0, fn.indexOf("\nexport "));
  assert.match(body, /COLLECTIONS\.whitelist/);
  assert.match(body, /COLLECTIONS\.companies/);
  assert.match(body, /batch\.commit\(\)/);
  // The approval email no longer tells them to use a Google account.
  assert.doesNotMatch(body, /this Google account/);
  assert.match(body, /password you chose/);
});

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

// Mail records are immutable. A fixed `registration-approved-{email}` id meant
// that once an address had been approved once, re-registering it — under a
// corrected company name, say — made every later approval fail permanently,
// and the UI reported only "Could not approve."
test("approval mail ids are unique per approval, so re-approval is possible", async () => {
  const data = await dataLayerSource();
  assert.match(data, /registration-approved-\$\{signup\.email\}-\$\{Date\.now\(\)\}/);
  assert.match(data, /vacancy-approved-\$\{job\.id\}-\$\{Date\.now\(\)\}/);
  assert.doesNotMatch(data, /`registration-approved-\$\{signup\.email\}`/);
});
