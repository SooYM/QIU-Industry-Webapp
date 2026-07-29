"use client";

import { PointerEvent, useEffect, useMemo, useState } from "react";
import { AuthAccount, useAuth } from "./auth-context";
import { canManageVacancies } from "./auth-policy";
import { db } from "./firebase-client";
import {
  isApproved, recordApplication, recordView,
  subscribeApplications, subscribeMyResume, subscribeVacancies, subscribeViews,
} from "../lib/data/firestore";
import type { Application, Job, Resume, ViewEvent } from "../lib/data/types";
import { jobMatchesCourse, resolveCourse } from "../lib/data/course-map";
import { VacancyFilters } from "../features/vacancies/VacancyFilters";
import { VacancyList } from "../features/vacancies/VacancyList";
import { VacancyModal } from "../features/vacancies/VacancyModal";
import { AdminPanel } from "../features/admin/AdminPanel";
import { StudentHistory } from "../features/student/StudentHistory";
import { StudentResume } from "../features/student/StudentResume";
import { PREFS_KEY, type TextScale, type Theme } from "../features/vacancies/vacancy-utils";

export default function Home() {
  const { user, role, course } = useAuth();
  const [customJobs, setCustomJobs] = useState<Job[]>([]);
  const [studentTab, setStudentTab] = useState<"vacancies" | "history" | "resume">("vacancies");
  const [myApplications, setMyApplications] = useState<Application[]>([]);
  const [myViews, setMyViews] = useState<ViewEvent[]>([]);
  const [myResume, setMyResume] = useState<Resume | null>(null);
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

  useEffect(() => {
    try {
      const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Partial<{ perPage: number; columns: number; textScale: TextScale; theme: Theme }>;
      // Hydrate browser preferences only after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if ([6, 9, 12, 24].includes(prefs.perPage ?? 0)) setPerPage(prefs.perPage!);
      if ([2, 3].includes(prefs.columns ?? 0)) setColumns(prefs.columns!);
      if (["default", "large", "xlarge"].includes(prefs.textScale ?? "")) setTextScale(prefs.textScale!);
      const preferredTheme = prefs.theme ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      setTheme(preferredTheme);
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
    const unsubResume = subscribeMyResume(user.uid, setMyResume);
    return () => { unsubApps(); unsubViews(); unsubResume(); };
  }, [user, role]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.textScale = textScale;
    localStorage.setItem(PREFS_KEY, JSON.stringify({ perPage, columns, textScale, theme }));
  }, [perPage, columns, textScale, theme]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setSelectedJob(null); setAdminOpen(false); }
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

  const isAnyModalOpen = Boolean(selectedJob || adminOpen);

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
    if (!isStudent) return baseMatches;
    // Recommend by the student's real course: matching jobs first (and optionally only).
    const scored = baseMatches.map((job) => ({ job, match: jobMatchesCourse(job, course) }));
    const kept = recommendationMode === "recommended" ? scored.filter((s) => s.match) : scored;
    return kept.sort((a, b) => Number(b.match) - Number(a.match)).map((s) => s.job);
  }, [jobs, query, company, specialization, type, maxSalary, recommendationMode, course, isStudent]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, pageCount);
  const visibleJobs = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);
  const resetFilters = () => { setQuery(""); setCompany("All companies"); setSpecialization("All specializations"); setType("All opportunities"); setMaxSalary(10000); setPage(1); };

  function applyToJob(job: Job) {
    if (!user) return;
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
        <nav aria-label="Main navigation"><a className="active" href="#jobs" aria-current="page">Vacancies</a></nav>
        <div className="header-actions">
          <button className="icon-button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>{theme === "light" ? "☾" : "☀"}</button>
          {canManageJobs && <button className="admin-button" onClick={() => setAdminOpen(true)}>{role === "employer" ? "Employer dashboard" : "Admin dashboard"}</button>}
          <AuthAccount />
        </div>
      </header>

      {isStudent && (
        <nav className="utility-bar" aria-label="Student sections" style={{ minHeight: "auto", gap: ".5rem" }}>
          {([["vacancies", "Vacancies"], ["history", "History"], ["resume", "My Resume"]] as const).map(([key, label]) => (
            <button key={key} type="button" aria-current={studentTab === key ? "page" : undefined}
              className={`px-3.5 py-2 text-sm font-bold rounded-lg ${studentTab === key ? "tone-accent" : "text-accent"}`}
              onClick={() => setStudentTab(key)}>{label}</button>
          ))}
        </nav>
      )}

      {(!isStudent || studentTab === "vacancies") && <>
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

      {isStudent && studentTab === "history" && (
        <section className="workspace" style={{ gridTemplateColumns: "1fr" }}>
          <StudentHistory jobs={jobs} applications={myApplications} views={myViews} onOpen={setSelectedJob} />
        </section>
      )}

      {isStudent && studentTab === "resume" && user && (
        <section className="workspace" style={{ gridTemplateColumns: "1fr" }}>
          <StudentResume user={user} course={course} myResume={myResume} />
        </section>
      )}

      <footer>{brand}<p>QIU Industry Day 2026. Verify vacancy details directly with the employer.</p>{canManageJobs && <button onClick={() => setAdminOpen(true)}>Admin tools</button>}</footer>

      {selectedJob && (
        <VacancyModal
          job={selectedJob}
          isStudent={isStudent}
          recommended={isStudent && jobMatchesCourse(selectedJob, course)}
          applied={appliedJobIds.has(selectedJob.id)}
          onApply={() => applyToJob(selectedJob)}
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

    </main>
  );
}
