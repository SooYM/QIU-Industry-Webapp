import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { dataLayerSource } from "./helpers/data-layer.mjs";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const card = await readFile(new URL("../features/vacancies/VacancyCard.tsx", import.meta.url), "utf8");
const list = await readFile(new URL("../features/vacancies/VacancyList.tsx", import.meta.url), "utf8");
const modal = await readFile(new URL("../features/vacancies/VacancyModal.tsx", import.meta.url), "utf8");
const home = await readFile(new URL("../features/home/HomeView.tsx", import.meta.url), "utf8");
const companies = await readFile(new URL("../features/admin/CompanyManager.tsx", import.meta.url), "utf8");
const eventForm = await readFile(new URL("../features/events/EventForm.tsx", import.meta.url), "utf8");
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
  assert.match(auth, /Company representative/);
  assert.match(styles, /\.google-sign-in\s*{[^}]*min-height:3rem/s);
});

// Not every company runs on Google Workspace; some use their own mail server and
// have no Google account at all, so reps register with email + password.
test("company reps register with email and password, not Google", () => {
  assert.match(auth, /createUserWithEmailAndPassword/);
  assert.match(auth, /signInWithEmailAndPassword/);
  assert.match(auth, /Create company account/);
  // Locked-out reps need a way back in without an admin.
  assert.match(auth, /sendPasswordResetEmail/);
  // Students and staff must stay on Google — see the note in firestore.rules.
  assert.match(auth, /QIU accounts must use the Google button above/);
  // The Google option for company reps is gone.
  assert.doesNotMatch(auth, /Continue with a Google account/);
});

// Registering is ONE step. The rep states their company once; asking again on
// the next screen made them repeat themselves for a single action.
test("registration submits the request in the same step", () => {
  assert.match(auth, /Company you represent/);
  const fn = auth.slice(auth.indexOf("registerCompany: async"));
  const body = fn.slice(0, fn.indexOf("\n    signInWithPassword"));
  assert.match(body, /await submitSignup\(email, \{ name, company \}\)/);
  assert.ok(body.indexOf("createUserWithEmailAndPassword") < body.indexOf("submitSignup"),
    "the account must exist before its registration request is written");
  // The local stash is only a fallback for a failed write.
  assert.match(auth, /PENDING_SIGNUP_KEY/);
  assert.match(auth, /readPendingSignup/);
  // Admin sets the logo and corporate video on the company profile, so the rep
  // is not asked for image URLs during registration.
  assert.doesNotMatch(auth, /Logo image URL/);
  assert.doesNotMatch(auth, /Corporate video \(YouTube\)/);
});

