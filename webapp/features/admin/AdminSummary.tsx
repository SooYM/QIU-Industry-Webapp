import { useEffect, useState } from "react";
import { FilterReset } from "../../components/FilterReset";
import {
  countAllCompanyViews, subscribeAllChats, subscribeApplications, subscribeAttendance,
  subscribeCompanies, subscribeEvents, subscribeViews,
} from "../../lib/data/firestore";
import type { Application, Attendance, ChatLog, Company, EventItem, ViewEvent } from "../../lib/data/types";

export type DashboardRange = "7" | "30" | "90" | "all";
export type DashboardActivityType = "application" | "view" | "attendance" | "question";
export type DashboardActivity = {
  id: string;
  type: DashboardActivityType;
  date: Date | null;
  studentUid: string;
  actor: string;
  company: string | null;
  subject: string;
  context: string;
  answer?: string;
  jobId?: number;
  eventId?: number;
};

const DAY_MS = 86_400_000;
const RANGE_LABELS: Record<DashboardRange, string> = { "7": "Last 7 days", "30": "Last 30 days", "90": "Last 90 days", all: "All time" };
const ACTIVITY_LABELS: Record<DashboardActivityType, string> = { application: "Application", view: "Vacancy interest", attendance: "Event check-in", question: "Assistant question" };

/** Convert Firestore Timestamp, Date, or stored epoch milliseconds without JSON round-tripping. */
export function timestampToDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (!value || typeof value !== "object") return null;
  try {
    if ("toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
      const date = (value as { toDate: () => Date }).toDate();
      return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
    }
    if ("seconds" in value && typeof (value as { seconds?: unknown }).seconds === "number") {
      const stamp = value as { seconds: number; nanoseconds?: number };
      const date = new Date(stamp.seconds * 1000 + (stamp.nanoseconds ?? 0) / 1_000_000);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  } catch {
    return null;
  }
  return null;
}

export function activityInRange(date: Date | null, range: DashboardRange, now = Date.now()): boolean {
  if (range === "all") return true;
  return Boolean(date && date.getTime() >= now - Number(range) * DAY_MS && date.getTime() <= now);
}

function topBy<T>(items: T[], key: (item: T) => string): { label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const label = key(item);
    if (label) map.set(label, (map.get(label) ?? 0) + 1);
  }
  return [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * A bento tile. When `onClick` is supplied the tile becomes a filter control —
 * the number and the records behind it are the same thing, so tapping the
 * number should show you those records rather than making you find the dropdown.
 */
function Stat({ label, value, hint, className = "", onClick, active }: {
  label: string; value: string | number; hint?: string; className?: string;
  onClick?: () => void; active?: boolean;
}) {
  const body = <><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong>{hint && <small>{hint}</small>}</>;
  if (!onClick) return <div className={`stat-card ${className}`.trim()}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={Boolean(active)}
      className={`stat-card stat-card-action ${active ? "is-active" : ""} ${className}`.trim()}
    >
      {body}
      <span className="stat-card-cue">{active ? "Showing below" : "Show activity →"}</span>
    </button>
  );
}

export function TimeRangeControl({ value, onChange, id }: { value: DashboardRange; onChange: (range: DashboardRange) => void; id: string }) {
  return (
    <label className="dashboard-filter" htmlFor={id}>
      <span>Time range</span>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value as DashboardRange)}>
        {(Object.keys(RANGE_LABELS) as DashboardRange[]).map((range) => <option value={range} key={range}>{RANGE_LABELS[range]}</option>)}
      </select>
    </label>
  );
}

type ChartDatum = { label: string; count: number; color: string };

