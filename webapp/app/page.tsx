"use client";

import { PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { AuthAccount, useAuth } from "./auth-context";
import { canManageVacancies } from "./auth-policy";
import { db } from "./firebase-client";
import {
  checkInAttendance, checkOutAttendance, deleteApplication, getMyAttendance, isApproved,
  recordApplication, recordView, subscribeApplications, subscribeAttendance,
  subscribeEvents, subscribeJobStats, subscribeMyResume, subscribeVacancies, subscribeViews,
} from "../lib/data/firestore";
import type { Application, Attendance, EventItem, Job, Resume, ViewEvent } from "../lib/data/types";
import { jobMatchesCourse, resolveCourse } from "../lib/data/course-map";
import { VacancyFilters } from "../features/vacancies/VacancyFilters";
import { VacancyList } from "../features/vacancies/VacancyList";
import { VacancyModal } from "../features/vacancies/VacancyModal";
import { AdminPanel } from "../features/admin/AdminPanel";
import { StudentHistory } from "../features/student/StudentHistory";
import { StudentResume } from "../features/student/StudentResume";
import { EventsView } from "../features/events/EventsView";
import { EventDetail } from "../features/events/EventDetail";
import { Guide } from "../features/Guide";
import { PREFS_KEY, type TextScale, type Theme } from "../features/vacancies/vacancy-utils";

export default function Home() {
  const { user, role, course } = useAuth();
  const [customJobs, setCustomJobs] = useState<Job[]>([]);
  const [tab, setTab] = useState<"vacancies" | "history" | "resume" | "events">("vacancies");
  const [myApplications, setMyApplications] = useState<Application[]>([]);
  const [myViews, setMyViews] = useState<ViewEvent[]>([]);
  const [myResume, setMyResume] = useState<Resume | null>(null);
  const [resumeChecked, setResumeChecked] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [company, setCompany] = useState("All companies");
  const [specialization, setSpecialization] = useState("All specializations");
  const [type, setType] = useState("All opportunities");
  const [maxSalary, setMaxSalary] = useState(10000);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(9);
  const [columns, setColumns] = useState(3);
  const [textScale, setTextScale] = useState<TextScale>("default");
  const [theme, setTheme] = useState<Theme>("light");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [recommendationMode, setRecommendationMode] = useState<"all" | "recommended">("all");
  const [sort, setSort] = useState<"default" | "newest" | "oldest" | "salary_high" | "salary_low">("default");
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [myAttendance, setMyAttendance] = useState<Attendance[]>([]);
  const [jobStats, setJobStats] = useState<Record<number, number>>({});
  const [scanMsg, setScanMsg] = useState("");
  const scanHandled = useRef(false);

  useEffect(() => {
    try {
      const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Partial<{ perPage: number; columns: number; textScale: TextScale; theme: Theme }>;
      // Hydrate browser preferences only after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if ([6, 9, 12, 24].includes(prefs.perPage ?? 0)) setPerPage(prefs.perPage!);
      if ([2, 3].includes(prefs.columns ?? 0)) setColumns(prefs.columns!);
      if (["default", "large", "xlarge"].includes(prefs.textScale ?? "")) setTextScale(prefs.textScale!);
      setTheme(prefs.theme ?? "light"); // default light regardless of system setting
    } catch { /* Ignore malformed device-local preferences. */ }
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    return subscribeVacancies((jobs) => {
      setCustomJobs(jobs);
      setJobsLoading(false);
    }, () => {
      setJobsLoading(false);
    });
  }, [user]);

  // Student history + resume streams (their own records only).
  useEffect(() => {
    if (!user || !db || canManageVacancies(role)) return;
    const unsubApps = subscribeApplications(setMyApplications, user.uid);
    const unsubViews = subscribeViews(setMyViews, user.uid);
    const unsubResume = subscribeMyResume(user.uid, (r) => { setMyResume(r); setResumeChecked(true); });
    return () => { unsubApps(); unsubViews(); unsubResume(); };
  }, [user, role]);

  // Events (all roles) + this account's own attendance records.
  useEffect(() => {
    if (!user || !db) return;
    const unsubEvents = subscribeEvents(setEvents, () => {});
    const unsubAtt = subscribeAttendance(setMyAttendance, user.uid);
    const unsubStats = subscribeJobStats(setJobStats);
    return () => { unsubEvents(); unsubAtt(); unsubStats(); };
  }, [user]);

  // Process a scanned attendance QR (?ev=&s=&c=) once the events + user are ready.
  useEffect(() => {
    if (scanHandled.current || !user || !events.length) return;
    const params = new URLSearchParams(window.location.search);
    const ev = params.get("ev"), step = params.get("s"), code = params.get("c");
    if (!ev || !step || !code) return;
    scanHandled.current = true;
    window.history.replaceState({}, "", window.location.pathname);
    const eventId = Number(ev);
    const event = events.find((e) => e.id === eventId);
    setTab("events");
    (async () => {
      if (!event) { setScanMsg("Event not found."); return; }
      const name = user.displayName || user.email || "Student";
      try {
        if (step === "checkout") {
          const existing = await getMyAttendance(eventId, user.uid);
          if (!existing) { setScanMsg("Check in first, then check out."); return; }
          await checkOutAttendance(event, user.uid, code, existing);
          setScanMsg(`✓ Checked out of ${event.title}.`);
        } else {
          await checkInAttendance(event, user.uid, name, user.email ?? "", code);
          setScanMsg(`✓ Checked in to ${event.title}. Remember to check out at the end.`);
        }
      } catch {
        setScanMsg("That QR code is invalid or expired — scan the live code on the hall screen.");
      }
    })();
  }, [user, events]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.textScale = textScale;
    localStorage.setItem(PREFS_KEY, JSON.stringify({ perPage, columns, textScale, theme }));
  }, [perPage, columns, textScale, theme]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setSelectedJob(null); setAdminOpen(false); setSelectedEvent(null); }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  // Log a view whenever a student opens a job detail (card, history, or chat source).
  useEffect(() => {
    if (!selectedJob || !user || canManageVacancies(role)) return;
    recordView({
      id: `${user.uid}_${selectedJob.id}`, studentUid: user.uid,
      jobId: selectedJob.id, jobTitle: selectedJob.title, company: selectedJob.company,
    }).catch(() => { /* View logging is best-effort. */ });
  }, [selectedJob, user, role]);

  // Show the role-specific guide once per account on first sign-in.
  useEffect(() => {
    if (!user || !role) return;
    const k = `guide-seen-${user.uid}`;
    try { if (!localStorage.getItem(k)) { setGuideOpen(true); localStorage.setItem(k, "1"); } } catch { /* ignore */ }
  }, [user, role]);

  const isAnyModalOpen = Boolean(selectedJob || adminOpen || selectedEvent || guideOpen);

  useEffect(() => {
    if (isAnyModalOpen) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      document.body.style.paddingRight = "";
    }

    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, [isAnyModalOpen]);

  const canManageJobs = canManageVacancies(role);
  const isStudent = !canManageJobs;
  // Students browse only approved vacancies; managers see every record.
  const jobs = useMemo(() => (isStudent ? customJobs.filter(isApproved) : customJobs), [customJobs, isStudent]);
  const appliedJobIds = useMemo(() => new Set(myApplications.map((a) => a.jobId)), [myApplications]);
  const programme = useMemo(() => (course ? resolveCourse(course) : null), [course]);
  const companies = useMemo(() => ["All companies", ...Array.from(new Set(jobs.map((job) => job.company))).filter(Boolean).sort()], [jobs]);
  const specializations = useMemo(() => ["All specializations", ...Array.from(new Set(jobs.map((job) => job.specialization))).filter(Boolean).sort()], [jobs]);
  const types = useMemo(() => ["All opportunities", ...Array.from(new Set(jobs.map((job) => job.type))).filter(Boolean).sort()], [jobs]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    const baseMatches = jobs.filter((job) =>
      (!search || [job.title, job.company, job.location, job.specialization].some((value) => value.toLowerCase().includes(search))) &&
      (company === "All companies" || job.company === company) &&
      (specialization === "All specializations" || job.specialization === specialization) &&
      (type === "All opportunities" || job.type === type) &&
      (job.salary === 0 || maxSalary === 10000 || job.salary <= maxSalary)
    );
    // Students can filter to course matches only.
    const kept = isStudent && recommendationMode === "recommended"
      ? baseMatches.filter((job) => jobMatchesCourse(job, course))
      : baseMatches;
    const list = [...kept];
    switch (sort) {
      case "newest": list.sort((a, b) => b.id - a.id); break;      // id = Date.now() at creation
      case "oldest": list.sort((a, b) => a.id - b.id); break;
      case "salary_high": list.sort((a, b) => b.salary - a.salary); break;
      case "salary_low": list.sort((a, b) => a.salary - b.salary); break;
      default: // students: course matches first; managers: newest first
        if (isStudent) list.sort((a, b) => Number(jobMatchesCourse(b, course)) - Number(jobMatchesCourse(a, course)));
        else list.sort((a, b) => b.id - a.id);
    }
    return list;
  }, [jobs, query, company, specialization, type, maxSalary, recommendationMode, course, isStudent, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, pageCount);
  const visibleJobs = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);
  const resetFilters = () => { setQuery(""); setCompany("All companies"); setSpecialization("All specializations"); setType("All opportunities"); setMaxSalary(10000); setSort("default"); setPage(1); };

  function withdrawFromJob(job: Job) {
    if (!user) return;
    deleteApplication(`${user.uid}_${job.id}`).catch(() => { /* best-effort */ });
  }

  function applyToJob(job: Job) {
    if (!user || !myResume) return; // must submit a resume before applying
    recordApplication({
      id: `${user.uid}_${job.id}`, studentUid: user.uid,
      studentEmail: user.email ?? "", studentName: user.displayName || user.email || "Student",
      jobId: job.id, jobTitle: job.title, company: job.company,
      resumeId: myResume ? user.uid : undefined,
    }).catch(() => { /* Application logging is best-effort. */ });
  }

  function glow(event: PointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--mouse-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--mouse-y", `${event.clientY - rect.top}px`);
  }

  const brand = (
    <a className="brand" href="#top" aria-label="QIU Industry Day 2026 home">
      <img className="brand-logo" src="/qiu-logo.png" alt="QIU" />
      <span>Industry <span>Day 2026</span></span>
    </a>
  );

  return (
    <main id="top">
      <header className="topbar">
        {brand}
        <div className="header-actions">
          <button className="icon-button" onClick={() => setGuideOpen(true)} aria-label="How to use this portal" title="Guide">?</button>
          <button className="icon-button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>{theme === "light" ? "☾" : "☀"}</button>
          {canManageJobs && <button className="admin-button" onClick={() => setAdminOpen(true)}>{role === "employer" ? "Employer dashboard" : "Admin dashboard"}</button>}
          <AuthAccount />
        </div>
      </header>

      {scanMsg && (
        <div className="scan-banner" role="status" aria-live="polite"><span>{scanMsg}</span><button type="button" onClick={() => setScanMsg("")} aria-label="Dismiss">×</button></div>
      )}

      {isStudent && resumeChecked && !myResume && tab !== "resume" && (
        <div className="scan-banner" role="status">
          <span>📄 You haven&apos;t submitted a resume yet — add one so you can apply to vacancies.</span>
          <button type="button" className="nudge-btn" onClick={() => setTab("resume")}>Add resume</button>
        </div>
      )}

      <nav className="utility-bar main-tabs" aria-label="Sections" style={{ minHeight: "auto", gap: ".4rem", flexWrap: "wrap" }}>
        {(isStudent
          ? [["vacancies", "Vacancies"], ["history", "History"], ["resume", "My Resume"], ["events", "Events"]]
          : [["vacancies", "Vacancies"], ["events", "Events"]]
        ).map(([key, label]) => (
          <button key={key} type="button" aria-current={tab === key ? "page" : undefined}
            className={`px-3.5 py-2 text-sm font-bold rounded-lg ${tab === key ? "tone-accent" : "text-accent"}`}
            onClick={() => setTab(key as typeof tab)}>{label}</button>
        ))}
      </nav>

      {tab === "vacancies" && <>
      <section className="utility-bar" aria-label="Vacancy display settings">
        <div><strong>Browse vacancies</strong><span>{jobsLoading ? "Loading records…" : `${jobs.length} records available`}</span></div>
        <button className="mobile-filter-toggle" aria-expanded={mobileFiltersOpen} aria-controls="vacancy-filters" onClick={() => setMobileFiltersOpen((open) => !open)}>{mobileFiltersOpen ? "Hide filters" : "Filter results"}</button>
        <label>Per page<select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}>{[6, 9, 12, 24].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label>Layout<select value={columns} onChange={(e) => setColumns(Number(e.target.value))}><option value={3}>3 columns</option><option value={2}>2 columns</option></select></label>
        <label>Text size<select value={textScale} onChange={(e) => setTextScale(e.target.value as TextScale)}><option value="default">Default</option><option value="large">Large</option><option value="xlarge">Extra large</option></select></label>
      </section>

      <section className="workspace" id="jobs">
        <VacancyFilters
          isStudent={isStudent}
          programmeLabel={programme ? `${programme.name}${programme.level ? ` · ${programme.level}` : ""}` : undefined}
          recommendationMode={recommendationMode}
          onRecommendationMode={(mode) => { setRecommendationMode(mode); setPage(1); }}
          query={query}
          onQuery={(value) => { setQuery(value); setPage(1); }}
          company={company}
          companies={companies}
          onCompany={(value) => { setCompany(value); setPage(1); }}
          specialization={specialization}
          specializations={specializations}
          onSpecialization={(value) => { setSpecialization(value); setPage(1); }}
          type={type}
          types={types}
          onType={(value) => { setType(value); setPage(1); }}
          maxSalary={maxSalary}
          onMaxSalary={(value) => { setMaxSalary(value); setPage(1); }}
          sort={sort}
          onSort={(value) => { setSort(value); setPage(1); }}
          mobileFiltersOpen={mobileFiltersOpen}
          onReset={resetFilters}
        />

        <section className="results">
          <div className="results-head"><div><span>VACANCIES</span><h1>{filtered.length} opportunities</h1></div><p>Choose a card to see the role overview, market benchmark, company context, and contact details.</p></div>
          <VacancyList
            jobs={visibleJobs}
            isStudent={isStudent}
            course={course}
            columns={columns}
            currentPage={currentPage}
            pageCount={pageCount}
            onGlow={glow}
            onSelect={setSelectedJob}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(pageCount, p + 1))}
            onReset={resetFilters}
          />
        </section>
      </section>
      </>}

      {tab === "history" && isStudent && (
        <section className="workspace" style={{ gridTemplateColumns: "1fr" }}>
          <StudentHistory jobs={jobs} applications={myApplications} views={myViews} onOpen={setSelectedJob} />
        </section>
      )}

      {tab === "resume" && isStudent && user && (
        <section className="workspace" style={{ gridTemplateColumns: "1fr" }}>
          <StudentResume user={user} course={course} myResume={myResume} />
        </section>
      )}

      {tab === "events" && (
        <section className="workspace" style={{ gridTemplateColumns: "1fr" }}>
          <EventsView events={events} canManageEvents={role === "admin" || role === "superadmin"} userEmail={user?.email ?? ""} myAttendance={myAttendance} onOpenEvent={setSelectedEvent} />
        </section>
      )}

      <footer>{brand}<p>QIU Industry Day 2026. Verify vacancy details directly with the employer.</p>{canManageJobs && <button onClick={() => setAdminOpen(true)}>Admin tools</button>}</footer>

      {selectedJob && (
        <VacancyModal
          job={selectedJob}
          isStudent={isStudent}
          recommended={isStudent && jobMatchesCourse(selectedJob, course)}
          applied={appliedJobIds.has(selectedJob.id)}
          hasResume={Boolean(myResume)}
          applicantCount={jobStats[selectedJob.id] ?? 0}
          onApply={() => applyToJob(selectedJob)}
          onWithdraw={() => withdrawFromJob(selectedJob)}
          onGoToResume={() => { setSelectedJob(null); setTab("resume"); }}
          onClose={() => setSelectedJob(null)}
        />
      )}

      {canManageJobs && (
        <AdminPanel
          open={adminOpen}
          onClose={() => setAdminOpen(false)}
          onCreated={() => { resetFilters(); setAdminOpen(false); }}
          customJobs={customJobs}
          companies={companies}
          specializations={specializations}
          types={types}
        />
      )}

      {selectedEvent && (
        <EventDetail
          event={selectedEvent}
          canManageEvents={role === "admin" || role === "superadmin"}
          userEmail={user?.email ?? ""}
          attendance={myAttendance.find((a) => a.eventId === selectedEvent.id) ?? null}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {guideOpen && <Guide role={role} onClose={() => setGuideOpen(false)} />}
    </main>
  );
}
