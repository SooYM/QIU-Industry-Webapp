import { useState } from "react";
import type { Attendance, EventItem } from "../../lib/data/types";
import { deleteEvent } from "../../lib/data/firestore";
import { EventForm } from "./EventForm";
import { EventPresenter } from "./EventPresenter";
import { EventAttendance } from "./EventAttendance";

function eventStatus(ev: EventItem): "upcoming" | "live" | "ended" {
  const now = Date.now();
  const start = new Date(ev.startAt).getTime();
  const end = new Date(ev.endAt).getTime();
  if (Number.isFinite(start) && now < start) return "upcoming";
  if (Number.isFinite(end) && now > end) return "ended";
  return "live";
}

const statusMeta: Record<string, { label: string; tone: string }> = {
  live: { label: "● Live now", tone: "tone-success" },
  upcoming: { label: "Upcoming", tone: "tone-accent" },
  ended: { label: "Ended", tone: "tone-neutral" },
};

function when(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function EventsView({
  events,
  canManageEvents,
  userEmail,
  myAttendance,
}: {
  events: EventItem[];
  canManageEvents: boolean;
  userEmail: string;
  myAttendance: Attendance[];
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EventItem | null>(null);
  const [presenting, setPresenting] = useState<EventItem | null>(null);
  const [viewing, setViewing] = useState<EventItem | null>(null);

  const attendanceByEvent = new Map(myAttendance.map((a) => [a.eventId, a]));
  // Live + upcoming first, ended last.
  const order = { live: 0, upcoming: 1, ended: 2 } as const;
  const sorted = [...events].sort((a, b) => order[eventStatus(a)] - order[eventStatus(b)] || a.startAt.localeCompare(b.startAt));

  return (
    <section className="results" aria-labelledby="events-title" style={{ maxWidth: 1100, margin: "0 auto", width: "100%", padding: "2rem clamp(1rem,4vw,3rem)" }}>
      <div className="results-head">
        <div><span>EVENTS</span><h1 id="events-title">Live &amp; upcoming events</h1></div>
        {canManageEvents && <button className="admin-button" onClick={() => { setEditing(null); setFormOpen(true); }}>＋ Add event</button>}
      </div>

      {sorted.length ? (
        <div className="event-grid">
          {sorted.map((ev) => {
            const status = eventStatus(ev);
            const meta = statusMeta[status];
            const att = attendanceByEvent.get(ev.id);
            return (
              <article className="event-card" key={ev.id}>
                <div className="card-top">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${meta.tone}`}>{meta.label}</span>
                  {att && <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${att.caEligible ? "tone-success" : att.checkOutMs ? "tone-danger" : "tone-neutral"}`}>
                    {att.caEligible ? "✓ CCA eligible" : att.checkOutMs ? "Below threshold" : "Checked in"}
                  </span>}
                </div>
                <h2>{ev.title}</h2>
                <p className="text-accent text-xs">{when(ev.startAt)} → {when(ev.endAt)}{ev.location ? ` · ${ev.location}` : ""}</p>
                {ev.description && <p className="text-sm mt-1" style={{ whiteSpace: "pre-wrap" }}>{ev.description}</p>}
                <div className="event-speaker">
                  <span className="detail-label">SPEAKER</span>
                  {ev.speakerName || ev.speakerEmail
                    ? <p className="text-sm"><b>{ev.speakerName || "TBA"}</b>{ev.speakerEmail ? <> · <a href={`mailto:${ev.speakerEmail}`}>{ev.speakerEmail}</a></> : null}</p>
                    : <p className="text-accent text-sm">Speaker to be announced.</p>}
                </div>
                {!canManageEvents && (
                  <p className="text-accent text-xs mt-2">
                    {status === "live" ? "Scan the QR on the hall screen to check in / out." : status === "upcoming" ? "Attendance opens when the session starts." : "This session has ended."}
                  </p>
                )}
                {canManageEvents && (
                  <div className="event-actions">
                    <button className="edit-local" onClick={() => setPresenting(ev)}>▶ Present QR</button>
                    <button className="edit-local" onClick={() => setViewing(ev)}>Attendance</button>
                    <button className="edit-local" onClick={() => { setEditing(ev); setFormOpen(true); }}>Edit</button>
                    <button className="delete-local" onClick={() => { if (confirm(`Delete "${ev.title}"?`)) deleteEvent(ev.id); }}>Delete</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="admin-jobs-empty"><strong>No events yet</strong><p>{canManageEvents ? "Add the first event to get started." : "Events will appear here soon."}</p></div>
      )}

      {!canManageEvents && myAttendance.length > 0 && (
        <section className="local-jobs" aria-labelledby="my-attendance-title">
          <div className="local-jobs-head"><div><span className="detail-label">MY ATTENDANCE</span><h3 id="my-attendance-title">Events you attended</h3></div><strong>{myAttendance.length}</strong></div>
          <div className="local-job-list">
            {myAttendance.map((a) => (
              <div className="local-job" key={a.id}>
                <span>
                  <b>{a.eventTitle} {a.caEligible ? <span className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold tone-success">CCA eligible</span> : a.checkOutMs ? <span className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold tone-danger">Below threshold</span> : <span className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold tone-neutral">Checked in</span>}</b>
                  <small>{a.durationMinutes != null ? `${a.durationMinutes} min attended` : "In progress — check out before you leave"}</small>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {formOpen && <EventForm editing={editing} userEmail={userEmail} onClose={() => { setFormOpen(false); setEditing(null); }} />}
      {presenting && <EventPresenter event={presenting} onClose={() => setPresenting(null)} />}
      {viewing && <EventAttendance event={viewing} onClose={() => setViewing(null)} />}
    </section>
  );
}
