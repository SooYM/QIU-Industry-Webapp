import { useEffect, useState } from "react";
import { subscribeAllChats, subscribeCompanyChats } from "../../lib/data/firestore";
import type { ChatLog } from "../../lib/data/types";

function formatWhen(ts: unknown): string {
  if (ts && typeof ts === "object" && "toDate" in ts) {
    return (ts as { toDate: () => Date }).toDate().toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }
  return "Just now";
}
function whenValue(ts: unknown): number {
  if (ts && typeof ts === "object" && "seconds" in ts) return (ts as { seconds: number }).seconds;
  return Number.MAX_SAFE_INTEGER;
}

/** Admin view: chats grouped by student. */
function AllChats() {
  const [logs, setLogs] = useState<ChatLog[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => subscribeAllChats((rows) => { setLogs(rows); setLoading(false); }), []);

  const groups = new Map<string, { name: string; email: string; items: ChatLog[] }>();
  for (const l of logs) {
    const key = l.studentUid || l.studentEmail || "unknown";
    if (!groups.has(key)) groups.set(key, { name: l.studentName, email: l.studentEmail, items: [] });
    groups.get(key)!.items.push(l);
  }
  const grouped = [...groups.values()]
    .map((g) => ({ ...g, items: g.items.sort((a, b) => whenValue(b.createdAt) - whenValue(a.createdAt)) }))
    .sort((a, b) => whenValue(b.items[0]?.createdAt) - whenValue(a.items[0]?.createdAt));

  return (
    <section className="local-jobs" aria-labelledby="chats-title">
      <div className="local-jobs-head"><div><span className="detail-label">ASSISTANT CHATS</span><h3 id="chats-title">By student</h3></div><strong>{logs.length} from {grouped.length}</strong></div>
      {loading ? <p className="role-manager-state" role="status">Loading chats…</p>
        : grouped.length ? grouped.map((g) => (
          <details className="student-group" key={g.email || g.name}>
            <summary className="student-group-head"><b>{g.name || g.email || "Unknown"}</b><small>{g.email} · {g.items.length} question{g.items.length === 1 ? "" : "s"}</small></summary>
            {g.items.map((log) => (
              <div className="local-job" key={log.id} style={{ alignItems: "flex-start" }}>
                <span>
                  <small>{log.company ? `about ${log.company} · ` : ""}{formatWhen(log.createdAt)}</small>
                  <span className="mt-1 block text-[11px]"><b>Q:</b> {log.question}</span>
                  <span className="block text-[11px] text-accent"><b>A:</b> {log.answer}</span>
                </span>
              </div>
            ))}
          </details>
        )) : <div className="admin-jobs-empty"><strong>No chats yet</strong><p>Assistant conversations will appear here.</p></div>}
    </section>
  );
}

/** Employer view: only their companies' chats, anonymized. */
function CompanyChats({ companies }: { companies: string[] }) {
  const [byCompany, setByCompany] = useState<Record<string, ChatLog[]>>({});

  useEffect(() => {
    if (!companies.length) return;
    const unsubs = companies.map((company) =>
      subscribeCompanyChats(company, (rows) => setByCompany((prev) => ({ ...prev, [company]: rows }))));
    return () => unsubs.forEach((u) => u());
  }, [companies.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = Object.values(byCompany).flat().sort((a, b) => whenValue(b.createdAt) - whenValue(a.createdAt));

  return (
    <section className="local-jobs" aria-labelledby="company-chats-title">
      <div className="local-jobs-head"><div><span className="detail-label">ASSISTANT CHATS</span><h3 id="company-chats-title">Questions about your companies</h3></div><strong>{sorted.length}</strong></div>
      <p className="text-[11px] text-accent">🔒 Questions are anonymized — student identities are never shown to employers.</p>
      {!companies.length ? (
        <div className="admin-jobs-empty"><strong>No companies yet</strong><p>Create a vacancy first. Chats mentioning your listed companies will appear here.</p></div>
      ) : sorted.length ? (
        <div className="local-job-list">
          {sorted.map((log) => (
            <div className="local-job" key={log.id} style={{ alignItems: "flex-start" }}>
              <span>
                <b>{log.company}</b>
                <small>{formatWhen(log.createdAt)}</small>
                <span className="mt-1 block text-[11px]"><b>Q:</b> {log.question}</span>
                <span className="block text-[11px] text-accent"><b>A:</b> {log.answer}</span>
              </span>
            </div>
          ))}
        </div>
      ) : <div className="admin-jobs-empty"><strong>No questions yet</strong><p>Anonymized questions about your companies will appear here.</p></div>}
    </section>
  );
}

export function ChatHistory({ mode, companies = [] }: { mode: "all" | "company"; companies?: string[] }) {
  return mode === "all" ? <AllChats /> : <CompanyChats companies={companies} />;
}
