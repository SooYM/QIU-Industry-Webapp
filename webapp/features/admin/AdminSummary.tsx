import { useEffect, useState } from "react";
import { subscribeApplications, subscribeAttendance, subscribeCompanies, subscribeEvents, subscribeViews } from "../../lib/data/firestore";
import { isApprovedCompany, type Application, type Attendance, type Company, type EventItem, type ViewEvent } from "../../lib/data/types";

function topBy<T>(items: T[], key: (t: T) => string): { label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const it of items) { const k = key(it); if (k) map.set(k, (map.get(k) ?? 0) + 1); }
  return [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return <div className="stat-card"><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong>{hint && <small>{hint}</small>}</div>;
}

function Rank({ title, rows, unit }: { title: string; rows: { label: string; count: number }[]; unit: string }) {
  return (
    <div className="rank-card">
      <span className="detail-label">{title}</span>
      {rows.length ? <ol className="rank-list">{rows.slice(0, 5).map((r, i) => <li key={r.label}><span className="rank-num">{i + 1}</span><span className="rank-label">{r.label}</span><span className="rank-count">{r.count} {unit}</span></li>)}</ol>
        : <p className="text-accent text-sm mt-1">No data yet.</p>}
    </div>
  );
}

/** Admin landing: portal-wide activity at a glance. */
export function AdminSummary() {
  const [apps, setApps] = useState<Application[]>([]);
  const [views, setViews] = useState<ViewEvent[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  useEffect(() => {
    const u = [
      subscribeApplications(setApps),
      subscribeViews(setViews),
      subscribeAttendance(setAttendance),
      subscribeEvents(setEvents, () => {}),
      subscribeCompanies(setCompanies, () => {}),
    ];
    return () => u.forEach((f) => f());
  }, []);

  const activeStudents = new Set([...apps.map((a) => a.studentUid), ...views.map((v) => v.studentUid), ...attendance.map((a) => a.studentUid)].filter(Boolean)).size;
  const eventTitleById = new Map(events.map((e) => [e.id, e.title]));
  const topCompanies = topBy(apps, (a) => a.company);
  const topJobs = topBy(apps, (a) => a.jobTitle);
  const topEvents = topBy(attendance, (a) => a.eventTitle || eventTitleById.get(a.eventId) || "");
  const cca = attendance.filter((a) => a.caEligible).length;

  return (
    <section className="results" aria-labelledby="summary-title">
      <div className="results-head"><div><span>OVERVIEW</span><h1 id="summary-title">Industry Day summary</h1></div><p>Live activity across the portal — students, applications, exhibitors and attendance.</p></div>

      <div className="summary-grid">
        <Stat label="Active students" value={activeStudents} hint="applied, viewed or attended" />
        <Stat label="Applications" value={apps.length} hint={`${new Set(apps.map((a) => a.jobId)).size} jobs applied to`} />
        <Stat label="Exhibitors" value={companies.filter(isApprovedCompany).length} hint={`${companies.length} total`} />
        <Stat label="Event check-ins" value={attendance.length} hint={`${cca} CCA-eligible`} />
      </div>

      <div className="summary-ranks">
        <Rank title="Most-applied companies" rows={topCompanies} unit="apps" />
        <Rank title="Most-applied jobs" rows={topJobs} unit="apps" />
        <Rank title="Best-attended events" rows={topEvents} unit="attended" />
      </div>
    </section>
  );
}
