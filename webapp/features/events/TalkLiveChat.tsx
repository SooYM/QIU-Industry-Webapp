import { useEffect, useRef, useState, type FormEvent } from "react";
import type { TalkLiveChatMessage } from "../../lib/data/types";
import {
  approveTalkLiveChatMessage, deleteTalkLiveChatMessage, sendTalkLiveChatMessage,
  subscribeEventLiveChatState, subscribeTalkLiveChat, toggleEventLiveChat,
} from "../../lib/data/firestore";
import { checkToxicContent } from "../../lib/toxic-filter";

/** Server timestamps land a beat after the local echo; show nothing until then. */
function chatTime(createdAt: unknown): string {
  const ms = (createdAt as { toMillis?: () => number } | undefined)?.toMillis?.();
  return ms ? new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
}

/**
 * The live Q&A box for one talk.
 *
 * Closed by default and opened by an admin or the presenter assigned to this
 * event. The open/closed flag is its own document (`event_live_chat`) rather
 * than a field on the event, because presenters are not admins and cannot write
 * the event doc — and the security rules reject messages while it is closed, so
 * a crafted client cannot post into a closed session.
 *
 * Questions are moderated: a student's question is held as `approved:false` and
 * only surfaces to the room once a facilitator approves it. Approved questions
 * can then be projected one at a time in presentation mode.
 */
