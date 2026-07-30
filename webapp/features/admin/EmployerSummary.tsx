import { useEffect, useState } from "react";
import { subscribeApplications, subscribeCompanyChats } from "../../lib/data/firestore";
import type { Application, ChatLog } from "../../lib/data/types";
import { BarChart } from "./AdminSummary";

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return <div className="stat-card"><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong>{hint && <small>{hint}</small>}</div>;
}

/** Employer landing: how their company is doing at Industry Day. */
export function EmployerSummary({ companies }: { companies: string[] }) {
  const [apps, setApps] = useState<Application[]>([]);
  const [chats, setChats] = useState<Record<string, ChatLog[]>>({});

  useEffect(() => subscribeApplications(setApps), []);
  useEffect(() => {
    if (!companies.length) return;
    const unsubs = companies.map((c) => subscribeCompanyChats(c, (rows) => setChats((prev) => ({ ...prev, [c]: rows }))));
    return () => unsubs.forEach((u) => u());
  }, [companies.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const mine = apps.filter((a) => companies.includes(a.company));
  const questions = Object.values(chats).flat();
  const byJob = new Map<string, number>();
  for (const a of mine) byJob.set(a.jobTitle, (byJob.get(a.jobTitle) ?? 0) + 1);
  const ranked = [...byJob.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

  return (
    <section className="results" aria-labelledby="emp-summary-title">
      <div className="results-head"><div><span>OVERVIEW</span><h1 id="emp-summary-title">Your company at a glance</h1></div><p>Applications and questions for {companies.length ? <b>{companies.join(", ")}</b> : "your company"}.</p></div>

      {!companies.length ? (
        <div className="admin-jobs-empty"><strong>No company assigned</strong><p>Ask an admin to set your company to see your summary.</p></div>
      ) : (
        <>
          <div className="summary-grid">
            <Stat label="Total applications" value={mine.length} />
            <Stat label="Unique applicants" value={new Set(mine.map((a) => a.studentUid)).size} />
            <Stat label="Jobs applied to" value={new Set(mine.map((a) => a.jobId)).size} />
            <Stat label="Questions asked" value={questions.length} hint="via the assistant" />
          </div>

          <div className="summary-ranks">
            <BarChart title="Applications by vacancy" rows={ranked} />
          </div>
          <p className="text-[11px] text-accent mt-2">Profile-view counts aren&apos;t available on the current plan — figures above reflect applications and assistant questions.</p>
        </>
      )}
    </section>
  );
}
