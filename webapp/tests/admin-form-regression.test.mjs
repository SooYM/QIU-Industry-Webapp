import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { dataLayerSource } from "./helpers/data-layer.mjs";

const [panel, helpers, firestore] = await Promise.all([
  readFile(new URL("../features/admin/AdminPanel.tsx", import.meta.url), "utf8"),
  readFile(new URL("../features/vacancies/vacancy-utils.ts", import.meta.url), "utf8"),
  dataLayerSource(),
]);
const saveVacancy = panel.slice(panel.indexOf("async function saveVacancy"), panel.indexOf("async function removeCustomJob"));

test("salary starts empty and is normalized only when vacancy is saved", () => {
  assert.match(helpers, /salary:\s*""/);
  assert.match(panel, /salary:\s*e\.target\.value/);
  assert.match(saveVacancy, /Number\(draft\.salary\.replace\(\/\[,\\s\]\/g, ""\)\)/);
});

test("vacancies load and mutate through shared Firestore", () => {
  assert.match(firestore, /export function subscribeVacancies/);
  assert.match(firestore, /export async function saveJob/);
  assert.match(panel, /await saveJob\(newJob, isEditing, userEmail\)/);
});

test("only privileged roles receive vacancy management controls", () => {
  assert.match(panel, /const canManageJobs = canManageVacancies\(role\)/);
  assert.match(panel, /const isApprover = role === "admin" \|\| role === "superadmin"/);
});

test("editing preserves fields not exposed by the vacancy form", () => {
  assert.match(saveVacancy, /const existingJob = isEditing \? customJobs\.find/);
  for (const field of ["payFrequency", "detailsLink", "companySummary", "companySources"]) {
    assert.match(saveVacancy, new RegExp(`${field}: existingJob\\?\\.${field} \\?\\?`));
  }
});

test("admin vacancy search and filters narrow editable list", () => {
  for (const state of ["adminQuery", "adminCompany", "adminSpecialization", "adminType"]) {
    assert.match(panel, new RegExp(`const \\[${state}, set`));
  }
  assert.match(panel, /const adminFilteredJobs = useMemo/);
  assert.match(panel, /\[job\.title, job\.company, job\.location, job\.specialization, job\.type\]/);
  assert.match(panel, /No vacancies match these filters\./);
  assert.match(panel, /resetAdminFilters/);
});