export function TalkLiveChat({
  eventId,
  isPresenter,
  attended = false,
  userUid,
  userName,
  userEmail,
}: {
  eventId: number;
  isPresenter: boolean;
  /** True once the student has checked in — only they may ask questions. */
  attended?: boolean;
  userUid?: string;
  userName?: string;
  userEmail: string;
}) {
  const [enabled, setEnabled] = useState(false);
  const [messages, setMessages] = useState<TalkLiveChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  // When non-null, the full-screen projector shows approvedMessages[presentIndex].
  const [presentIndex, setPresentIndex] = useState<number | null>(null);
  // Presenter-adjustable font size for the projected question (1 = default).
  const [presentScale, setPresentScale] = useState(1);
  const zoom = (delta: number) => setPresentScale((s) => Math.min(2.5, Math.max(0.4, +(s + delta).toFixed(2))));
  const feedRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Read live so a student already on this screen gets the input the moment a
  // facilitator opens the box, without reloading.
  useEffect(() => subscribeEventLiveChatState(eventId, setEnabled), [eventId]);
  useEffect(() => subscribeTalkLiveChat(eventId, setMessages), [eventId]);

  const approved = messages.filter((m) => m.approved);
  const pending = messages.filter((m) => !m.approved);
  // A student sees the room's approved questions plus their own, still-pending
  // ones (flagged as awaiting approval); other people's pending stay hidden.
  const visible = isPresenter ? messages : messages.filter((m) => m.approved || m.studentUid === userUid);

  // If the message being projected disappears (removed, or un-approved), keep the
  // projector on a valid question or close it when nothing is left.
  useEffect(() => {
    if (presentIndex === null) return;
    if (approved.length === 0) { setPresentIndex(null); return; }
    if (presentIndex > approved.length - 1) setPresentIndex(approved.length - 1);
  }, [approved.length, presentIndex]);

  // A Q&A feed is only useful pinned to the newest question — during a talk the
  // interesting message is always the last one.
  useEffect(() => {
    const feed = feedRef.current;
    if (feed) feed.scrollTop = feed.scrollHeight;
  }, [messages, enabled]);

  const handleToggle = async () => {
    setError("");
    try {
      await toggleEventLiveChat(eventId, !enabled);
    } catch {
      setError("Could not change the Q&A state. You may not be a facilitator for this talk.");
    }
  };

  const handleApprove = async (msg: TalkLiveChatMessage, next: boolean) => {
    setError("");
    try {
      await approveTalkLiveChatMessage(msg.id, next);
    } catch {
      setError("Could not update that question. Only an admin or this talk's facilitator can.");
    }
  };

  const handleDelete = async (msg: TalkLiveChatMessage) => {
    if (!window.confirm(`Remove this question from ${msg.studentName}?\n\n"${msg.message}"`)) return;
    setError("");
    try {
      await deleteTalkLiveChatMessage(msg.id);
    } catch {
      setError("Could not remove that message. Only an admin or this talk's facilitator can.");
    }
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !userUid || sending) return;
    setError("");
    setSending(true);
    try {
      if ((await checkToxicContent(draft)).isToxic) {
        setError("Your message was flagged for containing inappropriate content. Please rephrase your question.");
        return;
      }
      await sendTalkLiveChatMessage(eventId, userUid, userName || "Student", userEmail, draft);
      setDraft("");
      // Inside the (scrollable) event modal the new message pushes the input out
      // of view, so the student has to hunt for it to ask a second question.
      formRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const panel = (
    <section className="ui-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-none flex-wrap">
        <span className="detail-label flex items-center gap-2">
          LIVE Q&A
          <span className={`px-2 py-0.5 text-[10px] rounded font-bold ${enabled ? "tone-success" : "tone-neutral"}`}>
            {enabled ? "Open" : "Closed"}
          </span>
        </span>

        <div className="flex items-center gap-2">
          {enabled && approved.length > 0 && (
            <button
              type="button"
              onClick={() => setPresentIndex(approved.length - 1)}
              className="text-xs font-semibold rounded-lg ui-btn ui-btn-quiet"
            >
              Presentation mode
            </button>
          )}
          {isPresenter && (
            <button
              type="button"
              onClick={handleToggle}
              className={`text-xs font-semibold rounded-lg ui-btn ${enabled ? "ui-btn-danger" : "ui-btn-success"}`}
            >
              {enabled ? "Close Q&A" : "Open Q&A"}
            </button>
          )}
        </div>
      </div>

      {error && <div className="p-2 text-xs ui-note-danger flex-none">{error}</div>}

      {isPresenter && enabled && pending.length > 0 && (
        <p className="text-xs ui-muted">{pending.length} question{pending.length === 1 ? "" : "s"} awaiting your approval.</p>
      )}

      {!enabled ? (
        <p className="text-xs ui-muted italic py-2">
          Q&A is closed. A facilitator or admin opens it during the talk.
        </p>
      ) : (
        <>
          <div
            ref={feedRef}
            aria-live="polite"
            aria-label="Questions asked during this talk"
            className="overflow-y-auto p-2 ui-card max-h-48 space-y-2 text-xs"
          >
            {visible.length === 0 ? (
              <p className="ui-muted italic text-center py-4">
                {isPresenter ? "No questions yet." : "No questions yet. Be the first to ask."}
              </p>
            ) : (
              visible.map((msg) => {
                const isMine = msg.studentUid === userUid;
                return (
                  <div key={msg.id} className={`ui-panel p-2 ${msg.approved ? "" : "opacity-80"}`}>
                    <div className="font-semibold ui-strong flex justify-between gap-3 items-center">
                      <span className="flex items-center gap-2">
                        {msg.studentName}
                        {!msg.approved && (
                          <span className="px-1.5 py-0.5 text-[10px] rounded font-bold tone-neutral">
                            {isPresenter ? "Pending" : "Awaiting approval"}
                          </span>
                        )}
                        {msg.approved && isPresenter && (
                          <span className="px-1.5 py-0.5 text-[10px] rounded font-bold tone-success">Approved</span>
                        )}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="ui-muted text-[10px]">{chatTime(msg.createdAt)}</span>
                        {isPresenter && (
                          <>
                            {msg.approved ? (
                              <button
                                type="button"
                                onClick={() => setPresentIndex(approved.findIndex((a) => a.id === msg.id))}
                                className="text-[10px] font-bold rounded ui-btn ui-btn-quiet px-2 py-0.5"
                              >
                                Present
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleApprove(msg, true)}
                                className="text-[10px] font-bold rounded ui-btn ui-btn-success px-2 py-0.5"
                              >
                                Approve
                              </button>
                            )}
                            {msg.approved && (
                              <button
                                type="button"
                                onClick={() => handleApprove(msg, false)}
                                className="text-[10px] font-bold rounded ui-btn ui-btn-quiet px-2 py-0.5"
                                title="Hide from the room again"
                              >
                                Unapprove
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDelete(msg)}
                              className="talk-chat-remove"
                              aria-label={`Remove question from ${msg.studentName}`}
                              title="Remove this question"
                            >
                              ✕
                            </button>
                          </>
                        )}
                      </span>
                    </div>
                    <p className="ui-strong mt-0.5">{msg.message}</p>
                    {!msg.approved && isMine && !isPresenter && (
                      <p className="ui-muted italic text-[10px] mt-1">Only you can see this until a facilitator approves it.</p>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {userUid && !isPresenter && (
            attended ? (
              <form ref={formRef} onSubmit={handleSend} className="flex gap-2 flex-none">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Ask a question during the talk…"
                  className="flex-1 ui-field px-3 py-2 text-xs"
                  maxLength={500}
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="ui-btn ui-btn-primary px-3 py-2 text-xs"
                >
                  Send
                </button>
              </form>
            ) : (
              <p className="text-xs ui-muted italic py-2">
                📲 Check in to this talk (scan the QR on the hall screen) to ask a question.
              </p>
            )
          )}
        </>
      )}
    </section>
  );

  const current = presentIndex === null ? null : approved[Math.min(presentIndex, approved.length - 1)];
  if (!current) return panel;

  const idx = Math.min(presentIndex ?? 0, approved.length - 1);
  const go = (delta: number) => setPresentIndex((i) => Math.max(0, Math.min(approved.length - 1, (i ?? 0) + delta)));

  // Presentation mode is a fixed overlay rather than the Fullscreen API: the Q&A
  // sits inside a modal that already traps focus, and requestFullscreen() on a
  // nested element fights that. It shows ONE approved question, projector-sized.
  return (
    <>
      {panel}
      <div
        className="fixed inset-0 z-50 talk-present"
        role="dialog"
        aria-label="Question presentation mode"
        tabIndex={-1}
        ref={(el) => el?.focus()}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.stopPropagation(); setPresentIndex(null); }
          else if (e.key === "ArrowRight") { e.stopPropagation(); go(1); }
          else if (e.key === "ArrowLeft") { e.stopPropagation(); go(-1); }
          else if (e.key === "+" || e.key === "=") { e.stopPropagation(); zoom(0.15); }
          else if (e.key === "-" || e.key === "_") { e.stopPropagation(); zoom(-0.15); }
        }}
      >
        <div className="talk-present-head">
          <span className="detail-label">LIVE Q&A · QUESTION {idx + 1} OF {approved.length}</span>
          <div className="flex items-center gap-2">
            <span className="talk-present-font">
              <button type="button" className="ui-btn ui-btn-quiet" onClick={() => zoom(-0.15)} disabled={presentScale <= 0.4} aria-label="Smaller text" title="Smaller text (−)">A−</button>
              <button type="button" className="ui-btn ui-btn-quiet" onClick={() => setPresentScale(1)} aria-label="Reset text size" title="Reset text size">{Math.round(presentScale * 100)}%</button>
              <button type="button" className="ui-btn ui-btn-quiet" onClick={() => zoom(0.15)} disabled={presentScale >= 2.5} aria-label="Bigger text" title="Bigger text (+)">A+</button>
            </span>
            <button type="button" className="ui-btn ui-btn-quiet" onClick={() => setPresentIndex(null)}>Exit</button>
          </div>
        </div>

        <div className="talk-present-stage">
          {/* Font size is set inline as well as in CSS: it must win over any
              ancestor cascade so the projected question always fills the room.
              The presenter's zoom multiplies the base clamp. */}
          <p className="talk-present-question" style={{ fontSize: `calc(clamp(3rem, min(13vw, 17vh), 14rem) * ${presentScale})`, fontWeight: 800, lineHeight: 1.05 }}>{current.message}</p>
          <p className="talk-present-asker" style={{ fontSize: `calc(clamp(1.5rem, min(4vw, 5vh), 3.5rem) * ${presentScale})`, fontWeight: 700 }}>— {current.studentName}</p>
        </div>

        <div className="talk-present-nav">
          <button type="button" className="ui-btn ui-btn-quiet" onClick={() => go(-1)} disabled={idx === 0}>← Previous</button>
          <span className="ui-muted text-sm">{idx + 1} / {approved.length}</span>
          <button type="button" className="ui-btn ui-btn-quiet" onClick={() => go(1)} disabled={idx === approved.length - 1}>Next →</button>
        </div>
      </div>
    </>
  );
}
