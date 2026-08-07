import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { dataLayerSource } from "./helpers/data-layer.mjs";

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

// "where is it located?" used to answer with the entire profile whenever the
// booth number was missing, because every branch produced nothing and the
// function fell through to a catch-all that concatenated everything.
test("the company assistant answers only what was asked", async () => {
  const home = await readFile(new URL("../features/home/HomeView.tsx", import.meta.url), "utf8");
  const fn = home.slice(home.indexOf("function answerAboutCompany"));
  const body = fn.slice(0, fn.indexOf("\n/**"));
  assert.match(body, /let recognised = false/);
  // A recognised intent with no data says so, instead of dumping the profile.
  assert.match(body, /No booth number is listed/);
  // The overview is only reachable when nothing at all was recognised.
  assert.match(body, /if \(!recognised\)/);
});

test("the vacancy assistant does the same", async () => {
  const modal = await readFile(new URL("../features/vacancies/VacancyModal.tsx", import.meta.url), "utf8");
  const fn = modal.slice(modal.indexOf("function answerAboutJob"));
  const body = fn.slice(0, fn.indexOf("\n/**"));
  assert.match(body, /let recognised = false/);
  assert.match(body, /if \(recognised\) return "That detail is not listed on this vacancy\."/);
});

// Thirty companies pasted in should not be discarded because one row is wrong.
test("admins can bulk-import company profiles from JSON", async () => {
  const importer = await readFile(new URL("../features/admin/CompanyImport.tsx", import.meta.url), "utf8");
  assert.match(importer, /JSON\.parse/);
  assert.match(importer, /companyNamesMatch/);       // re-import updates, never duplicates
  assert.match(importer, /Duplicate of an earlier row/);
  assert.match(importer, /will be skipped\. The rest still import/);
  const panel = await readFile(new URL("../features/admin/AdminPanel.tsx", import.meta.url), "utf8");
  assert.match(panel, /Import companies/);
});

// An admin approving a registration only supplies the company NAME, so the
// profile lands empty and the rep is the one who knows what goes in it.
test("an employer whose profile is empty is prompted to complete it", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /incompleteCompany/);
  assert.match(page, /!myCompany\.summary && !myCompany\.website && !myCompany\.boothNumber/);
  assert.match(page, /Complete profile/);
});

// "Red Bull" registering must not silently absorb "Oracle Red Bull Racing" — the
// old containment rule made any shorter name match a longer one.
test("company matching treats distinct names as distinct", async () => {
  const { companyNamesMatch } = await import("../lib/data/company-matching.ts");
  assert.equal(companyNamesMatch("Oracle Red Bull Racing", "Red Bull"), false);
  assert.equal(companyNamesMatch("Red Bull", "Red Bull Racing"), false);
  // Case and legal suffixes still map to the same company.
  assert.equal(companyNamesMatch("ORACLE RED BULL RACING", "oracle red bull racing"), true);
  assert.equal(companyNamesMatch("Acme Solutions Sdn Bhd", "Acme Solutions"), true);
});

// A rejected mail record used to fail the whole approval atomically, and mail is
// not even delivered (no extension is installed).
test("approval cannot be undone by the notification email", async () => {
  const data = await dataLayerSource();
  const fn = data.slice(data.indexOf("export async function approveSignup"));
  const body = fn.slice(0, fn.indexOf("\nexport "));
  assert.ok(body.indexOf("batch.commit()") < body.indexOf("COLLECTIONS.mail"),
    "the mail record must be written after the batch has committed");
  assert.match(body, /\.catch\(\(\) => \{ \/\* No mailer is installed/);
  // Approving links to an existing profile rather than minting a duplicate.
  assert.match(body, /companyNamesMatch\(c\.name, signup\.company\)/);
});

test("companies can name the courses they want, and WhatsApp", async () => {
  const types = await readFile(new URL("../lib/data/types.ts", import.meta.url), "utf8");
  assert.match(types, /interestedIn\?: string\[\]/);
  assert.match(types, /whatsapp\?: string/);
  const home = await readFile(new URL("../features/home/HomeView.tsx", import.meta.url), "utf8");
  assert.match(home, /Chat with us on WhatsApp/);
  // The pre-filled opener is written for whoever is looking, not always a student.
  assert.match(home, /function whatsappOpener/);
  assert.match(home, /LOOKING FOR/);
  // The recommendation now follows what a company says it wants, not its vacancies.
  assert.match(home, /c\.interestedIn \?\? \[\]/);
  assert.doesNotMatch(home, /Has vacancies matching your profile/);
});

test("every filterable screen can be reset", async () => {
  const reset = await readFile(new URL("../components/FilterReset.tsx", import.meta.url), "utf8");
  assert.match(reset, /disabled=\{!active\}/);
  for (const file of ["../features/admin/AdminSummary.tsx", "../features/admin/EmployerSummary.tsx",
                      "../features/admin/TalkChatHistory.tsx", "../features/admin/StudentActivity.tsx",
                      "../features/admin/ChatHistory.tsx", "../features/admin/ApprovalQueue.tsx"]) {
    const code = await readFile(new URL(file, import.meta.url), "utf8");
    assert.match(code, /<FilterReset/, `${file} has filters but no reset`);
  }
});
