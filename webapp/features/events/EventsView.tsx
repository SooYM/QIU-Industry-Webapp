import { useState } from "react";
import type { AppSettings, Attendance, EventItem } from "../../lib/data/types";
import { eventSpecializations, eventSpeakers } from "../../lib/data/types";
import { deleteEvent } from "../../lib/data/firestore";
import { EventForm } from "./EventForm";
import { EventPresenter } from "./EventPresenter";
import { EventAttendance } from "./EventAttendance";
import { SpeakerAvatar } from "./SpeakerAvatar";
import { notify } from "../../components/toast";
import { courseToSpecializationPattern } from "../../lib/data/course-map";

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

function eventMatchesCourse(event: EventItem, course: string | null): boolean {
  if (!course) return false;
  const specs = eventSpecializations(event);
  if (!specs.length) return false;
  const pattern = courseToSpecializationPattern(course);
  if (!pattern) return false;
  return specs.some((s) => pattern.test(s));
}

export function EventsView({
  events,
  canManageEvents,
  userEmail,
  myAttendance,
  settings,
  course,
  isStudent,
  onOpenEvent,
}: {
  events: EventItem[];
  canManageEvents: boolean;
  userEmail: string;
  myAttendance: Attendance[];
  settings: AppSettings;
  course: string | null;
  isStudent: boolean;
  onOpenEvent: (event: EventItem) => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EventItem | null>(null);
  const [presenting, setPresenting] = useState<EventItem | null>(null);
  const [viewing, setViewing] = useState<EventItem | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"default" | "newest" | "oldest">("default");

  const myLower = userEmail.trim().toLowerCase();
  const attendanceByEvent = new Map(myAttendance.map((a) => [a.eventId, a]));
  const order = { live: 0, upcoming: 1, ended: 2 } as const;
  const q = query.trim().toLowerCase();
  const filtered = [...events].filter((e) => !q || [e.title, e.location, e.speakerName].some((f) => (f ?? "").toLowerCase().includes(q)));
  const sorted = sort === "newest" ? filtered.sort((a, b) => b.startAt.localeCompare(a.startAt))
    : sort === "oldest" ? filtered.sort((a, b) => a.startAt.localeCompare(b.startAt))
    : filtered.sort((a, b) => order[eventStatus(a)] - order[eventStatus(b)] || a.startAt.localeCompare(b.startAt));

  return (
    <section className="results" aria-labelledby="events-title">
      <div className="results-head">
        <div><span>EVENTS</span><h1 id="events-title">Live &amp; upcoming events</h1></div>
        {canManageEvents && <button className="admin-button" onClick={() => { setEditing(null); setFormOpen(true); }}>＋ Add event</button>}
      </div>

      <div className="event-toolbar">
        <input type="search" className="admin-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events by title, location or speaker…" aria-label="Search events" />
        <label className="event-sort">Sort<select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}><option value="default">Live first</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
      </div>

      {sorted.length ? (
        <div className="event-grid">
          {sorted.map((ev) => {
            const st = eventStatus(ev);
            const meta = statusMeta[st];
            const att = attendanceByEvent.get(ev.id);
            const canPresent = canManageEvents || (ev.presenters ?? []).includes(myLower);
            const speakers = eventSpeakers(ev);
            return (
              <article className="event-card" key={ev.id} role="button" tabIndex={0}
                aria-label={`View ${ev.title}`}
                onClick={() => onOpenEvent(ev)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenEvent(ev); } }}>
                <div className="card-top">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${meta.tone}`}>{meta.label}</span>
                  {att && <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${att.caEligible ? "tone-success" : att.checkOutMs ? "tone-danger" : "tone-neutral"}`}>
                    {att.caEligible ? "✓ CCA eligible" : att.checkOutMs ? "Below threshold" : "Checked in"}
                  </span>}
                </div>
                <h2>{ev.title}</h2>
                <p className="text-accent text-xs">{when(ev.startAt)} → {when(ev.endAt)}{ev.location ? ` · ${ev.location}` : ""}</p>
                <div className="event-speaker">
                  <span className="detail-label">SPEAKER(S)</span>
                  {speakers.length ? (
                    <div className="event-speaker-list">
                      {speakers.slice(0, 4).map((s, i) => (
                        <div className="event-speaker-row" key={i}>
                          <SpeakerAvatar photo={s.photoUrl} name={s.name} />
                          <p className="text-sm"><b>{s.name || "Speaker"}</b></p>
                        </div>
                      ))}
                      {speakers.length > 4 && <p className="text-[11px] text-accent">+{speakers.length - 4} more</p>}
                    </div>
                  ) : (
                    <div className="event-speaker-row"><SpeakerAvatar name="" /><p className="text-sm text-accent">To be announced</p></div>
                  )}
                </div>
                {eventSpecializations(ev).length > 0 && (
                  <div className="event-specs">
                    {eventSpecializations(ev).map((s) => <span key={s} className="exhibitor-tag">{s}</span>)}
                    {isStudent && eventMatchesCourse(ev, course) && <span className="rounded px-1.5 py-0.5 text-[10px] font-bold tone-success">🌟 Relevant to you</span>}
                  </div>
                )}
                <p className="view-job mt-2">View details <span>→</span></p>
                {(canPresent || canManageEvents) && (
                  <div className="event-actions" onClick={(e) => e.stopPropagation()}>
                    {canPresent && <button className="edit-local" onClick={() => setPresenting(ev)}>▶ Present QR</button>}
                    {canManageEvents && <button className="edit-local" onClick={() => setViewing(ev)}>Attendance</button>}
                    {canManageEvents && <button className="edit-local" onClick={() => { setEditing(ev); setFormOpen(true); }}>Edit</button>}
                    {canManageEvents && <button className="delete-local" onClick={() => { if (confirm(`Delete "${ev.title}"?`)) deleteEvent(ev.id).then(() => notify(`Deleted “${ev.title}”.`)).catch(() => notify("Could not delete event.", "error")); }}>Delete</button>}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty"><strong>No events yet</strong><p>{canManageEvents ? "Add the first event to get started." : "Events will appear here soon."}</p></div>
      )}

      {formOpen && <EventForm editing={editing} userEmail={userEmail} defaultRotateSeconds={settings.qrRotateSeconds} onClose={() => { setFormOpen(false); setEditing(null); }} />}
      {presenting && <EventPresenter event={presenting} rotateSeconds={presenting.qrRotateSeconds ?? settings.qrRotateSeconds} ccaSettings={{ ccaPercent: settings.ccaPercent, ccaFloorMinutes: settings.ccaFloorMinutes }} onClose={() => setPresenting(null)} />}
      {viewing && <EventAttendance event={viewing} onClose={() => setViewing(null)} />}
    </section>
  );
}
