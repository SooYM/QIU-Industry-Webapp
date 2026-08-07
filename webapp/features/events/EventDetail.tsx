import { useState } from "react";
import type { AppSettings, Attendance, EventItem } from "../../lib/data/types";
import { eventSpecializations, eventSpeakers } from "../../lib/data/types";
import { ccaThresholdMinutes, toggleEventInterest } from "../../lib/data/firestore";
import { generateGoogleCalendarUrl } from "../../lib/calendar";
import { Modal } from "../../components/Modal";
import { TalkLiveChat } from "./TalkLiveChat";
import { TalkFeedback } from "./TalkFeedback";
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

/** Server timestamps land a beat after the local echo; show nothing until then. */

const statusMeta = { live: { label: "● Live now", tone: "tone-success" }, upcoming: { label: "Upcoming", tone: "tone-accent" }, ended: { label: "Past", tone: "tone-neutral" } };

export function EventDetail({
  event,
  canManageEvents,
  userEmail,
    userName,
    userUid,
  attendance,
    isInterested,
    interestedCount,
  onInterestChanged,
  settings,
  onClose,
}: {
  event: EventItem;
  canManageEvents: boolean;
  userEmail: string;
  userName?: string;
  userUid?: string;
  attendance: Attendance | null;
  isInterested?: boolean;
  interestedCount?: number;
  onInterestChanged?: () => void;
  settings: Pick<AppSettings, "ccaPercent">;
  onClose: () => void;
}) {
  const st = status(event);
  const meta = statusMeta[st];
  const isPresenter = canManageEvents || (event.presenters ?? []).includes(userEmail.trim().toLowerCase());
  const threshold = ccaThresholdMinutes(event.sessionMinutes, settings);
  const hasValidDuration = event.sessionMinutes > 0;
  const speakers = eventSpeakers(event);

  // Interest + count come straight from the live subscriptions in page.tsx, so
  // there is no local copy that can disagree with what other students see.
  const interested = Boolean(isInterested);
  const interestCount = interestedCount ?? 0;
  const [interestError, setInterestError] = useState("");





  const handleInterestToggle = async () => {
    if (!userUid) return;
    setInterestError("");
    // Opened BEFORE the await: window.open() in a continuation has lost the
    // user-activation token, so Chrome and Safari block it as a popup — silently
    // killing the reminder this button exists to create. Marking interest and
    // adding the calendar entry are one action, so the two stay in step.
    const calendarTab = interested ? null : window.open(generateGoogleCalendarUrl(event), "_blank", "noopener");
    try {
      await toggleEventInterest(event.id, userUid, userEmail, userName || userEmail);
      onInterestChanged?.();
    } catch {
      calendarTab?.close();
      setInterestError("Could not save your interest. Please try again.");
    }
  };







  const liveChat = (
    <TalkLiveChat
      eventId={event.id}
      isPresenter={isPresenter}
      attended={Boolean(attendance)}
      userUid={userUid}
      userName={userName}
      userEmail={userEmail}
    />
  );

  return (
    <Modal className="job-detail max-w-3xl" labelledBy="event-detail-title" closeLabel="Close event details" onClose={onClose}>
      <div className="detail-header">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${meta.tone}`}>{meta.label}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded tone-neutral">
              {interestCount} interested
            </span>
          </div>
          <h2 id="event-detail-title">{event.title}</h2>
          <p>{when(event.startAt)}{event.location ? ` · ${event.location}` : ""}</p>
        </div>
      </div>

      <div className="detail-main">
        {/* Action Bar for Calendar & Interest */}
        <section className="p-3 ui-panel flex flex-wrap items-center gap-3">
          {userUid && !canManageEvents && (
            <button
              type="button"
              onClick={handleInterestToggle}
              aria-pressed={interested}
              className={`rounded-lg text-xs font-semibold ui-btn ${interested ? "ui-btn-primary" : "ui-btn-quiet"}`}
            >
              {interested ? "★ Interested — reminder added" : "☆ Mark as interested"} ({interestCount})
            </button>
          )}
          <span className="text-xs ui-muted">
            {interested
              ? "This talk is in your calendar. Click again to remove your interest."
              : "Marking interest adds this talk to your Google Calendar as a reminder."}
          </span>
          {interestError && <p className="w-full p-2 text-xs ui-note-danger">{interestError}</p>}
        </section>

        {/* While a talk is running the Q&A is the only live thing on this screen;
            below a speaker bio and a details table it is three scrolls down on a
            phone. Hoist it for `live`, and leave the reading order alone otherwise. */}
        {st === "live" && liveChat}

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

        {st !== "live" && liveChat}

        {st === "ended" && (
          <TalkFeedback
            event={event}
            userUid={userUid}
            userEmail={userEmail}
            userName={userName}
            attended={Boolean(attendance)}
            canManageEvents={canManageEvents}
          />
        )}

        {isPresenter && !canManageEvents && st !== "ended" && (
          <p className="text-accent text-xs">You are assigned to present this event&apos;s QR. Use the ▶ Present QR button on the event card.</p>
        )}
      </div>
    </Modal>
  );
}
