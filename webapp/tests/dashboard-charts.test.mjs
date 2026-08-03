import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const admin = await readFile(new URL("../features/admin/AdminSummary.tsx", import.meta.url), "utf8");
const employer = await readFile(new URL("../features/admin/EmployerSummary.tsx", import.meta.url), "utf8");
const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const conversation = await readFile(new URL("../features/admin/DashboardConversationModal.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("role dashboards render accessible interactive engagement charts", () => {
  assert.match(admin, /export function DonutChart/);
  assert.match(admin, /role="group" aria-label=/);
  assert.match(admin, /aria-pressed=/);
  assert.match(admin, /Portal engagement mix/);
  assert.match(employer, /Candidate activity mix/);
});

test("donut segments expose pointer, keyboard, and persistent selection controls", () => {
  assert.match(admin, /className={`donut-segment/);
  assert.match(admin, /role="button"/);
  assert.match(admin, /tabIndex={0}/);
  assert.match(admin, /onPointerEnter=/);
  assert.match(admin, /onPointerLeave=/);
  assert.match(admin, /onFocus=/);
  assert.match(admin, /onBlur=/);
  assert.match(admin, /onClick=/);
  assert.match(admin, /onKeyDown=/);
  assert.match(admin, /aria-pressed=/);
});

test("donut legend keeps full labels readable in narrow dashboard cards", () => {
  assert.match(styles, /\.donut-layout\s*{[^}]*grid-template-columns:1fr/s);
  assert.match(styles, /\.donut-legend span\s*{[^}]*white-space:normal/s);
  assert.doesNotMatch(styles, /\.donut-legend span\s*{[^}]*text-overflow:ellipsis/s);
});

test("dashboards share date-safe range controls and scoped slicers", () => {
  assert.match(admin, /export type DashboardRange = "7" \| "30" \| "90" \| "all"/);
  assert.match(admin, /export function timestampToDate/);
  assert.match(admin, /\.toDate\(\)/);
  assert.match(admin, /\.seconds/);
  assert.match(admin, /export function TimeRangeControl/);
  assert.match(admin, /subscribeAllChats/);
  assert.match(admin, /Company scope/);
  assert.match(admin, /Activity type/);
  assert.match(employer, /<TimeRangeControl/);
  assert.match(employer, /Vacancy/);
  assert.match(employer, /Activity type/);
  assert.match(employer, /Assigned company/);
  assert.match(employer, /dashboard-lock-input/);
});

test("dashboards expose visible trend buckets and recent filtered activity", () => {
  assert.match(admin, /export function ActivityTrend/);
  assert.match(admin, /className="trend-buckets"/);
  assert.match(admin, /aria-label={`\$\{bucket\.label\}: \$\{bucket\.count\} activities`}/);
  assert.match(admin, /Recent filtered activity/);
  assert.match(admin, /Date unavailable/);
  assert.match(employer, /Recent filtered activity/);
  assert.match(employer, /Anonymous student/);
  assert.match(employer, /companyListIncludes\(companies, a\.company\)/);
});

test("dashboard controls, charts, and activity rows adapt on small screens", () => {
  assert.match(styles, /\.dashboard-toolbar\s*{/);
  assert.match(styles, /\.trend-buckets\s*{/);
  assert.match(styles, /\.activity-row\s*{/);
  assert.match(styles, /@media \(max-width:700px\)[^{]*\{[^}]*\.dashboard-toolbar/s);
});

test("recent activity opens real vacancy, event, and conversation details", () => {
  assert.match(admin, /onOpen\?\.\(entry\)/);
  assert.match(admin, /jobId: row\.jobId/);
  assert.match(admin, /eventId: row\.eventId/);
  assert.match(employer, /jobId: app\.jobId/);
  assert.match(page, /openDashboardActivity/);
  assert.match(page, /setSelectedJob\(job\)/);
  assert.match(page, /setSelectedEvent\(event\)/);
  assert.match(page, /setSelectedDashboardChat\(activity\)/);
  assert.match(conversation, /Assistant answer/);
  assert.match(conversation, /Student identity remains hidden/);
  assert.match(styles, /\.activity-row:hover/);
  assert.match(styles, /\.activity-row:focus-visible/);
});
