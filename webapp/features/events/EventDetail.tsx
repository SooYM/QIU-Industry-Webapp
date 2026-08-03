import type { AppSettings, Attendance, EventItem } from "../../lib/data/types";
import { eventSpecializations, eventSpeakers } from "../../lib/data/types";
import { ccaThresholdMinutes } from "../../lib/data/firestore";
import { Modal } from "../../components/Modal";
import { SpeakerAvatar } from "./SpeakerAvatar";

function status(ev: EventItem): "upcoming" | "live" | "ended" {
  const now = Date.now();
  const s = new Date(ev.startAt).getTime();
  const e = new Date(ev.endAt).getTime();
  if (Number.isFinite(s) && now < s) return "upcoming";
  if (Number.isFinite(e) && now > e) return "ended";
  return "live";
}
function when(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}
const statusMeta = { live: { label: "● Live now", tone: "tone-success" }, upcoming: { label: "Upcoming", tone: "tone-accent" }, ended: { label: "Past", tone: "tone-neutral" } };

export function EventDetail({
  event,
  canManageEvents,
  userEmail,
  attendance,
  settings,
  onClose,
}: {
  event: EventItem;
  canManageEvents: boolean;
  userEmail: string;
  attendance: Attendance | null;
  settings: Pick<AppSettings, "ccaPercent">;
  onClose: () => void;
}) {
  const st = status(event);
  const meta = statusMeta[st];
  const isPresenter = canManageEvents || (event.presenters ?? []).includes(userEmail.trim().toLowerCase());
  const threshold = ccaThresholdMinutes(event.sessionMinutes, settings);
  const hasValidDuration = event.sessionMinutes > 0;
  const speakers = eventSpeakers(event);

  return (
    <Modal className="job-detail" labelledBy="event-detail-title" closeLabel="Close event details" onClose={onClose}>
      <div className="detail-header">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${meta.tone}`}>{meta.label}</span>
          </div>
          <h2 id="event-detail-title">{event.title}</h2>
          <p>{when(event.startAt)}{event.location ? ` · ${event.location}` : ""}</p>
        </div>
      </div>

      <div className="detail-main">
        {event.description && <section><span className="detail-label">ABOUT</span><p style={{ whiteSpace: "pre-wrap" }}>{event.description}</p></section>}

        <section><span className="detail-label">SPEAKER(S)</span>
          {speakers.length ? speakers.map((sp, i) => (
            <div className="speaker-block" key={i}>
              <SpeakerAvatar photo={sp.photoUrl} name={sp.name} className="speaker-photo" />
              <div>
                <p><b>{sp.name || "Speaker"}</b></p>
                {(sp.links ?? []).filter(Boolean).length > 0 && (
                  <p className="speaker-links">
                    {(sp.links ?? []).filter(Boolean).map((href) => (
                      <a key={href} href={/^https?:\/\//i.test(href) ? href : `https://${href}`} target="_blank" rel="noreferrer">{href.replace(/^https?:\/\//i, "")} ↗</a>
                    ))}
                  </p>
                )}
              </div>
            </div>
          )) : (
            <div className="speaker-block"><SpeakerAvatar name="" className="speaker-photo" /><div><p className="text-accent">To be announced</p></div></div>
          )}
        </section>

        <section><span className="detail-label">DETAILS</span>
          <dl>
            <div><dt>Starts</dt><dd>{when(event.startAt)}</dd></div>
            <div><dt>Ends</dt><dd>{when(event.endAt)}</dd></div>
            <div><dt>Session length</dt><dd>{hasValidDuration ? `${event.sessionMinutes} min` : "Needs correction"}</dd></div>
            <div><dt>CCA eligible at</dt><dd>{hasValidDuration ? `≥ ${threshold} min attended` : "Unavailable"}</dd></div>
          </dl>
        </section>

        {eventSpecializations(event).length > 0 && (
          <section><span className="detail-label">TARGET FIELDS</span>
            <div className="event-specs mt-1">{eventSpecializations(event).map((s) => <span key={s} className="exhibitor-tag">{s}</span>)}</div>
          </section>
        )}

        {!canManageEvents && (
          <section>
            <span className="detail-label">YOUR ATTENDANCE</span>
            {attendance ? (
              <p className={`rounded-lg px-3 py-2 text-xs font-bold ${attendance.caEligible ? "tone-success" : attendance.checkOutMs ? "tone-danger" : "tone-neutral"}`}>
                {attendance.caEligible ? `✓ CCA eligible — ${attendance.durationMinutes} min attended`
                  : attendance.checkOutMs ? hasValidDuration ? `Checked out — ${attendance.durationMinutes} min (below ${threshold} min)` : `Checked out — ${attendance.durationMinutes} min (event duration needs correction)`
                  : "Checked in — remember to check out at the end to earn CCA."}
              </p>
            ) : (
              <p className="text-accent text-sm">
                {st === "live" ? "Scan the QR on the hall screen to check in, then again at the end to check out." : st === "upcoming" ? "Attendance opens when the session starts." : "This session has ended."}
              </p>
            )}
          </section>
        )}

        {isPresenter && !canManageEvents && st !== "ended" && (
          <p className="text-accent text-xs">You are assigned to present this event&apos;s QR. Use the ▶ Present QR button on the event card.</p>
        )}
      </div>
    </Modal>
  );
}
