import { useEffect, useState } from "react";
import type { Application, Attendance, InterviewSlot, Job, ViewEvent } from "../../lib/data/types";
import { cancelInterviewBooking, deleteApplication, subscribeMyInterviewBookings } from "../../lib/data/firestore";
import { offerLabel } from "../admin/MockInterviews";

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
  attendance = [],
  studentUid,
  onOpen,
}: {
  jobs: Job[];
  applications: Application[];
  views: ViewEvent[];
  attendance?: Attendance[];
  studentUid?: string;
  onOpen: (job: Job) => void;
}) {
  const [query, setQuery] = useState("");
  const [myBookings, setMyBookings] = useState<InterviewSlot[]>([]);
  const [bookingMessage, setBookingMessage] = useState("");

  useEffect(() => {
    if (!studentUid) return;
    return subscribeMyInterviewBookings(studentUid, setMyBookings);
  }, [studentUid]);

  const withdraw = async (slot: InterviewSlot) => {
    if (!studentUid) return;
    if (!window.confirm(`Withdraw from the ${slot.startTime}–${slot.endTime} session with ${slot.companyName} on ${slot.date}?`)) return;
    setBookingMessage("");
    try {
      await cancelInterviewBooking(slot.id, studentUid);
      setBookingMessage("Booking withdrawn.");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";
      setBookingMessage(`Could not withdraw${code ? ` (${code})` : ""}. Please try again.`);
    }
  };
  const q = query.trim().toLowerCase();
  const matchJob = (title: string, company: string) => !q || title.toLowerCase().includes(q) || company.toLowerCase().includes(q);
  const attended = [...attendance]
    .filter((a) => !q || (a.eventTitle ?? "").toLowerCase().includes(q))
    .sort((a, b) => (b.checkInMs ?? 0) - (a.checkInMs ?? 0));
  const byId = new Map(jobs.map((job) => [job.id, job]));
  const sortedApps = [...applications].filter((a) => matchJob(a.jobTitle, a.company)).sort((a, b) => whenValue(b.appliedAt) - whenValue(a.appliedAt));
  const sortedViews = [...views].filter((v) => matchJob(v.jobTitle, v.company)).sort((a, b) => whenValue(b.viewedAt) - whenValue(a.viewedAt));

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

      <input type="search" className="admin-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your applied and viewed jobs…" aria-label="Search history" />

      <section className="local-jobs" aria-labelledby="history-applied-title">
        <div className="local-jobs-head"><div><span className="detail-label">APPLIED</span><h3 id="history-applied-title">Jobs you applied to</h3></div><strong>{sortedApps.length}</strong></div>
        {sortedApps.length
          ? <div className="local-job-list">{sortedApps.map((a) => {
              const job = byId.get(a.jobId);
              return (
                <div className="local-job" key={`app-${a.id}`}>
                  <span><b>{a.jobTitle}</b><small>{a.company} · {formatWhen(a.appliedAt)}</small></span>
                  <div className="local-job-actions">
                    {job && <button className="edit-local" onClick={() => onOpen(job)}>Open</button>}
                    <button className="delete-local" onClick={() => { if (confirm(`Withdraw your application to ${a.jobTitle}?`)) deleteApplication(a.id).catch(() => {}); }}>Withdraw</button>
                  </div>
                </div>
              );
            })}</div>
          : <div className="admin-jobs-empty"><strong>No applications yet</strong><p>Open a vacancy and choose Apply to record your interest.</p></div>}
      </section>

      <section className="local-jobs" aria-labelledby="history-viewed-title">
        <div className="local-jobs-head"><div><span className="detail-label">VIEWED</span><h3 id="history-viewed-title">Jobs you viewed</h3></div><strong>{sortedViews.length}</strong></div>
        {sortedViews.length
          ? <div className="local-job-list">{sortedViews.map((v) => row(`view-${v.id}`, v.jobId, v.jobTitle, v.company, v.viewedAt))}</div>
          : <div className="admin-jobs-empty"><strong>Nothing viewed yet</strong><p>Vacancies you open will appear here.</p></div>}
      </section>

      <section className="local-jobs" aria-labelledby="history-sessions-title">
        <div className="local-jobs-head">
          <div><span className="detail-label">SESSIONS BOOKED</span><h3 id="history-sessions-title">Your mock interviews &amp; consultancies</h3></div>
          <strong>{myBookings.length}</strong>
        </div>
        {bookingMessage && <div className="p-3 text-sm ui-note-success">{bookingMessage}</div>}
        {myBookings.length ? (
          <div className="local-job-list">
            {[...myBookings]
              .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
              .map((slot) => {
                const seat = (slot.bookedStudents ?? []).find((b) => b.studentUid === studentUid);
                const kind = seat?.sessionType === "consultancy" ? "Consultancy" : seat?.sessionType === "interview" ? "Mock interview" : offerLabel(slot.offers);
                return (
                  <div className="local-job" key={slot.id}>
                    <span>
                      <b>{slot.companyName}</b>
                      <small>{kind} · {slot.date} at {slot.startTime}–{slot.endTime}{slot.location ? ` · ${slot.location}` : ""}</small>
                    </span>
                    <div className="local-job-actions">
                      <button className="delete-local" onClick={() => withdraw(slot)}>Withdraw</button>
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="admin-jobs-empty">
            <strong>No sessions booked</strong>
            <p>Open a company profile and choose &ldquo;Book mock interview or consultancy&rdquo;.</p>
          </div>
        )}
      </section>

      <section className="local-jobs" aria-labelledby="history-events-title">
        <div className="local-jobs-head"><div><span className="detail-label">EVENTS ATTENDED</span><h3 id="history-events-title">Events you attended</h3></div><strong>{attended.length}</strong></div>
        {attended.length
          ? <div className="local-job-list">{attended.map((a) => (
              <div className="local-job" key={`att-${a.id}`}>
                <span><b>{a.eventTitle} {a.caEligible ? <span className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold tone-success">CCA eligible</span> : a.checkOutMs ? <span className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold tone-danger">Below threshold</span> : <span className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold tone-neutral">Checked in</span>}</b><small>{a.durationMinutes != null ? `${a.durationMinutes} min attended` : "In progress — check out before you leave"}</small></span>
              </div>
            ))}</div>
          : <div className="admin-jobs-empty"><strong>No events attended yet</strong><p>Scan the QR at an event to check in — your attendance shows here.</p></div>}
      </section>
    </section>
  );
}