export function DonutChart({ title, rows }: { title: string; rows: ChartDatum[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const visible = rows.filter((row) => row.count > 0);
  const total = visible.reduce((sum, row) => sum + row.count, 0);
  const active = visible.find((row) => row.label === (preview ?? selected)) ?? null;
  const toggle = (label: string) => setSelected((current) => current === label ? null : label);
  const segments = visible.map((row, index) => ({
    ...row,
    share: (row.count / total) * 100,
    start: visible.slice(0, index).reduce((sum, item) => sum + (item.count / total) * 100, 0),
  }));

  return (
    <div className="rank-card donut-card">
      <div className="chart-heading">
        <span className="detail-label">{title}</span>
        {active && <button type="button" onClick={() => setSelected(null)}>Show all</button>}
      </div>
      {total ? (
        <div className="donut-layout">
          <div className="donut-plot">
            <svg viewBox="0 0 120 120" role="group" aria-label={`${title}: ${visible.map((row) => `${row.label} ${row.count}`).join(", ")}`}>
              <circle className="donut-track" cx="60" cy="60" r="44" pathLength="100" />
              {segments.map((row) => (
                <circle
                  className={`donut-segment${active?.label === row.label ? " is-active" : ""}${active && active.label !== row.label ? " is-muted" : ""}`}
                  cx="60" cy="60" r="44" pathLength="100" key={row.label} role="button" tabIndex={0}
                  aria-label={`${row.label}: ${row.count}`} aria-pressed={selected === row.label}
                  onPointerEnter={() => setPreview(row.label)} onPointerLeave={() => setPreview(null)}
                  onFocus={() => setPreview(row.label)} onBlur={() => setPreview(null)} onClick={() => toggle(row.label)}
                  onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(row.label); } }}
                  style={{ stroke: row.color, strokeDasharray: `${Math.max(row.share - 1.2, 0)} ${100 - Math.max(row.share - 1.2, 0)}`, strokeDashoffset: -row.start }}
                />
              ))}
            </svg>
            <button className="donut-center" type="button" onClick={() => setSelected(null)} aria-label="Show all chart data" aria-live="polite">
              <strong>{active?.count ?? total}</strong><span>{active?.label ?? "total actions"}</span>
            </button>
          </div>
          <div className="donut-legend" aria-label={`${title} filters`}>
            {visible.map((row) => (
              <button type="button" key={row.label} aria-pressed={selected === row.label} onClick={() => toggle(row.label)}
                onPointerEnter={() => setPreview(row.label)} onPointerLeave={() => setPreview(null)} onFocus={() => setPreview(row.label)} onBlur={() => setPreview(null)}>
                <i style={{ background: row.color }} aria-hidden="true" /><span>{row.label}</span><strong>{row.count}</strong>
              </button>
            ))}
          </div>
        </div>
      ) : <p className="dashboard-zero">No activity matches this scope.</p>}
    </div>
  );
}

export function BarChart({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <div className="rank-card">
      <span className="detail-label">{title}</span>
      {rows.length ? <div className="bar-list">{rows.slice(0, 6).map((row) => (
        <div className="bar-row" key={row.label} title={`${row.label}: ${row.count}`}>
          <span className="bar-label">{row.label}</span>
          <span className="bar-track" aria-hidden="true"><span className="bar-fill" style={{ width: `${Math.max(6, (row.count / max) * 100)}%` }} /></span>
          <span className="bar-count">{row.count}</span>
        </div>
      ))}</div> : <p className="dashboard-zero">No ranked activity in this scope.</p>}
    </div>
  );
}

function formatBucketDate(date: Date) {
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function trendBuckets(entries: DashboardActivity[], range: DashboardRange, now: number) {
  const dated = entries.filter((entry) => entry.date).sort((a, b) => a.date!.getTime() - b.date!.getTime());
  if (!dated.length) return [];
  const first = dated[0].date!.getTime();
  const last = Math.max(now, dated[dated.length - 1].date!.getTime());
  const start = range === "all" ? first : now - Number(range) * DAY_MS;
  const preferred = range === "7" ? 7 : range === "30" ? 10 : 12;
  const bucketCount = range === "all" ? Math.min(12, Math.max(1, Math.ceil((last - start) / DAY_MS))) : preferred;
  const width = Math.max(1, (last - start) / bucketCount);
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const from = new Date(start + index * width);
    const to = new Date(index === bucketCount - 1 ? last : start + (index + 1) * width - 1);
    return { label: formatBucketDate(from) === formatBucketDate(to) ? formatBucketDate(from) : `${formatBucketDate(from)}–${formatBucketDate(to)}`, count: 0 };
  });
  for (const entry of dated) {
    const index = Math.min(bucketCount - 1, Math.max(0, Math.floor((entry.date!.getTime() - start) / width)));
    buckets[index].count += 1;
  }
  return buckets;
}

