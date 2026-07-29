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
 * Student application activity. Admins see everything; employers see only
 * applications to their own company's vacancies.
 */
export function StudentActivity({ mode, companies = [] }: { mode: "all" | "company"; companies?: string[] }) {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => subscribeApplications((rows) => { setApps(rows); setLoading(false); }), []);

  const scoped = mode === "all" ? apps : apps.filter((a) => companies.includes(a.company));
  const sorted = [...scoped].sort((a, b) => whenValue(b.appliedAt) - whenValue(a.appliedAt));

  return (
    <section className="local-jobs" aria-labelledby="activity-title">
      <div className="local-jobs-head"><div><span className="detail-label">STUDENT ACTIVITY</span><h3 id="activity-title">{mode === "all" ? "Applications" : "Applications to your company"}</h3></div><strong>{sorted.length}</strong></div>
      {mode === "company" && <p className="text-[11px] text-accent">Only applications to your assigned company are shown.</p>}
      {loading ? (
        <p className="role-manager-state" role="status">Loading activity…</p>
      ) : !companies.length && mode === "company" ? (
        <div className="admin-jobs-empty"><strong>No company assigned</strong><p>Ask an admin to set your company, then applications to your vacancies will appear here.</p></div>
      ) : sorted.length ? (
        <div className="local-job-list">
          {sorted.map((app) => (
            <div className="local-job" key={app.id}>
              <span>
                <b>{app.studentName || app.studentEmail || "Student"}</b>
                <small>{app.studentEmail} · applied to <b>{app.jobTitle}</b> ({app.company}) · {formatWhen(app.appliedAt)}</small>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="admin-jobs-empty"><strong>No applications yet</strong><p>Student applications will appear here.</p></div>
      )}
    </section>
  );
}
