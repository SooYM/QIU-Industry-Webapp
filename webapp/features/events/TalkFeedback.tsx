import { useEffect, useState, type FormEvent } from "react";
import type { EventFeedback, EventItem } from "../../lib/data/types";
import { submitEventFeedback, subscribeEventFeedbacks } from "../../lib/data/firestore";

/**
 * Student reviews of a finished talk.
 *
 * Only attendees may write one — "the student who attended can provide
 * feedback". That is enforced in the security rules by an `exists()` check
 * against the attendance record, not just hidden in this UI; `attended` here
 * only decides whether to show the form.
 */
export function TalkFeedback({
  event,
  userUid,
  userEmail,
  userName,
  attended,
  canManageEvents,
}: {
  event: EventItem;
  userUid?: string;
  userEmail: string;
  userName?: string;
  attended: boolean;
  canManageEvents: boolean;
}) {
  const [feedbacks, setFeedbacks] = useState<EventFeedback[]>([]);
  const [ratingInput, setRatingInput] = useState<number | null>(null);
  const [commentInput, setCommentInput] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => subscribeEventFeedbacks(event.id, setFeedbacks), [event.id]);

  const mine = feedbacks.find((f) => f.studentUid === userUid);
  // Editing starts from what the student actually wrote. Derived rather than
  // synced in an effect, so the form is never briefly showing stale values.
  const rating = ratingInput ?? mine?.rating ?? 5;
  const comment = commentInput ?? mine?.comment ?? "";

  const average = feedbacks.length
    ? (feedbacks.reduce((total, f) => total + f.rating, 0) / feedbacks.length).toFixed(1)
    : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!userUid) return;
    setError("");
    setSuccess(false);
    try {
      await submitEventFeedback({
        id: `${event.id}_${userUid}`,
        eventId: event.id,
        eventTitle: event.title,
        studentUid: userUid,
        studentEmail: userEmail,
        studentName: userName || "Student",
        rating,
        comment: comment.trim(),
      });
      setSuccess(true);
    } catch (err: unknown) {
      // Don't assert one cause: a denied write, an offline client and a missing
      // attendance record are different problems and need different wording.
      const code = (err as { code?: string })?.code ?? "";
      setError(code === "permission-denied"
        ? "Your review was rejected. Reviews are only open to students who checked in to this talk."
        : `Could not submit your review${code ? ` (${code})` : ""}. Please try again.`);
    }
  };

  return (
    <section className="ui-card p-4 space-y-4">
      <div>
        <span className="detail-label">TALK FEEDBACK &amp; REVIEWS</span>
        {average && (
          <div className="text-sm font-bold ui-stars mt-1">
            ★ {average} / 5.0 ({feedbacks.length} student review{feedbacks.length === 1 ? "" : "s"})
          </div>
        )}
      </div>

      {userUid && !canManageEvents && !attended && (
        <p className="text-xs ui-muted italic">Only students who checked in to this talk can leave a review.</p>
      )}

      {userUid && attended && (
        <form onSubmit={handleSubmit} className="p-3 ui-panel space-y-2">
          <h4 className="font-semibold text-xs ui-strong">{mine ? "Update your review" : "Leave feedback for this talk"}</h4>
          {success && <div className="p-2 text-xs ui-note-success">Thank you — your review has been saved.</div>}
          {error && <div className="p-2 text-xs ui-note-danger">{error}</div>}

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs ui-muted" htmlFor={`rating-${event.id}`}>Rating</label>
            <select
              id={`rating-${event.id}`}
              value={rating}
              onChange={(e) => setRatingInput(Number(e.target.value))}
              className="ui-field ui-field-inline font-bold ui-stars"
            >
              <option value={5}>★★★★★ (5 — Excellent)</option>
              <option value={4}>★★★★☆ (4 — Very good)</option>
              <option value={3}>★★★☆☆ (3 — Good)</option>
              <option value={2}>★★☆☆☆ (2 — Fair)</option>
              <option value={1}>★☆☆☆☆ (1 — Poor)</option>
            </select>
          </div>

          <textarea
            value={comment}
            onChange={(e) => setCommentInput(e.target.value)}
            placeholder="Share your thoughts about this speaker or the talk content…"
            rows={2}
            maxLength={2000}
            className="w-full ui-field"
            required
          />

          <button type="submit" className="ui-btn ui-btn-primary text-xs">Submit review</button>
        </form>
      )}

      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
        {feedbacks.length === 0 ? (
          <p className="text-xs ui-muted italic">No reviews submitted yet.</p>
        ) : (
          feedbacks.map((fb) => (
            <div key={fb.id} className="p-2.5 ui-panel text-xs">
              <div className="flex flex-wrap justify-between items-center gap-2 mb-1">
                <span className="font-semibold ui-strong">{fb.studentName}</span>
                <span className="font-bold ui-stars">{"★".repeat(fb.rating)}</span>
              </div>
              <p className="ui-muted">{fb.comment}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
