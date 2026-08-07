import { useEffect, useState } from "react";
import { FilterReset } from "../../components/FilterReset";
import { subscribeAllInterviewBookings, subscribeApplications, subscribeViews } from "../../lib/data/firestore";
import type { Application, InterviewBooking, ViewEvent } from "../../lib/data/types";
import { csvWhen, downloadCsv, toCsv } from "../../lib/data/csv";
import { notify } from "../../components/toast";
import { companyListIncludes } from "../../lib/data/company-matching";

function formatWhen(ts: unknown): string {
  if (ts && typeof ts === "object" && "toDate" in ts) {
    return (ts as { toDate: () => Date }).toDate().toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }
  return "Just now";
}
function whenValue(ts: unknown): number {
  if (ts && typeof ts === "object" && "seconds" in ts) return (ts as { seconds: number }).seconds;
  return Number.MAX_SAFE_INTEGER;
}

/**
 * Student application activity. Admins see everything grouped by student;
 * employers see only applications to their own company's vacancies (flat).
 */
export function StudentActivity({ mode, companies = [] }: { mode: "all" | "company"; companies?: string[] }) {
  const [apps, setApps] = useState<Application[]>([]);
  const [views, setViews] = useState<ViewEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [bookings, setBookings] = useState<InterviewBooking[]>([]);

  useEffect(() => subscribeApplications((rows) => { setApps(rows); setLoading(false); }), []);
  // Session bookings are staff-only; admins see every company's.
  useEffect(() => (mode === "all" ? subscribeAllInterviewBookings(setBookings) : undefined), [mode]);
  // Views are admin-only (never surfaced to employers, for student privacy).
  useEffect(() => (mode === "all" ? subscribeViews(setViews) : undefined), [mode]);

  const q = query.trim().toLowerCase();
  const base = mode === "all" ? apps : apps.filter((a) => companyListIncludes(companies, a.company));
  const scoped = q ? base.filter((a) => [a.studentName, a.studentEmail, a.jobTitle, a.company].some((f) => (f ?? "").toLowerCase().includes(q))) : base;
  const search = (
    <div className="admin-toolbar">
      <input type="search" className="admin-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by student, email, job or company…" aria-label="Search activity" />
      <FilterReset active={Boolean(query)} onReset={() => setQuery("")} label="Clear search" />
    </div>
  );

  if (mode === "company") {
    const sorted = [...scoped].sort((a, b) => whenValue(b.appliedAt) - whenValue(a.appliedAt));
    const exportCompany = () => {
      if (!sorted.length) { notify("Nothing to export.", "error"); return; }
      const rows = sorted.map((a) => [a.studentName, a.studentEmail, a.studentEmployeeId ?? "", a.jobTitle, a.company, csvWhen(a.appliedAt)]);
      downloadCsv(`applicants-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(["Student", "Email", "Employee ID", "Job", "Company", "Applied at"], rows));
      notify(`Exported ${sorted.length} applicant${sorted.length === 1 ? "" : "s"}.`);
    };
    return (
      <section className="local-jobs" aria-labelledby="activity-title">
        <div className="local-jobs-head"><div><span className="detail-label">STUDENT ACTIVITY</span><h3 id="activity-title">Applications to your company</h3></div><div className="flex items-center gap-2"><strong>{sorted.length}</strong><button type="button" className="admin-button" onClick={exportCompany} disabled={!sorted.length}>⬇ Export CSV</button></div></div>
        <p className="text-[11px] text-accent">Only applications to your assigned company are shown.</p>
        {search}
        {loading ? <p className="role-manager-state" role="status">Loading…</p>
          : !companies.length ? <div className="admin-jobs-empty"><strong>No company assigned</strong><p>Ask an admin to set your company.</p></div>
          : sorted.length ? (
            <div className="local-job-list">
              {sorted.map((app) => (
                <div className="local-job" key={app.id}>
                  <span><b>{app.studentName || app.studentEmail}</b><small>{app.studentEmail}{app.studentEmployeeId ? ` · ID ${app.studentEmployeeId}` : ""} · applied to <b>{app.jobTitle}</b> · {formatWhen(app.appliedAt)}</small></span>
                </div>
              ))}
            </div>
          ) : <div className="admin-jobs-empty"><strong>No applications yet</strong><p>Student applications will appear here.</p></div>}
      </section>
    );
  }

  // Admin: group by student.
  const groups = new Map<string, { name: string; email: string; employeeId?: string; items: Application[] }>();
  for (const a of scoped) {
    const key = a.studentUid || a.studentEmail || "unknown";
    if (!groups.has(key)) groups.set(key, { name: a.studentName, email: a.studentEmail, employeeId: a.studentEmployeeId, items: [] });
    const g = groups.get(key)!;
    if (!g.employeeId && a.studentEmployeeId) g.employeeId = a.studentEmployeeId;
    g.items.push(a);
  }
  const grouped = [...groups.values()]
    .map((g) => ({ ...g, items: g.items.sort((x, y) => whenValue(y.appliedAt) - whenValue(x.appliedAt)) }))
    .sort((a, b) => whenValue(b.items[0]?.appliedAt) - whenValue(a.items[0]?.appliedAt));

  // Newer view events carry the student's name and email; older ones predate
  // those fields, so fall back to whatever an application tells us before
  // resorting to the raw uid — which is unreadable in the admin history.
  const nameByUid = new Map(apps.map((a) => [a.studentUid, { name: a.studentName, email: a.studentEmail, employeeId: a.studentEmployeeId }]));
  const labelFor = (v: ViewEvent) => {
    const fallback = nameByUid.get(v.studentUid);
    return {
      name: v.studentName || fallback?.name || "",
      email: v.studentEmail || fallback?.email || "",
    };
  };
  const viewsScoped = q
    ? views.filter((v) => [v.jobTitle, v.company, labelFor(v).name, labelFor(v).email].some((f) => (f ?? "").toLowerCase().includes(q)))
    : views;
  const viewGroups = new Map<string, { label: string; email: string; items: ViewEvent[] }>();
  for (const v of viewsScoped) {
    const who = labelFor(v);
    if (!viewGroups.has(v.studentUid)) {
      viewGroups.set(v.studentUid, { label: who.name || who.email || "Unknown student", email: who.email, items: [] });
    }
    viewGroups.get(v.studentUid)!.items.push(v);
  }
  const viewGrouped = [...viewGroups.values()]
    .map((g) => ({ ...g, items: g.items.sort((x, y) => whenValue(y.viewedAt) - whenValue(x.viewedAt)) }))
    .sort((a, b) => whenValue(b.items[0]?.viewedAt) - whenValue(a.items[0]?.viewedAt));

  const bookingsScoped = bookings.filter((b) =>
    !q || [b.studentName, b.studentEmail, b.companyName, b.course].some((f) => (f ?? "").toLowerCase().includes(q)));

  function exportBookings() {
    if (!bookingsScoped.length) { notify("Nothing to export.", "error"); return; }
    const rows = bookingsScoped.map((b) => [
      b.studentName, b.studentEmail, b.course ?? "", b.employeeId ?? "",
      b.sessionType === "consultancy" ? "Consultancy" : "Mock interview",
      b.companyName, b.date, b.startTime,
    ]);
    downloadCsv(`session-bookings-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(["Student", "Email", "Course", "ID", "Session", "Company", "Date", "Time"], rows));
    notify(`Exported ${bookingsScoped.length} booking${bookingsScoped.length === 1 ? "" : "s"}.`);
  }

  function exportApps() {
    if (!scoped.length) { notify("Nothing to export.", "error"); return; }
    const rows = scoped.map((a) => [a.studentName, a.studentEmail, a.studentEmployeeId ?? "", a.jobTitle, a.company, a.resumeChoice ?? "", csvWhen(a.appliedAt)]);
    downloadCsv(`applications-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(["Student", "Email", "Employee ID", "Job", "Company", "Resume shared", "Applied at"], rows));
    notify(`Exported ${scoped.length} application${scoped.length === 1 ? "" : "s"}.`);
  }
  function exportViews() {
    if (!viewsScoped.length) { notify("Nothing to export.", "error"); return; }
    const rows = viewsScoped.map((v) => [nameByUid.get(v.studentUid)?.name ?? "", nameByUid.get(v.studentUid)?.email ?? "", v.studentEmployeeId ?? nameByUid.get(v.studentUid)?.employeeId ?? "", v.studentUid, v.jobTitle, v.company, csvWhen(v.viewedAt)]);
    downloadCsv(`job-views-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(["Student", "Email", "Employee ID", "UID", "Job viewed", "Company", "Viewed at"], rows));
    notify(`Exported ${viewsScoped.length} view${viewsScoped.length === 1 ? "" : "s"}.`);
  }

  return (
    <section className="local-jobs" aria-labelledby="activity-title">
      <div className="local-jobs-head"><div><span className="detail-label">STUDENT ACTIVITY</span><h3 id="activity-title">Applications by student</h3></div><div className="flex items-center gap-2"><strong>{scoped.length} from {grouped.length}</strong><button type="button" className="admin-button" onClick={exportApps} disabled={!scoped.length}>⬇ Export CSV</button></div></div>
      {search}
      {loading ? <p className="role-manager-state" role="status">Loading…</p>
        : grouped.length ? grouped.map((g) => (
          <details className="student-group" key={g.email || g.name}>
            <summary className="student-group-head"><b>{g.name || g.email || "Student"}</b><small>{g.email}{g.employeeId ? ` · ID ${g.employeeId}` : ""} · {g.items.length} application{g.items.length === 1 ? "" : "s"}</small></summary>
            {g.items.map((app) => (
              <div className="local-job" key={app.id}>
                <span><b>{app.jobTitle}</b><small>{app.company} · {formatWhen(app.appliedAt)}</small></span>
              </div>
            ))}
          </details>
        )) : <div className="admin-jobs-empty"><strong>No applications yet</strong><p>Student applications will appear here.</p></div>}

      <div className="local-jobs-head mt-6"><div><span className="detail-label">VIEW HISTORY</span><h3>Jobs viewed by student</h3></div><div className="flex items-center gap-2"><strong>{viewsScoped.length} from {viewGrouped.length}</strong><button type="button" className="admin-button" onClick={exportViews} disabled={!viewsScoped.length}>⬇ Export CSV</button></div></div>
      {viewGrouped.length ? viewGrouped.map((g) => (
        <details className="student-group" key={g.label}>
          <summary className="student-group-head"><b>{g.label}</b><small>{g.email} · viewed {g.items.length} job{g.items.length === 1 ? "" : "s"}</small></summary>
          {g.items.map((v) => (
            <div className="local-job" key={v.id}>
              <span><b>{v.jobTitle}</b><small>{v.company} · {formatWhen(v.viewedAt)}</small></span>
            </div>
          ))}
        </details>
      )) : <div className="admin-jobs-empty"><strong>No views yet</strong><p>Jobs students open will appear here.</p></div>}
      {mode === "all" && (
        <>
          <div className="local-jobs-head mt-6">
            <div><span className="detail-label">SESSIONS BOOKED</span><h3>Mock interviews &amp; consultancies</h3></div>
            <div className="flex items-center gap-2">
              <strong>{bookingsScoped.length}</strong>
              <button type="button" className="admin-button" onClick={exportBookings} disabled={!bookingsScoped.length}>⬇ Export CSV</button>
            </div>
          </div>
          {bookingsScoped.length ? (
            <div className="local-job-list">
              {bookingsScoped.map((b) => (
                <div className="local-job" key={b.id}>
                  <span>
                    <b>{b.studentName || b.studentEmail || "Student"}</b>
                    <small>
                      {b.studentEmail}{b.course ? ` · ${b.course}` : ""} · {b.sessionType === "consultancy" ? "Consultancy" : "Mock interview"}
                      {" with "}<b>{b.companyName}</b> · {b.date} at {b.startTime}
                    </small>
                  </span>
                </div>
              ))}
            </div>
          ) : <div className="admin-jobs-empty"><strong>No sessions booked yet</strong><p>Student bookings for mock interviews and consultancies will appear here.</p></div>}
        </>
      )}
    </section>
  );
}