test("the company sign-in panel is a real panel, not inline text", () => {
  assert.match(styles, /\.company-auth \{/);
  assert.match(styles, /\.company-auth-switch button\.is-active/);
});

test("chat keeps AI warnings in assistant messages without a duplicated static footer", () => {
  assert.match(modal, /content: withAiWarning\(`Ask me about the \*\*\$\{job\.title\}\*\*/);
  assert.match(home, /content: withAiWarning\(`Ask me about \*\*\$\{company\.name\}\*\*/);
  assert.doesNotMatch(modal, /className="chat-disclaimer"/);
  assert.doesNotMatch(home, /className="chat-disclaimer"/);
});

// The legacy stylesheet enforces 44px targets in ten separate rules because this
// portal is used standing up in a hall. The newer helper layer must not erode it.
test("shared button and field helpers keep a 44px touch target", () => {
  assert.match(styles, /\.ui-btn\s*\{[^}]*min-height:2\.75rem/);
  assert.match(styles, /\.ui-field\s*\{[^}]*min-height:2\.75rem/);
  // Under 16px, iOS Safari zooms the page the moment an input is focused.
  assert.match(styles, /\.ui-field\s*\{[^}]*font-size:max\(16px,1em\)/);
});

// Brand red on brand-soft is 4.39:1 — below AA for the small chips using it, and
// there were fifteen such rules, not the one that was fixed first.
test("no small text sits on the brand tint in the failing colour", () => {
  const rules = [...styles.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter(([, , body]) => body.includes("background:var(--blue-soft)") && body.includes("color:var(--blue)"))
    .map(([, sel]) => sel.trim().split("\n").pop().trim());
  assert.deepEqual(rules, [], `these still fail AA: ${rules.join(", ")}`);
  assert.match(styles, /\.tone-accent\s*\{[^}]*color:var\(--color-primary-on-soft\)/);
  assert.match(styles, /\.exhibitor-tag\s*\{[^}]*color:var\(--blue-on-soft\)/);
});

test("no raw Tailwind palette colours outside the token seam", async () => {
  for (const file of ["../app/RichText.tsx", "../features/events/TalkLiveChat.tsx",
                      "../features/events/TalkFeedback.tsx", "../features/admin/MockInterviews.tsx",
                      "../features/student/InterviewBookingModal.tsx"]) {
    const code = await readFile(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(code, /(indigo|slate|emerald|rose|amber)-[0-9]/, `${file} bypasses the theme tokens`);
  }
});

test("modals trap Tab so focus cannot reach the page behind", async () => {
  const modal = await readFile(new URL("../components/Modal.tsx", import.meta.url), "utf8");
  assert.match(modal, /event\.key !== "Tab"/);
  assert.match(modal, /shiftKey/);
});

test("the live Q&A is hoisted above the reading material during a talk", async () => {
  const detail = await readFile(new URL("../features/events/EventDetail.tsx", import.meta.url), "utf8");
  const hoisted = detail.indexOf('{st === "live" && liveChat}');
  const about = detail.indexOf('detail-label">ABOUT');
  assert.ok(hoisted > -1 && about > -1 && hoisted < about, "the live Q&A must precede ABOUT");
});

// A student email is a single ~300px unbreakable token. `flex:1` leaves
// min-width:auto, so these rows could not shrink and the whole page scrolled
// sideways on about a dozen admin and student screens.
test("list rows can shrink below their longest token", () => {
  assert.match(styles, /\.local-job>span\s*\{[^}]*min-width:0/);
  assert.match(styles, /\.local-job b,\.local-job small\s*\{[^}]*overflow-wrap:anywhere/);
  for (const sel of ["\\.local-jobs-head", "\\.company-vacancy", "\\.scan-banner"]) {
    assert.match(styles, new RegExp(`${sel}\\s*\\{[^}]*flex-wrap:wrap`), `${sel} must wrap on mobile`);
  }
  // Approved-account rows use a grid instead, so the action buttons align down
  // the list; minmax(0,1fr) is what lets the email column shrink.
  assert.match(styles, /\.access-approved-row \{ display:grid; grid-template-columns:minmax\(0,1fr\) auto/);
  assert.match(styles, /\.access-approved-row>span \{ min-width:0; overflow-wrap:anywhere/);
});

// The rule that hid the topbar's admin button was unscoped, so on any phone it
// also hid every CSV export and the mock-interview form's own submit button.
test("only the topbar's admin button is hidden on mobile", () => {
  assert.match(styles, /\.topbar nav,\.topbar \.admin-button \{ display:none/);
  assert.doesNotMatch(styles, /\.topbar nav,\.admin-button \{ display:none/);
});

test("form controls reach 16px on mobile so iOS does not zoom", () => {
  const block = styles.slice(styles.indexOf("@media (max-width:800px) {\n  /* Under 16px"));
  for (const sel of [".admin-search", ".cv-form input", ".chat-form input", ".register-field input"]) {
    assert.ok(block.includes(sel), `${sel} is missing from the 16px mobile block`);
  }
});

test("modals animate in and the tab strips show there is more to scroll", () => {
  assert.match(styles, /@keyframes sheet-in/);
  assert.match(styles, /\.modal-backdrop \{ animation:backdrop-in/);
  assert.match(styles, /\.main-tabs \{ -webkit-mask-image/);
  // …and all of it collapses under the reduced-motion catch-all, which must
  // cover every element rather than the old hand-listed allow-list.
  const rm = styles.slice(styles.lastIndexOf("@media (prefers-reduced-motion:reduce)"));
  assert.match(rm, /\*,\*::before,\*::after \{[^}]*animation-duration:\.01ms !important/);
  assert.match(rm, /transition-duration:\.01ms !important/);
});

// Firebase's verification mail does not reach several of the providers these
// companies use, which locked every rep out. Admin approval is the gate instead,
// so registration must not depend on an email arriving at all.
test("registration does not depend on a verification email", async () => {
  const fn = auth.slice(auth.indexOf("registerCompany: async"));
  const body = fn.slice(0, fn.indexOf("\n    signInWithPassword"));
  assert.doesNotMatch(body, /sendEmailVerification/);
  assert.doesNotMatch(body, /firebaseSignOut/);
  // A password account is not bounced for being unverified…
  assert.match(auth, /!nextUser\.emailVerified && !viaPassword/);
  // …and goes straight to the company registration form.
  assert.match(auth, /if \(needsRegistration\) return <RegisterGate \/>;/);
});

// A single sentence for every failure hid which one it was: a rules regression
// that locked out every approved employer looked identical to being offline.
test("the profile-load failure says which failure it was", () => {
  assert.match(auth, /console\.error\("\[auth\] could not load or create the user profile:"/);
  assert.match(auth, /code === "permission-denied"/);
  // A dropped connection must not sign the user out.
  assert.match(auth, /code\.includes\("unavailable"\) \|\| code\.includes\("network"\)/);
  assert.match(auth, /Check your connection and reload/);
});

// An admin approving a rep needs to be able to correct or set which company that
// account represents, without revoking and re-approving them.
test("admins can assign a company to an approved account", () => {
  assert.match(auth, /async function assignCompany/);
  assert.match(auth, /Assign company/);
  assert.match(auth, /Change company/);
  // Picked from the companies that exist, not typed free-hand — a typo would
  // leave the rep with employer access and no profile to edit.
  assert.match(auth, /companyOptions\.map\(\(name\) => <option/);
  assert.match(auth, /Select a company…/);
  // Both the whitelist entry and the account's own document are updated, so the
  // change lands without waiting for a fresh sign-in.
  const fn = auth.slice(auth.indexOf("async function assignCompany"));
  const body = fn.slice(0, fn.indexOf("\n  async function removeWhitelistedEmail"));
  assert.match(body, /"whitelisted_emails"/);
  assert.match(body, /"users"/);
  assert.match(styles, /\.access-assign \{/);
});

// The approved list was a one-shot read, so changing a role further down the
// screen left these rows showing the old value until a reload.
test("the approved account list is live and stays in step with role changes", () => {
  assert.match(auth, /onSnapshot\(collection\(activeDb, "whitelisted_emails"\)/);
  // A role change also lands on the whitelist, which is what a fresh sign-in reads.
  const fn = auth.slice(auth.indexOf("await updateDoc(doc(db, \"users\", record.uid)"));
  assert.match(fn.slice(0, 800), /whitelisted_emails/);
});

test("approved account rows share one column layout so actions align", () => {
  assert.match(styles, /\.access-approved-row \{ display:grid; grid-template-columns:minmax\(0,1fr\) auto/);
  assert.match(styles, /@media \(max-width:700px\) \{ \.access-approved-row \{ grid-template-columns:1fr/);
});

// Presenters could close the whole Q&A but not remove one abusive question.
test("an admin or facilitator can delete a live Q&A message", async () => {
  const chat = await readFile(new URL("../features/events/TalkLiveChat.tsx", import.meta.url), "utf8");
  assert.match(chat, /deleteTalkLiveChatMessage/);
  assert.match(chat, /isPresenter && \(/);
  assert.match(chat, /window\.confirm/);
  const data = await dataLayerSource();
  assert.match(data, /export async function deleteTalkLiveChatMessage/);
});

// The guide is the only in-app explanation of how the portal works, so it has to
// describe the portal that actually exists — it had drifted far enough to be
// wrong (it still promised employers that student questions were anonymous).
test("the role guides cover the features that exist", async () => {
  const guide = await readFile(new URL("../features/Guide.tsx", import.meta.url), "utf8");
  const student = guide.slice(guide.indexOf("student: {"), guide.indexOf("employer: {"));
  const employer = guide.slice(guide.indexOf("employer: {"), guide.indexOf("admin: {"));
  const admin = guide.slice(guide.indexOf("admin: {"));

  for (const term of ["mock interview or consultancy", "Mark as interested", "live Q&A", "review", "CHECK OUT"]) {
    assert.ok(student.includes(term), `the student guide should mention ${term}`);
  }
  for (const term of ["password", "consultancy", "Profile visits", "not anonymous"]) {
    assert.ok(employer.includes(term), `the employer guide should mention ${term}`);
  }
  for (const term of ["Import companies", "Assign company", "Talk Q&A", "facilitator"]) {
    assert.ok(admin.includes(term), `the admin guide should mention ${term}`);
  }
  // The stale claim that employers cannot see who asked.
  assert.doesNotMatch(guide, /anonymously \(you see the question, not who asked\)/);
});
