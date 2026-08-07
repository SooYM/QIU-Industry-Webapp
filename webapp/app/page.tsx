"use client";

import { PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { AuthAccount, useAuth } from "./auth-context";
import { canManageVacancies } from "./auth-policy";
import { usePortalData } from "./use-portal-data";
import {
  checkInAttendance, checkOutAttendance, deleteApplication, getMyAttendance, isApproved,
  recordApplication, recordCompanyView, recordView,
} from "../lib/data/firestore";
import type { AppSettings, Application, Company, EventItem, Job } from "../lib/data/types";
import { hasGeneratedCV, isApprovedCompany } from "../lib/data/types";
import { findCompanyByName } from "../lib/data/company-matching";
import { jobMatchesCourse, resolveCourse } from "../lib/data/course-map";
import { VacancyFilters } from "../features/vacancies/VacancyFilters";
import { VacancyList } from "../features/vacancies/VacancyList";
import { VacancyModal } from "../features/vacancies/VacancyModal";
import { AdminPanel } from "../features/admin/AdminPanel";
import { AdminSummary, type DashboardActivity } from "../features/admin/AdminSummary";
import { EmployerSummary } from "../features/admin/EmployerSummary";
import { DashboardConversationModal } from "../features/admin/DashboardConversationModal";
import { StudentHistory } from "../features/student/StudentHistory";
import { StudentResume } from "../features/student/StudentResume";
import { InterviewBookingModal } from "../features/student/InterviewBookingModal";
import { HomeView } from "../features/home/HomeView";
import { EventsView } from "../features/events/EventsView";
import { EventDetail } from "../features/events/EventDetail";
import { Guide } from "../features/Guide";
import { PREFS_KEY, type Theme, type VacancyView } from "../features/vacancies/vacancy-utils";
import { notify } from "../components/toast";

type Tab = "summary" | "home" | "vacancies" | "history" | "resume" | "events" | "dashboard";

export default function Home() {
  const { user, role, course, employeeId, company: employerCompany } = useAuth();
  const [tab, setTab] = useState<Tab>("home");
  const {
    customJobs, jobsLoading, myApplications, myViews, myResume, resumeChecked, myInterests,
    events, myAttendance, jobStats, exhibitors, settings, interestCounts, refreshInterestCounts,
  } = usePortalData(user, role);
  const [query, setQuery] = useState("");
  const [company, setCompany] = useState("All companies");
  const [specialization, setSpecialization] = useState("All specializations");
  const [type, setType] = useState("All opportunities");
  const [maxSalary, setMaxSalary] = useState(10000);
  const [columns, setColumns] = useState(3);
  const [vacancyView, setVacancyView] = useState<VacancyView>("cards");
  const [theme, setTheme] = useState<Theme>("light");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedDashboardChat, setSelectedDashboardChat] = useState<DashboardActivity | null>(null);
  const [recommendationMode, setRecommendationMode] = useState<"all" | "recommended">("all");
  const [sort, setSort] = useState<"default" | "newest" | "oldest" | "salary_high" | "salary_low">("default");
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [bookingCompany, setBookingCompany] = useState<string | null>(null);
  const [scanMsg, setScanMsg] = useState("");
  const scanHandled = useRef(false);

  useEffect(() => {
    try {
      const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Partial<{ columns: number; vacancyView: VacancyView; theme: Theme }>;
      // Hydrate browser preferences only after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if ([2, 3].includes(prefs.columns ?? 0)) setColumns(prefs.columns!);
      if (["cards", "list"].includes(prefs.vacancyView ?? "")) setVacancyView(prefs.vacancyView!);
      setTheme(prefs.theme ?? "light"); // default light regardless of system setting
    } catch { /* Ignore malformed device-local preferences. */ }
  }, []);

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
          await checkOutAttendance(event, user.uid, code, existing, settings);
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

  useEffect(() => { document.title = settings.portalTitle; }, [settings.portalTitle]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem(PREFS_KEY, JSON.stringify({ columns, vacancyView, theme }));
  }, [columns, vacancyView, theme]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setSelectedJob(null); setSelectedEvent(null); setSelectedDashboardChat(null); setBookingCompany(null); }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  // Log a view whenever a student opens a job detail (card, history, or chat source).
  useEffect(() => {
    if (!selectedJob || !user || canManageVacancies(role)) return;
    recordView({
      id: `${user.uid}_${selectedJob.id}`, studentUid: user.uid,
      studentName: user.displayName ?? "", studentEmail: user.email ?? "",
      ...(employeeId ? { studentEmployeeId: employeeId } : {}),
      jobId: selectedJob.id, jobTitle: selectedJob.title, company: selectedJob.company,
    }).catch(() => { /* View logging is best-effort. */ });
  }, [selectedJob, user, role, employeeId]);

  // Show the role-specific guide once per account on first sign-in.
  useEffect(() => {
    if (!user || !role) return;
    const k = `guide-seen-${user.uid}`;
    try { if (!localStorage.getItem(k)) { setGuideOpen(true); localStorage.setItem(k, "1"); } } catch { /* ignore */ }
  }, [user, role]);

  // "New company" here means: approved, but nobody has filled in the profile —
  // an admin creating it from a registration only ever supplies the name.
  const myCompany = employerCompany ? findCompanyByName(exhibitors, employerCompany) : null;
  const incompleteCompany = role === "employer" && myCompany
    && !myCompany.summary && !myCompany.website && !myCompany.boothNumber
    ? myCompany
    : null;

  const isAnyModalOpen = Boolean(selectedJob || selectedEvent || selectedDashboardChat || bookingCompany || guideOpen);

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

  // Students: Home · Events · My Resume · Vacancies · History (toggle-gated).
  // Managers: a Summary landing + Dashboard tab (no modal button), plus the shared
  // browse tabs. Summary/Dashboard are always on for managers.
  const visibleTabs = useMemo(() => {
    if (!isStudent) {
      const toggleable: [Tab, string][] = ([["home", role === "employer" ? "Companies" : "Home"], ["events", "Events"], ["vacancies", "Vacancies"]] as [Tab, string][])
        .filter(([key]) => settings.tabs[key as keyof AppSettings["tabs"]] !== false);
      return [["summary", "Summary"] as [Tab, string], ["dashboard", role === "employer" ? "Company tools" : "Admin tools"] as [Tab, string], ...toggleable];
    }
    const studentTabs: [Tab, string][] = [["home", "Home"], ["events", "Events"], ["resume", "My Resume"], ["vacancies", "Vacancies"], ["history", "History"]];
    return studentTabs.filter(([key]) => settings.tabs[key as keyof AppSettings["tabs"]] !== false);
  }, [isStudent, role, settings.tabs]);

  // Managers land on the Summary page first (before Home); students keep Home.
  const didInitTab = useRef(false);
  useEffect(() => {
    if (didInitTab.current || !role) return;
    didInitTab.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (canManageVacancies(role)) setTab("summary");
  }, [role]);

  // If the active tab gets toggled off (or isn't available for this role), fall back.
  useEffect(() => {
    if (visibleTabs.length && !visibleTabs.some(([key]) => key === tab)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTab(visibleTabs[0][0]);
    }
  }, [visibleTabs, tab]);
  // Students browse only approved vacancies; managers see every record.
  const jobs = useMemo(() => (isStudent ? customJobs.filter(isApproved) : customJobs), [customJobs, isStudent]);
  const companiesByName = useMemo(() => {
    const approved = exhibitors.filter(isApprovedCompany);
    return new Map(jobs.flatMap((job) => {
      const match = findCompanyByName(approved, job.company);
      return match ? [[job.company.trim().toLowerCase(), match] as const] : [];
    }));
  }, [exhibitors, jobs]);
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

  const resetFilters = () => { setQuery(""); setCompany("All companies"); setSpecialization("All specializations"); setType("All opportunities"); setMaxSalary(10000); setSort("default"); };

  function withdrawFromJob(job: Job) {
    if (!user) return;
    deleteApplication(`${user.uid}_${job.id}`)
      .then(() => notify(`Withdrew your application to ${job.title}.`))
      .catch(() => notify("Could not withdraw. Please try again.", "error"));
  }

  // Withdraw a set of applications at once — used when removing a resume that was
  // shared with those employers (see StudentResume).
  async function withdrawApplications(ids: string[]) {
    await Promise.all(ids.map((id) => deleteApplication(id)));
  }

  function applyToJob(job: Job, choice: "generated" | "link") {
    if (!user || !myResume) return; // must have a resume on file before applying
    recordApplication({
      id: `${user.uid}_${job.id}`, studentUid: user.uid,
      studentEmail: user.email ?? "", studentName: user.displayName || user.email || "Student",
      jobId: job.id, jobTitle: job.title, company: job.company,
      ...(employeeId ? { studentEmployeeId: employeeId } : {}),
      resumeId: user.uid, resumeChoice: choice,
    })
      .then(() => notify(`Applied to ${job.title} — saved to your History.`))
      .catch(() => notify("Could not apply. Please try again.", "error"));
  }

  function glow(event: PointerEvent<HTMLElement>) {
    // The glow itself is switched off under `@media (hover:none)`, but the handler
    // still ran on every touch-drag — two custom-property writes and a style
    // recalc per card while a student flick-scrolls the vacancy list.
    if (event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--mouse-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--mouse-y", `${event.clientY - rect.top}px`);
  }

  function openDashboardActivity(activity: DashboardActivity) {
    if (activity.type === "question") { setSelectedDashboardChat(activity); return; }
    if (activity.jobId) {
      const job = customJobs.find((item) => item.id === activity.jobId);
      if (job) { setSelectedJob(job); return; }
      notify("This vacancy is no longer available.", "error");
      return;
    }
    if (activity.eventId) {
      const event = events.find((item) => item.id === activity.eventId);
      if (event) { setSelectedEvent(event); return; }
      notify("This event is no longer available.", "error");
    }
  }

  const [titleHead, ...titleRest] = settings.portalTitle.split(" ");
  const brandTab: Tab = isStudent
    ? (settings.tabs.home !== false ? "home" : visibleTabs[0]?.[0] ?? "home")
    : "summary";
  const brand = (
    <a className="brand" href="#top" onClick={() => setTab(brandTab)} aria-label={`${settings.portalTitle} — go to ${brandTab}`}>
      <img className="brand-logo" src="/qiu-logo.png" alt="QIU" />
      <span>{titleHead}{titleRest.length ? <> <span>{titleRest.join(" ")}</span></> : null}</span>
    </a>
  );

  return (
    <main id="top">
      <header className="topbar">
        {brand}
        <div className="header-actions">
          <button className="icon-button" onClick={() => setGuideOpen(true)} aria-label="How to use this portal" title="Guide">?</button>
          <button className="icon-button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>{theme === "light" ? "☾" : "☀"}</button>
          <AuthAccount />
        </div>
      </header>

      {scanMsg && (
        <div className="scan-banner" role="status" aria-live="polite"><span>{scanMsg}</span><button type="button" onClick={() => setScanMsg("")} aria-label="Dismiss">×</button></div>
      )}

      {isStudent && resumeChecked && !hasGeneratedCV(myResume?.profile) && !myResume?.fileUrl && tab !== "resume" && settings.tabs.resume !== false && (
        <div className="scan-banner" role="status">
          <span>📄 You haven&apos;t added a resume yet — build a CV or paste a link so you can apply to vacancies.</span>
          <button type="button" className="nudge-btn" onClick={() => setTab("resume")}>Add resume</button>
        </div>
      )}

      {role === "employer" && incompleteCompany && (
        <div className="scan-banner" role="status">
          <span>
            <b>{incompleteCompany.name}</b> has no profile details yet — students see an empty card on the Home
            page. Add a description, website and booth number so they know who you are.
          </span>
          <button type="button" className="nudge-btn" onClick={() => { setTab("dashboard"); }}>Complete profile</button>
        </div>
      )}

      <nav className="utility-bar main-tabs" aria-label="Sections" style={{ minHeight: "auto", gap: ".4rem", flexWrap: "wrap" }}>
        {visibleTabs.map(([key, label]) => (
          <button key={key} type="button" aria-current={tab === key ? "page" : undefined}
            className={`px-3.5 py-2 text-sm font-bold rounded-lg ${tab === key ? "tone-accent" : "text-accent"}`}
            onClick={() => setTab(key)}>{label}</button>
        ))}
      </nav>

      {tab === "summary" && !isStudent && (
        <section className="workspace space-y-6" style={{ gridTemplateColumns: "1fr" }}>
          {role === "employer" ? (
            <EmployerSummary companies={employerCompany ? [employerCompany] : []} onOpenActivity={openDashboardActivity} />
          ) : (
            <AdminSummary onOpenActivity={openDashboardActivity} />
          )}
        </section>
      )}

      {tab === "dashboard" && !isStudent && (
        <section className="workspace" style={{ gridTemplateColumns: "1fr" }}>
          <AdminPanel onCreated={() => { resetFilters(); setTab("vacancies"); }} customJobs={customJobs} companies={companies} specializations={specializations} types={types} />
        </section>
      )}

      {tab === "home" && (
        <section className="workspace" style={{ gridTemplateColumns: "1fr" }}>
          <HomeView
            companies={exhibitors}
            jobs={jobs}
            isStudent={isStudent}
            course={course}
            settings={{ portalTitle: settings.portalTitle, portalTagline: settings.portalTagline }}
            onOpenJob={setSelectedJob}
            onOpenCompany={(c) => { if (isStudent && user) recordCompanyView(c.id, c.name, user.uid); }}
            onBookInterview={isStudent ? setBookingCompany : undefined}
            canSeeVisits={role === "admin" || role === "superadmin" || role === "employer"}
          />
        </section>
      )}

      {tab === "vacancies" && <>
      <section className="utility-bar" aria-label="Vacancy display settings">
        <div><strong>Browse vacancies</strong><span>{jobsLoading ? "Loading records…" : `${jobs.length} records available`}</span></div>
        <button className="mobile-filter-toggle" aria-expanded={mobileFiltersOpen} aria-controls="vacancy-filters" onClick={() => setMobileFiltersOpen((open) => !open)}>{mobileFiltersOpen ? "Hide filters" : "Filter results"}</button>
        <label>Card columns<select value={columns} disabled={vacancyView === "list"} onChange={(e) => setColumns(Number(e.target.value))}><option value={3}>3 columns</option><option value={2}>2 columns</option></select></label>
        <label>View<select value={vacancyView} onChange={(e) => setVacancyView(e.target.value as VacancyView)}><option value="cards">Detailed cards</option><option value="list">List view</option></select></label>
      </section>

      <section className="workspace" id="jobs">
        <VacancyFilters
          isStudent={isStudent}
          programmeLabel={programme ? `${programme.name}${programme.level ? ` · ${programme.level}` : ""}` : undefined}
          recommendationMode={recommendationMode}
          onRecommendationMode={setRecommendationMode}
          query={query}
          onQuery={setQuery}
          company={company}
          companies={companies}
          onCompany={setCompany}
          specialization={specialization}
          specializations={specializations}
          onSpecialization={setSpecialization}
          type={type}
          types={types}
          onType={setType}
          maxSalary={maxSalary}
          onMaxSalary={setMaxSalary}
          sort={sort}
          onSort={setSort}
          mobileFiltersOpen={mobileFiltersOpen}
          onReset={resetFilters}
        />

        <section className="results">
          <div className="results-head"><div><span>VACANCIES</span><h1>{filtered.length} opportunities</h1></div><p>Choose an opportunity to see the role overview, market benchmark, company context, and contact details.</p></div>
          <VacancyList
            jobs={filtered}
            companiesByName={companiesByName}
            isStudent={isStudent}
            course={course}
            appliedIds={appliedJobIds}
            columns={columns}
            view={vacancyView}
            onGlow={glow}
            onSelect={setSelectedJob}
            onReset={resetFilters}
          />
        </section>
      </section>
      </>}

      {tab === "history" && isStudent && (
        <section className="workspace" style={{ gridTemplateColumns: "1fr" }}>
          <StudentHistory jobs={jobs} applications={myApplications} views={myViews} attendance={myAttendance} studentUid={user?.uid} onOpen={setSelectedJob} />
        </section>
      )}

      {tab === "resume" && isStudent && user && (
        <section className="workspace" style={{ gridTemplateColumns: "1fr" }}>
          <StudentResume user={user} course={course} employeeId={employeeId} myResume={myResume} applications={myApplications} onWithdrawApplications={withdrawApplications} />
        </section>
      )}

      {tab === "events" && (
        <section className="workspace" style={{ gridTemplateColumns: "1fr" }}>
          <EventsView
            events={events}
            canManageEvents={role === "admin" || role === "superadmin"}
            userEmail={user?.email ?? ""}
            myAttendance={myAttendance}
            settings={settings}
            course={course}
            isStudent={isStudent}
            myInterests={myInterests}
            interestCounts={interestCounts}
            onOpenEvent={setSelectedEvent}
          />
        </section>
      )}

      <footer>{brand}<p>{settings.portalTagline}</p></footer>

      <a className="back-to-top" href="#top" aria-label="Back to top" title="Back to top">
        <span aria-hidden="true">↑</span>
        <span>Top</span>
      </a>

      {selectedJob && (
        <VacancyModal
          job={selectedJob}
          company={companiesByName.get(selectedJob.company.trim().toLowerCase())}
          isStudent={isStudent}
          recommended={isStudent && jobMatchesCourse(selectedJob, course)}
          applied={appliedJobIds.has(selectedJob.id)}
          hasGeneratedResume={hasGeneratedCV(myResume?.profile)}
          hasResumeLink={Boolean(myResume?.fileUrl)}
          applicantCount={jobStats[selectedJob.id] ?? 0}
          onApply={(choice) => applyToJob(selectedJob, choice)}
          onWithdraw={() => withdrawFromJob(selectedJob)}
          onGoToResume={() => { setSelectedJob(null); setTab("resume"); }}
          onBookInterview={(compName) => setBookingCompany(findCompanyByName(exhibitors, compName)?.name ?? compName)}
          onClose={() => setSelectedJob(null)}
        />
      )}

      {selectedEvent && (
        <EventDetail
          event={selectedEvent}
          canManageEvents={role === "admin" || role === "superadmin"}
          userEmail={user?.email ?? ""}
          userName={user?.displayName || user?.email || "Student"}
          userUid={user?.uid}
          attendance={myAttendance.find((a) => a.eventId === selectedEvent.id) ?? null}
          isInterested={Boolean(myInterests[selectedEvent.id])}
          interestedCount={interestCounts[selectedEvent.id] ?? 0}
          onInterestChanged={refreshInterestCounts}
          settings={settings}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {bookingCompany && user && (
        <InterviewBookingModal
          companyName={bookingCompany}
          studentUid={user.uid}
          studentName={user.displayName || user.email || "Student"}
          studentEmail={user.email ?? ""}
          studentCourse={course ?? undefined}
          studentEmployeeId={employeeId ?? undefined}
          onClose={() => setBookingCompany(null)}
        />
      )}

      {selectedDashboardChat && <DashboardConversationModal activity={selectedDashboardChat} onClose={() => setSelectedDashboardChat(null)} />}

      {guideOpen && <Guide role={role} onClose={() => setGuideOpen(false)} />}
    </main>
  );
}
