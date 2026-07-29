import type { Application, Job, ViewEvent } from "../../lib/data/types";

/** Firestore Timestamp → readable date, tolerant of the pending serverTimestamp. */
function formatWhen(ts: unknown): string {
  if (ts && typeof ts === "object" && "toDate" in ts) {
    return (ts as { toDate: () => Date }).toDate().toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }
  return "Just now";
}

function whenValue(ts: unknown): number {
  if (ts && typeof ts === "object" && "seconds" in ts) return (ts as { seconds: number }).seconds;
  return Number.MAX_SAFE_INTEGER; // pending serverTimestamp sorts to the top
}

export function StudentHistory({
  jobs,
  applications,
  views,
  onOpen,
}: {
  jobs: Job[];
  applications: Application[];
  views: ViewEvent[];
  onOpen: (job: Job) => void;
}) {
  const byId = new Map(jobs.map((job) => [job.id, job]));
  const sortedApps = [...applications].sort((a, b) => whenValue(b.appliedAt) - whenValue(a.appliedAt));
  const sortedViews = [...views].sort((a, b) => whenValue(b.viewedAt) - whenValue(a.viewedAt));

  const row = (key: string, jobId: number, title: string, company: string, when: unknown) => {
    const job = byId.get(jobId);
    return (
      <div className="local-job" key={key}>
        <span><b>{title}</b><small>{company} · {formatWhen(when)}</small></span>
        <div className="local-job-actions">
          {job
            ? <button className="edit-local" onClick={() => onOpen(job)}>Open</button>
            : <span className="text-xs text-accent italic">No longer listed</span>}
        </div>
      </div>
    );
  };

  return (
    <section className="results" aria-labelledby="history-title">
      <div className="results-head"><div><span>HISTORY</span><h1 id="history-title">Your activity</h1></div><p>Jobs you applied to and recently viewed. Open any item to see its full details again.</p></div>

      <section className="local-jobs" aria-labelledby="history-applied-title">
        <div className="local-jobs-head"><div><span className="detail-label">APPLIED</span><h3 id="history-applied-title">Jobs you applied to</h3></div><strong>{sortedApps.length}</strong></div>
        {sortedApps.length
          ? <div className="local-job-list">{sortedApps.map((a) => row(`app-${a.id}`, a.jobId, a.jobTitle, a.company, a.appliedAt))}</div>
          : <div className="admin-jobs-empty"><strong>No applications yet</strong><p>Open a vacancy and choose Apply to record your interest.</p></div>}
      </section>

      <section className="local-jobs" aria-labelledby="history-viewed-title">
        <div className="local-jobs-head"><div><span className="detail-label">VIEWED</span><h3 id="history-viewed-title">Jobs you viewed</h3></div><strong>{sortedViews.length}</strong></div>
        {sortedViews.length
          ? <div className="local-job-list">{sortedViews.map((v) => row(`view-${v.id}`, v.jobId, v.jobTitle, v.company, v.viewedAt))}</div>
          : <div className="admin-jobs-empty"><strong>Nothing viewed yet</strong><p>Vacancies you open will appear here.</p></div>}
      </section>
    </section>
  );
}