export function ActivityTrend({ entries, range, now }: { entries: DashboardActivity[]; range: DashboardRange; now: number }) {
  const buckets = trendBuckets(entries, range, now);
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));
  return (
    <section className="trend-card" aria-labelledby="activity-trend-title">
      <div className="dashboard-section-head"><div><span className="detail-label">ACTIVITY TREND</span><h2 id="activity-trend-title">Recorded activity over time</h2></div><strong>{entries.filter((entry) => entry.date).length} dated</strong></div>
      {buckets.length ? (
        <ol className="trend-buckets">
          {buckets.map((bucket) => (
            <li key={bucket.label} aria-label={`${bucket.label}: ${bucket.count} activities`}>
              <span className="trend-value">{bucket.count}</span>
              <span className="trend-plot" aria-hidden="true"><i style={{ height: `${bucket.count ? Math.max(8, bucket.count / max * 100) : 2}%` }} /></span>
              <span className="trend-label">{bucket.label}</span>
            </li>
          ))}
        </ol>
      ) : <div className="dashboard-empty"><strong>No dated activity</strong><p>Try a broader range, or review undated records below.</p></div>}
    </section>
  );
}

function formatActivityDate(date: Date | null) {
  return date ? date.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Date unavailable";
}

export function RecentActivity({ entries, title = "Recent filtered activity", onOpen }: { entries: DashboardActivity[]; title?: string; onOpen?: (entry: DashboardActivity) => void }) {
  const sorted = [...entries].sort((a, b) => (b.date?.getTime() ?? -1) - (a.date?.getTime() ?? -1)).slice(0, 10);
  return (
    <section className="activity-card" aria-labelledby="recent-activity-title">
      <div className="dashboard-section-head"><div><span className="detail-label">DRILL-DOWN</span><h2 id="recent-activity-title">{title}</h2></div><strong>{entries.length} records</strong></div>
      {sorted.length ? <div className="activity-table">
        <div className="activity-list-head" aria-hidden="true"><span>Type / subject</span><span>Context</span><span>Date</span><span>Action</span></div>
        <ol className="activity-list">{sorted.map((entry) => (
          <li key={`${entry.type}-${entry.id}`}>
            <button className="activity-row" type="button" onClick={() => onOpen?.(entry)} disabled={!onOpen} aria-label={`Open ${ACTIVITY_LABELS[entry.type].toLowerCase()}: ${entry.subject}`}>
              <span className="activity-primary"><span className={`activity-kind ${entry.type}`}>{ACTIVITY_LABELS[entry.type]}</span><strong>{entry.subject}</strong><small>{entry.actor}</small></span>
              <span className="activity-context"><span className="sr-only">Context: </span>{entry.context}</span>
              <time dateTime={entry.date?.toISOString()}><span className="sr-only">Date: </span>{formatActivityDate(entry.date)}</time>
              <span className="activity-open" aria-hidden="true">Open</span>
            </button>
          </li>
        ))}</ol>
      </div> : <div className="dashboard-empty"><strong>No activity found</strong><p>Change filters or choose a broader time range.</p></div>}
    </section>
  );
}

