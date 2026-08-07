import { useEffect, useMemo, useState } from "react";
import { FilterReset } from "../../components/FilterReset";
import type { EventItem, TalkLiveChatMessage } from "../../lib/data/types";
import { subscribeAllTalkLiveChats, subscribeEvents } from "../../lib/data/firestore";
import { downloadCsv, toCsv } from "../../lib/data/csv";
import { notify } from "../../components/toast";

function whenValue(ts: unknown): number {
  return (ts as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
}

function formatWhen(ts: unknown): string {
  const ms = whenValue(ts);
  return ms ? new Date(ms).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
}

/**
 * Admin view of every question asked during a talk.
 *
 * Presenters can delete an abusive message from the live feed, so the feed is
 * not a reliable record. This is the audit trail: it reads the whole collection
 * and groups by talk, so an admin can review what was asked after the fact.
 */
export function TalkChatHistory() {
  const [messages, setMessages] = useState<TalkLiveChatMessage[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [query, setQuery] = useState("");
  const [eventFilter, setEventFilter] = useState("all");

  useEffect(() => subscribeAllTalkLiveChats(setMessages), []);
  useEffect(() => subscribeEvents(setEvents, () => {}), []);

  const titleById = useMemo(() => new Map(events.map((e) => [e.id, e.title])), [events]);
  const q = query.trim().toLowerCase();

  const shown = messages
    .filter((m) => eventFilter === "all" || String(m.eventId) === eventFilter)
    .filter((m) => !q || [m.studentName, m.studentEmail, m.message, titleById.get(m.eventId)].some((f) => (f ?? "").toLowerCase().includes(q)))
    .sort((a, b) => whenValue(b.createdAt) - whenValue(a.createdAt));

  const eventOptions = [...new Set(messages.map((m) => m.eventId))]
    .map((id) => ({ id, title: titleById.get(id) ?? `Event ${id}` }))
    .sort((a, b) => a.title.localeCompare(b.title));

  // Group the questions by talk so admins review one event at a time. Talks are
  // ordered by their most recent question.
  const groups = useMemo(() => {
    const byEvent = new Map<number, { title: string; items: TalkLiveChatMessage[] }>();
    for (const m of shown) {
      if (!byEvent.has(m.eventId)) byEvent.set(m.eventId, { title: titleById.get(m.eventId) ?? `Event ${m.eventId}`, items: [] });
      byEvent.get(m.eventId)!.items.push(m);
    }
    return [...byEvent.values()].sort((a, b) => whenValue(b.items[0]?.createdAt) - whenValue(a.items[0]?.createdAt));
  }, [shown, titleById]);

  const exportCsv = () => {
    if (!shown.length) { notify("Nothing to export.", "error"); return; }
    const rows = shown.map((m) => [
      titleById.get(m.eventId) ?? String(m.eventId), m.studentName, m.studentEmail, m.message, formatWhen(m.createdAt),
    ]);
    downloadCsv(
      `talk-questions-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(["Talk", "Student", "Email", "Question", "When"], rows),
    );
    notify(`Exported ${shown.length} question${shown.length === 1 ? "" : "s"}.`);
  };

  return (
    <section className="local-jobs" aria-labelledby="talk-chats-title">
      <div className="local-jobs-head">
        <div><span className="detail-label">LIVE Q&amp;A</span><h3 id="talk-chats-title">Questions asked during talks</h3></div>
        <div className="flex items-center gap-2">
          <strong>{shown.length}</strong>
          <button type="button" className="admin-button" onClick={exportCsv} disabled={!shown.length}>⬇ Export CSV</button>
        </div>
      </div>

      <div className="admin-toolbar">
        <input
          type="search"
          className="admin-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by student, talk or text…"
          aria-label="Search questions"
        />
        <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} aria-label="Filter by talk">
          <option value="all">All talks</option>
          {eventOptions.map((o) => <option key={o.id} value={String(o.id)}>{o.title}</option>)}
        </select>
        <FilterReset
          active={Boolean(query) || eventFilter !== "all"}
          onReset={() => { setQuery(""); setEventFilter("all"); }}
        />
      </div>

      {groups.length ? (
        groups.map((g) => (
          <details className="student-group" key={g.title} open>
            <summary className="student-group-head"><b>{g.title}</b><small>{g.items.length} question{g.items.length === 1 ? "" : "s"}</small></summary>
            {g.items.map((m) => (
              <div className="local-job" key={m.id} style={{ alignItems: "flex-start" }}>
                <span>
                  <b>{m.studentName || m.studentEmail || "Student"}</b>
                  <small>{m.studentEmail} · {formatWhen(m.createdAt)}</small>
                  <span className="mt-1 block text-[11px]">{m.message}</span>
                </span>
              </div>
            ))}
          </details>
        ))
      ) : (
        <div className="admin-jobs-empty">
          <strong>No questions yet</strong>
          <p>Questions students ask while a talk&apos;s Q&amp;A is open will appear here.</p>
        </div>
      )}
    </section>
  );
}
