import type { AppSettings, Attendance, EventItem } from "../../lib/data/types";
import { ccaThresholdMinutes } from "../../lib/data/firestore";
import { Modal } from "../../components/Modal";

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
const statusMeta = { live: { label: "● Live now", tone: "tone-success" }, upcoming: { label: "Upcoming", tone: "tone-accent" }, ended: { label: "Ended", tone: "tone-neutral" } };

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
  settings: Pick<AppSettings, "ccaPercent" | "ccaFloorMinutes">;
  onClose: () => void;
}) {
  const st = status(event);
  const meta = statusMeta[st];
  const isPresenter = canManageEvents || (event.presenters ?? []).includes(userEmail.trim().toLowerCase());
  const threshold = ccaThresholdMinutes(event.sessionMinutes, settings);
  const speakerLinks = (event.speakerLinks ?? []).filter(Boolean);

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

        <section><span className="detail-label">SPEAKER</span>
          {event.speakerName || speakerLinks.length || event.speakerPhotoUrl ? (
            <div className="speaker-block">
              {event.speakerPhotoUrl && <img className="speaker-photo" src={event.speakerPhotoUrl} alt={event.speakerName || "Speaker"} />}
              <div>
                <p><b>{event.speakerName || "TBA"}</b></p>
                {speakerLinks.length > 0 && (
                  <p className="speaker-links">
                    {speakerLinks.map((href) => (
                      <a key={href} href={/^https?:\/\//i.test(href) ? href : `https://${href}`} target="_blank" rel="noreferrer">{href.replace(/^https?:\/\//i, "")} ↗</a>
                    ))}
                  </p>
                )}
              </div>
            </div>
          ) : <p className="text-accent">To be announced.</p>}
        </section>

        <section><span className="detail-label">DETAILS</span>
          <dl>
            <div><dt>Starts</dt><dd>{when(event.startAt)}</dd></div>
            <div><dt>Ends</dt><dd>{when(event.endAt)}</dd></div>
            <div><dt>Session length</dt><dd>{event.sessionMinutes} min</dd></div>
            <div><dt>CCA eligible at</dt><dd>≥ {threshold} min attended</dd></div>
          </dl>
        </section>

        {!canManageEvents && (
          <section>
            <span className="detail-label">YOUR ATTENDANCE</span>
            {attendance ? (
              <p className={`rounded-lg px-3 py-2 text-xs font-bold ${attendance.caEligible ? "tone-success" : attendance.checkOutMs ? "tone-danger" : "tone-neutral"}`}>
                {attendance.caEligible ? `✓ CCA eligible — ${attendance.durationMinutes} min attended`
                  : attendance.checkOutMs ? `Checked out — ${attendance.durationMinutes} min (below ${threshold} min)`
                  : "Checked in — remember to check out at the end to earn CCA."}
              </p>
            ) : (
              <p className="text-accent text-sm">
                {st === "live" ? "Scan the QR on the hall screen to check in, then again at the end to check out." : st === "upcoming" ? "Attendance opens when the session starts." : "This session has ended."}
              </p>
            )}
          </section>
        )}

        {isPresenter && !canManageEvents && (
          <p className="text-accent text-xs">You are assigned to present this event&apos;s QR. Use the ▶ Present QR button on the event card.</p>
        )}
      </div>
    </Modal>
  );
}
