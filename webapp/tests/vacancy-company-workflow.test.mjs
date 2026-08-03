import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const admin = await readFile(new URL("../features/admin/AdminPanel.tsx", import.meta.url), "utf8");
const company = await readFile(new URL("../features/admin/CompanyManager.tsx", import.meta.url), "utf8");

test("admin chooses a saved company before vacancy details are shown", () => {
  assert.match(admin, /subscribeCompanies\(\(rows\) => setVacancyCompanies/);
  assert.match(admin, /<select required value=\{draft\.company\}/);
  assert.match(admin, /Select company before entering vacancy details/);
  assert.match(admin, /\{\(!isApprover \|\| Boolean\(draft\.company\)\) && <>/);
  assert.doesNotMatch(admin, /<label>Company<input required value=\{draft\.company\}/);
});

test("vacancy wording uses description and qualifications", () => {
  assert.match(admin, />Description<\/span><textarea value=\{draft\.jobScope/);
  assert.match(admin, />Qualifications<\/span><textarea value=\{draft\.requirement/);
  assert.match(admin, />Minimum qualification<select value=\{draft\.minimumRequirement\}/);
  assert.doesNotMatch(admin, />Job scope \/ responsibilities</);
  assert.doesNotMatch(admin, />Requirements<\/span>/);
});

test("admin company form requires and stores an email", () => {
  assert.match(company, /Company email<input type="email" required value=\{draft\.email\}/);
  assert.match(company, /if \(!employer && !draft\.email\.trim\(\)\)/);
  assert.match(company, /email: employer \? existing\?\.email : draft\.email\.trim\(\)/);
});
