import { useEffect, useState } from "react";
import { subscribeApplications, subscribeCompanyChats, subscribeVacancies } from "../../lib/data/firestore";
import type { Application, ChatLog, Job } from "../../lib/data/types";
import { companyListIncludes } from "../../lib/data/company-matching";
import { ActivityTrend, activityInRange, BarChart, DonutChart, RecentActivity, TimeRangeControl, timestampToDate, type DashboardActivity, type DashboardRange } from "./AdminSummary";

type EmployerActivityType = "application" | "question";

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return <div className="stat-card"><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong>{hint && <small>{hint}</small>}</div>;
}

/** Employer landing: activity limited to companies assigned by an admin. */
export function EmployerSummary({ companies, onOpenActivity }: { companies: string[]; onOpenActivity?: (entry: DashboardActivity) => void }) {
  const [apps, setApps] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [chats, setChats] = useState<Record<string, ChatLog[]>>({});
  const [range, setRange] = useState<DashboardRange>("30");
  const [vacancy, setVacancy] = useState("all");
  const [activityType, setActivityType] = useState<EmployerActivityType | "all">("all");
  const [dashboardNow] = useState(() => Date.now());

  useEffect(() => subscribeApplications(setApps), []);
  useEffect(() => subscribeVacancies(setJobs, () => {}), []);
  useEffect(() => {
    if (!companies.length) return;
    const unsubs = companies.map((company) => subscribeCompanyChats(company, (rows) => setChats((previous) => ({ ...previous, [company]: rows }))));
    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, [companies.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-check company membership in the UI so stale subscriptions can never leak
  // activity after an employer's assignment changes.
  const mine = apps.filter((a) => companyListIncludes(companies, a.company));
  const questions = Object.values(chats).flat().filter((log) => Boolean(log.company && companyListIncludes(companies, log.company)));
  const jobById = new Map<number, { id: number; title: string; company: string }>();
  for (const job of jobs.filter((item) => companyListIncludes(companies, item.company))) jobById.set(job.id, job);
  for (const app of mine) if (!jobById.has(app.jobId)) jobById.set(app.jobId, { id: app.jobId, title: app.jobTitle, company: app.company });
  const vacancyOptions = [...jobById.values()].sort((a, b) => a.title.localeCompare(b.title));

  const allActivity: DashboardActivity[] = [
    ...mine.map((app) => ({ id: app.id, type: "application" as const, date: timestampToDate(app.appliedAt), studentUid: app.studentUid, actor: app.studentName || app.studentEmail || "Applicant", company: app.company, subject: app.jobTitle || "Vacancy application", context: app.company, jobId: app.jobId })),
    ...questions.map((log) => ({ id: log.id, type: "question" as const, date: timestampToDate(log.createdAt), studentUid: "", actor: "Anonymous student", company: log.company, subject: log.question || "Assistant question", context: log.company ? `About ${log.company}` : "Company question", answer: log.answer })),
  ];
  const activityScoped = allActivity.filter((entry) => {
    if (activityType !== "all" && entry.type !== activityType) return false;
    if (vacancy !== "all" && (entry.type !== "application" || mine.find((app) => app.id === entry.id)?.jobId !== Number(vacancy))) return false;
    return true;
  });
  const undatedInScope = activityScoped.filter((entry) => !entry.date).length;
  const filtered = activityScoped.filter((entry) => activityInRange(entry.date, range, dashboardNow));
  const filteredApps = filtered.filter((entry) => entry.type === "application");
  const filteredQuestions = filtered.filter((entry) => entry.type === "question");
  const vacancyName = vacancy === "all" ? "All assigned vacancies" : jobById.get(Number(vacancy))?.title ?? "Selected vacancy";
  const byVacancy = new Map<string, number>();
  for (const entry of filteredApps) byVacancy.set(entry.subject, (byVacancy.get(entry.subject) ?? 0) + 1);
  const ranked = [...byVacancy.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return (
    <section className="results dashboard-summary" aria-labelledby="emp-summary-title">
      <div className="results-head"><div><span>OVERVIEW</span><h1 id="emp-summary-title">Your company activity</h1></div><p>Applications and anonymized assistant questions for assigned companies only.</p></div>

      {!companies.length ? (
        <div className="dashboard-empty dashboard-empty-large"><strong>No company assigned</strong><p>Ask an admin to assign your company before using this dashboard.</p></div>
      ) : (
        <>
          <div className="dashboard-toolbar" aria-label="Dashboard filters">
            <label className="dashboard-filter" htmlFor="employer-summary-company"><span>Assigned company</span><input className="dashboard-lock-input" id="employer-summary-company" value={companies.join(", ")} readOnly aria-describedby="employer-company-note" /></label>
            <TimeRangeControl id="employer-summary-range" value={range} onChange={setRange} />
            <label className="dashboard-filter" htmlFor="employer-summary-vacancy"><span>Vacancy</span><select id="employer-summary-vacancy" value={vacancy} onChange={(event) => setVacancy(event.target.value)}><option value="all">All assigned vacancies</option>{vacancyOptions.map((job) => <option value={job.id} key={job.id}>{job.title} · {job.company}</option>)}</select></label>
            <label className="dashboard-filter" htmlFor="employer-summary-activity"><span>Activity type</span><select id="employer-summary-activity" value={activityType} onChange={(event) => setActivityType(event.target.value as EmployerActivityType | "all")}><option value="all">Applications and questions</option><option value="application">Applications</option><option value="question">Assistant questions</option></select></label>
            <p className="dashboard-scope-note" role="status">{filtered.length} matching records · {vacancyName}</p>
          </div>
          <p className="dashboard-note" id="employer-company-note">Company scope is assigned and managed by an administrator.</p>
          {vacancy !== "all" && <p className="dashboard-note">Assistant questions are company-level and are excluded when one vacancy is selected.</p>}
          {undatedInScope > 0 && <p className="dashboard-note">{undatedInScope} undated record{undatedInScope === 1 ? "" : "s"} {range === "all" ? "included in totals and listed after dated activity; undated records do not appear in the trend." : "excluded from this dated range."}</p>}

          <div className="summary-grid">
            <Stat label="Recorded activity" value={filtered.length} hint={`${filtered.filter((entry) => entry.date).length} dated`} />
            <Stat label="Applications" value={filteredApps.length} />
            <Stat label="Unique applicants" value={new Set(filteredApps.map((entry) => entry.studentUid).filter(Boolean)).size} />
            <Stat label="Vacancies with applications" value={new Set(filteredApps.map((entry) => entry.subject)).size} />
            <Stat label="Assistant questions" value={filteredQuestions.length} hint="student identity hidden" />
          </div>

          <ActivityTrend entries={filtered} range={range} now={dashboardNow} />
          <div className="summary-ranks">
            <DonutChart title="Candidate activity mix" rows={[
              { label: "Applications", count: filteredApps.length, color: "var(--blue)" },
              { label: "Assistant questions", count: filteredQuestions.length, color: "var(--info)" },
            ]} />
            <BarChart title="Applications by vacancy" rows={ranked} />
          </div>
          <RecentActivity entries={filtered} title="Recent filtered activity" onOpen={onOpenActivity} />
          <p className="dashboard-note">Profile-view data is not available. Dashboard totals use applications and anonymized assistant questions only.</p>
        </>
      )}
    </section>
  );
}
