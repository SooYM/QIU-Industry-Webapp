import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const card = await readFile(new URL("../features/vacancies/VacancyCard.tsx", import.meta.url), "utf8");
const list = await readFile(new URL("../features/vacancies/VacancyList.tsx", import.meta.url), "utf8");
const modal = await readFile(new URL("../features/vacancies/VacancyModal.tsx", import.meta.url), "utf8");
const home = await readFile(new URL("../features/home/HomeView.tsx", import.meta.url), "utf8");
const companies = await readFile(new URL("../features/admin/CompanyManager.tsx", import.meta.url), "utf8");
const eventForm = await readFile(new URL("../features/events/EventForm.tsx", import.meta.url), "utf8");
const chatAssistant = await readFile(new URL("../features/chat/ChatAssistant.tsx", import.meta.url), "utf8");
const auth = await readFile(new URL("../app/auth-context.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("event and salary helper copy stays aligned below its control", () => {
  assert.match(eventForm, /Session length \(minutes\)<input[\s\S]*?<small className="field-label">Auto-calculated/);
  assert.match(eventForm, /<label className="full">QR rotation \(seconds\)/);
  assert.match(styles, /small\.field-label\.leading-relaxed\s*{[^}]*display:block/s);
});

test("vacancies join approved company media for logos and video fallback", () => {
  assert.match(page, /exhibitors\.filter\(isApprovedCompany\)/);
  assert.match(page, /companiesByName={companiesByName}/);
  assert.match(list, /company={companiesByName\?\.get/);
  assert.match(card, /className={`job-company-logo logo-/);
  assert.match(modal, /const embedUrl = jobEmbedUrl \|\| corporateEmbedUrl/);
  assert.match(modal, /"JOB VIDEO" : "CORPORATE VIDEO"/);
});

test("admin exhibitor editing opens in a modal", () => {
  assert.match(companies, /<Modal className="admin-panel" labelledBy="exhibitor-edit-title"/);
  assert.match(companies, /editingId !== null && <Modal/);
  assert.match(companies, /onClose={cancelEdit}/);
  assert.match(companies, /submitLabel="Save changes"/);
});

test("brand navigation is role-aware and back-to-top stays native", () => {
  assert.match(page, /const brandTab: Tab = isStudent[\s\S]*?"home"[\s\S]*?: "summary"/);
  assert.match(page, /className="brand" href="#top" onClick=\{\(\) => setTab\(brandTab\)\}/);
  assert.match(page, /className="back-to-top" href="#top" aria-label="Back to top"/);
  assert.match(styles, /\.back-to-top\s*{[^}]*position:fixed[^}]*min-height:2\.75rem/s);
  assert.match(styles, /@media print[\s\S]*\.back-to-top \{ display: none !important; \}/);
});

test("vacancy controls switch between detailed cards and list view", () => {
  assert.doesNotMatch(page, /Text size|setTextScale|dataset\.textScale/);
  assert.match(page, /<label>View<select value=\{vacancyView\}/);
  assert.match(page, /<option value="cards">Detailed cards<\/option><option value="list">List view<\/option>/);
  assert.match(page, /<label>Card columns<select value=\{columns\} disabled=\{vacancyView === "list"\}/);
  assert.match(page, /view=\{vacancyView\}/);
  assert.match(list, /view === "list" \? "list-view" : "card-view"/);
  assert.match(styles, /\.job-grid\.list-view\s*{[^}]*grid-template-columns:1fr/s);
  assert.match(styles, /\.list-view \.job-card\s*{[^}]*grid-template-areas:/s);
});

test("vacancies render as one continuous filtered list", () => {
  assert.match(page, /jobs=\{filtered\}/);
  assert.doesNotMatch(page, /Per page|perPage|pageCount|visibleJobs|setPage/);
  assert.doesNotMatch(list, /pagination|currentPage|pageCount|onPrev|onNext/);
});

test("mobile list view is compact without shrinking its touch target", () => {
  assert.match(styles, /\.list-view \.job-card\s*{\s*min-height:5\.8rem/);
  assert.match(styles, /\.list-view \.meta span:nth-child\(n\+2\)\s*{\s*display:none/);
  assert.match(styles, /\.list-view \.card-foot small,\.list-view \.view-job\s*{\s*display:none/);
  assert.match(card, /className="applied-label[^"]*"[^>]*>Applied</);
});

test("login presents a clear company registration route", () => {
  assert.match(auth, /Continue with QIU Google/);
  assert.match(auth, /Register a company account with a Google account/);
  assert.match(auth, /No company-domain email needed/);
  assert.match(auth, /aria-describedby="company-registration-help"/);
  assert.match(styles, /\.company-register-sign-in\s*{[^}]*min-height:3rem/s);
});

test("chat keeps AI warnings in assistant messages without a duplicated static footer", () => {
  assert.match(chatAssistant, /content: withAiWarning\("Ask me to compare jobs/);
  assert.match(modal, /content: withAiWarning\(`Ask me about the \*\*\$\{job\.title\}\*\*/);
  assert.match(home, /content: withAiWarning\(`Ask me about \*\*\$\{company\.name\}\*\*/);
  assert.doesNotMatch(chatAssistant, /className="chat-boundary"/);
  assert.doesNotMatch(modal, /className="chat-disclaimer"/);
  assert.doesNotMatch(home, /className="chat-disclaimer"/);
});
