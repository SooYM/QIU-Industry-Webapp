import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const saveVacancy = page.slice(page.indexOf("function saveVacancy"), page.indexOf("function removeCustomJob"));

test("salary can be cleared and is normalized only when the vacancy is saved", () => {
  assert.match(page, /salary:\s*""/);
  assert.match(page, /salary:\s*e\.target\.value/);
  assert.match(saveVacancy, /const salary = draft\.salary === "" \? 0 : Number\(draft\.salary\)/);
});

test("vacancies load and mutate through shared Firestore", () => {
  assert.doesNotMatch(page, /data\/jobs\.json|CUSTOM_JOBS_KEY|localStorage\.setItem\(CUSTOM_JOBS_KEY/);
  assert.match(page, /onSnapshot\(collection\(db, "vacancies"\)/);
  assert.match(saveVacancy, /setDoc\(doc\(db, "vacancies"/);
  assert.match(page, /job\.salary === 0 \|\| maxSalary === 10000 \|\| job\.salary <= maxSalary/);
  assert.match(saveVacancy, /resetFilters\(\)/);
  assert.match(saveVacancy, /setAdminOpen\(false\)/);
});

test("only privileged roles see vacancy management and superadmin imports private JSON", () => {
  assert.match(page, /canManageVacancies\(role\)|role === "admin" \|\| role === "superadmin"/);
  assert.match(page, /role === "superadmin".*Initial data import/);
  assert.match(page, /writeBatch\(activeDb\)/);
});

test("private import canonicalizes Kuala Lumpur as a Malaysian federal territory", () => {
  assert.match(page, /"Kuala Lumpur": "W\.P\. Kuala Lumpur"/);
  assert.match(page, /location: malaysiaState \?\? job\.location/);
  assert.match(page, /locationMode: malaysiaState \? "malaysia" : "international"/);
  assert.match(page, /state: malaysiaState \?\? ""/);
});

test("editing preserves vacancy fields not exposed by the admin form", () => {
  assert.match(saveVacancy, /const existingJob = isEditing \? customJobs\.find/);
  for (const field of ["payFrequency", "detailsLink", "companySummary", "companySources"]) {
    assert.match(saveVacancy, new RegExp(`${field}: existingJob\\?\\.${field} \\?\\?`));
  }
});

test("admin vacancy search and filters narrow the editable list", () => {
  for (const state of ["adminQuery", "adminCompany", "adminSpecialization", "adminType"]) {
    assert.match(page, new RegExp(`const \\[${state}, set`));
  }

  assert.match(page, /const adminFilteredJobs = useMemo/);
  assert.match(page, /const search = adminQuery\.trim\(\)\.toLowerCase\(\)/);
  assert.match(page, /\[job\.title, job\.company, job\.location, job\.specialization, job\.type\]/);
  for (const [state, fallback, field] of [
    ["adminCompany", "All companies", "company"],
    ["adminSpecialization", "All specializations", "specialization"],
    ["adminType", "All opportunities", "type"],
  ]) {
    assert.match(page, new RegExp(`\\(${state} === "${fallback}" \\|\\| job\\.${field} === ${state}\\)`));
  }
  assert.match(page, /\(!search \|\| .*\.some\(.*\.includes\(search\)\)\) &&/);
  assert.match(page, /job\.company === adminCompany\) &&\s*\(adminSpecialization/);
  assert.match(page, /job\.specialization === adminSpecialization\) &&\s*\(adminType/);
  assert.match(page, /adminFilteredJobs\.map\(job =>/);
  assert.match(page, /No vacancies match these filters\./);
  assert.match(page, /resetAdminFilters/);

  for (const [options, state, setter, fallback] of [
    ["companies", "adminCompany", "setAdminCompany", "All companies"],
    ["specializations", "adminSpecialization", "setAdminSpecialization", "All specializations"],
    ["types", "adminType", "setAdminType", "All opportunities"],
  ]) {
    assert.match(page, new RegExp(`!${options}\\.includes\\(${state}\\).*${setter}\\("${fallback}"\\)`, "s"));
  }
});
