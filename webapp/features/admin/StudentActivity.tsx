import { useEffect, useState } from "react";
import { subscribeApplications } from "../../lib/data/firestore";
import type { Application } from "../../lib/data/types";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => subscribeApplications((rows) => { setApps(rows); setLoading(false); }), []);

  const scoped = mode === "all" ? apps : apps.filter((a) => companies.includes(a.company));

  if (mode === "company") {
    const sorted = [...scoped].sort((a, b) => whenValue(b.appliedAt) - whenValue(a.appliedAt));
    return (
      <section className="local-jobs" aria-labelledby="activity-title">
        <div className="local-jobs-head"><div><span className="detail-label">STUDENT ACTIVITY</span><h3 id="activity-title">Applications to your company</h3></div><strong>{sorted.length}</strong></div>
        <p className="text-[11px] text-accent">Only applications to your assigned company are shown.</p>
        {loading ? <p className="role-manager-state" role="status">Loading…</p>
          : !companies.length ? <div className="admin-jobs-empty"><strong>No company assigned</strong><p>Ask an admin to set your company.</p></div>
          : sorted.length ? (
            <div className="local-job-list">
              {sorted.map((app) => (
                <div className="local-job" key={app.id}>
                  <span><b>{app.studentName || app.studentEmail}</b><small>{app.studentEmail} · applied to <b>{app.jobTitle}</b> · {formatWhen(app.appliedAt)}</small></span>
                </div>
              ))}
            </div>
          ) : <div className="admin-jobs-empty"><strong>No applications yet</strong><p>Student applications will appear here.</p></div>}
      </section>
    );
  }

  // Admin: group by student.
  const groups = new Map<string, { name: string; email: string; items: Application[] }>();
  for (const a of scoped) {
    const key = a.studentUid || a.studentEmail || "unknown";
    if (!groups.has(key)) groups.set(key, { name: a.studentName, email: a.studentEmail, items: [] });
    groups.get(key)!.items.push(a);
  }
  const grouped = [...groups.values()]
    .map((g) => ({ ...g, items: g.items.sort((x, y) => whenValue(y.appliedAt) - whenValue(x.appliedAt)) }))
    .sort((a, b) => whenValue(b.items[0]?.appliedAt) - whenValue(a.items[0]?.appliedAt));

  return (
    <section className="local-jobs" aria-labelledby="activity-title">
      <div className="local-jobs-head"><div><span className="detail-label">STUDENT ACTIVITY</span><h3 id="activity-title">Applications by student</h3></div><strong>{scoped.length} from {grouped.length}</strong></div>
      {loading ? <p className="role-manager-state" role="status">Loading…</p>
        : grouped.length ? grouped.map((g) => (
          <div className="student-group" key={g.email || g.name}>
            <div className="student-group-head"><b>{g.name || g.email || "Student"}</b><small>{g.email} · {g.items.length} application{g.items.length === 1 ? "" : "s"}</small></div>
            {g.items.map((app) => (
              <div className="local-job" key={app.id}>
                <span><b>{app.jobTitle}</b><small>{app.company} · {formatWhen(app.appliedAt)}</small></span>
              </div>
            ))}
          </div>
        )) : <div className="admin-jobs-empty"><strong>No applications yet</strong><p>Student applications will appear here.</p></div>}
    </section>
  );
}