/** Admin landing: filterable portal-wide operational activity. */
export function AdminSummary({ onOpenActivity }: { onOpenActivity?: (entry: DashboardActivity) => void }) {
  const [apps, setApps] = useState<Application[]>([]);
  const [views, setViews] = useState<ViewEvent[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [chats, setChats] = useState<ChatLog[]>([]);
  const [range, setRange] = useState<DashboardRange>("30");
  const [company, setCompany] = useState("all");
  const [activityType, setActivityType] = useState<DashboardActivityType | "all">("all");
  const [dashboardNow] = useState(() => Date.now());
  const [profileViews, setProfileViews] = useState<number | null>(null);

  // Counted server-side: the visit docs carry student ids, so they are never
  // streamed into the browser just to produce a total.
  useEffect(() => {
    let live = true;
    countAllCompanyViews()
      .then((total) => { if (live) setProfileViews(total); })
      .catch(() => { /* The stat is informational; a failure must not break the dashboard. */ });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const unsubs = [
      subscribeApplications(setApps), subscribeViews(setViews), subscribeAttendance(setAttendance),
      subscribeEvents(setEvents, () => {}), subscribeCompanies(setCompanies, () => {}), subscribeAllChats(setChats),
    ];
    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, []);

  const eventTitleById = new Map(events.map((event) => [event.id, event.title]));
  const identityByUid = new Map<string, string>();
  for (const row of [...apps, ...attendance]) if (row.studentUid) identityByUid.set(row.studentUid, row.studentName || row.studentEmail || row.studentUid);
  for (const row of chats) if (row.studentUid) identityByUid.set(row.studentUid, row.studentName || row.studentEmail || row.studentUid);

  const allActivity: DashboardActivity[] = [
    ...apps.map((row) => ({ id: row.id, type: "application" as const, date: timestampToDate(row.appliedAt), studentUid: row.studentUid, actor: row.studentName || row.studentEmail || row.studentUid, company: row.company, subject: row.jobTitle || "Vacancy application", context: row.company, jobId: row.jobId })),
    ...views.map((row) => ({ id: row.id, type: "view" as const, date: timestampToDate(row.viewedAt), studentUid: row.studentUid, actor: identityByUid.get(row.studentUid) || row.studentUid || "Unknown student", company: row.company, subject: row.jobTitle || "Vacancy", context: row.company, jobId: row.jobId })),
    ...attendance.map((row) => ({ id: row.id, type: "attendance" as const, date: timestampToDate(row.checkOutAt) || timestampToDate(row.checkInAt) || timestampToDate(row.checkOutMs) || timestampToDate(row.checkInMs), studentUid: row.studentUid, actor: row.studentName || row.studentEmail || row.studentUid, company: null, subject: row.eventTitle || eventTitleById.get(row.eventId) || "Industry Day event", context: row.step === "checkout" ? "Checked out" : "Checked in", eventId: row.eventId })),
    ...chats.map((row) => ({ id: row.id, type: "question" as const, date: timestampToDate(row.createdAt), studentUid: row.studentUid, actor: row.studentName || row.studentEmail || row.studentUid, company: row.company, subject: row.question || "Assistant question", context: row.company ? `About ${row.company}` : "General portal question", answer: row.answer })),
  ];
  const companyScoped = allActivity.filter((entry) => company === "all" || entry.company === company);
  const undatedInScope = companyScoped.filter((entry) => !entry.date && (activityType === "all" || entry.type === activityType)).length;
  const filtered = companyScoped.filter((entry) => (activityType === "all" || entry.type === activityType) && activityInRange(entry.date, range, dashboardNow));
  const companyOptions = [...new Set([...companies.map((item) => item.name), ...allActivity.map((entry) => entry.company).filter((name): name is string => Boolean(name))])].sort((a, b) => a.localeCompare(b));
  const count = (type: DashboardActivityType) => filtered.filter((entry) => entry.type === type).length;
  const activeStudents = new Set(filtered.map((entry) => entry.studentUid).filter(Boolean)).size;
  const datedCount = filtered.filter((entry) => entry.date).length;
  const scopedApps = filtered.filter((entry) => entry.type === "application");
  const scopedAttendance = filtered.filter((entry) => entry.type === "attendance");
  const mix = [
    { label: "Applications", count: count("application"), color: "var(--blue)" },
    { label: "Vacancy interest", count: count("view"), color: "var(--info)" },
    { label: "Event check-ins", count: count("attendance"), color: "var(--success)" },
    { label: "Assistant questions", count: count("question"), color: "var(--warning)" },
  ];

  return (
    <section className="results dashboard-summary" aria-labelledby="summary-title">
      <div className="results-head"><div><span>OVERVIEW</span><h1 id="summary-title">Industry Day activity</h1></div><p>Operational totals and recent student activity, filtered to the same scope.</p></div>

      <div className="dashboard-toolbar" aria-label="Dashboard filters">
        <TimeRangeControl id="admin-summary-range" value={range} onChange={setRange} />
        <label className="dashboard-filter" htmlFor="admin-summary-company"><span>Company scope</span><select id="admin-summary-company" value={company} onChange={(event) => setCompany(event.target.value)}><option value="all">All companies</option>{companyOptions.map((name) => <option key={name}>{name}</option>)}</select></label>
        <label className="dashboard-filter" htmlFor="admin-summary-activity"><span>Activity type</span><select id="admin-summary-activity" value={activityType} onChange={(event) => setActivityType(event.target.value as DashboardActivityType | "all")}><option value="all">All activity</option>{(Object.keys(ACTIVITY_LABELS) as DashboardActivityType[]).map((type) => <option value={type} key={type}>{ACTIVITY_LABELS[type]}</option>)}</select></label>
        <FilterReset
          active={range !== "30" || company !== "all" || activityType !== "all"}
          onReset={() => { setRange("30"); setCompany("all"); setActivityType("all"); }}
        />
        <p className="dashboard-scope-note" role="status">{filtered.length} matching records · {RANGE_LABELS[range]}{company !== "all" ? ` · ${company}` : ""}</p>
      </div>
      {company !== "all" && <p className="dashboard-note">Event check-ins have no company field and are excluded from company-specific scope.</p>}
      {undatedInScope > 0 && <p className="dashboard-note">{undatedInScope} undated record{undatedInScope === 1 ? "" : "s"} {range === "all" ? "included in totals and listed after dated activity; undated records do not appear in the trend." : "excluded from this dated range."}</p>}

      <div className="bento">
        {/* Attendance is the number an organiser watches all day, so it leads. */}
        <Stat
          className="bento-lead"
          label="Event check-ins"
          value={count("attendance")}
          hint={`${scopedAttendance.filter((entry) => attendance.find((row) => row.id === entry.id)?.caEligible).length} CCA-eligible`}
          active={activityType === "attendance"}
          onClick={() => setActivityType(activityType === "attendance" ? "all" : "attendance")}
        />
        {/* "Students active" says what it counts. "Active students" was ambiguous:
            it is the number of distinct people who did ANYTHING in scope. */}
        <Stat className="bento-wide" label="Students active" value={activeStudents} hint="distinct students with any activity in scope" />
        <Stat
          label="Applications"
          value={count("application")}
          hint={`${new Set(scopedApps.map((entry) => entry.subject)).size} vacancies`}
          active={activityType === "application"}
          onClick={() => setActivityType(activityType === "application" ? "all" : "application")}
        />
        <Stat label="Profile visits" value={profileViews ?? "—"} hint="once per student per session" />

        <div className="bento-wide"><ActivityTrend entries={filtered} range={range} now={dashboardNow} /></div>
        {/* Engagement mix already breaks down views vs applications vs questions,
            so a separate "Vacancy interest" tile repeated one of its slices. */}
        <div className="bento-wide"><DonutChart title="Portal engagement mix" rows={mix} /></div>

        <Stat
          label="Assistant questions"
          value={count("question")}
          active={activityType === "question"}
          onClick={() => setActivityType(activityType === "question" ? "all" : "question")}
        />
        <Stat
          label="Recorded activity"
          value={filtered.length}
          hint={`${datedCount} dated`}
          active={activityType === "all"}
          onClick={() => setActivityType("all")}
        />

        <div className="bento-wide"><BarChart title="Most-applied companies" rows={topBy(scopedApps, (entry) => entry.company ?? "")} /></div>
        <div className="bento-wide"><BarChart title="Most-applied vacancies" rows={topBy(scopedApps, (entry) => entry.subject)} /></div>
        <div className="bento-full"><RecentActivity entries={filtered} onOpen={onOpenActivity} /></div>
      </div>
    </section>
  );
}
