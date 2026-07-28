"use client";

import { ChangeEvent, FormEvent, MouseEvent as ReactMouseEvent, PointerEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { AuthAccount, RoleManager, useAuth } from "./auth-context";
import { answerFromJobs } from "./chat";
import type { JobRecord } from "./chat";
import { db } from "./firebase-client";
import { positionTooltip } from "./map-tooltip";
import type { TooltipPosition } from "./map-tooltip";
import { StudentProfile, sampleStudentProfiles } from "./student-data";
import { evaluateJobForStudent } from "./recommendation";
import { CvGeneratorModal } from "./cv-generator";
import { StudentModal } from "./student-modal";

type Job = JobRecord & {
  vacancies: number;
  location: string;
  salaryLabel: string;
  salary: number;
  payFrequency: string;
  minimumRequirement: string;
  detailsLink: string;
  email: string;
  companySummary: string;
  companySources: string[];
  isCustom?: boolean;
  locationMode?: "malaysia" | "international";
  state?: string;
  country?: string;
  mapX?: number;
  mapY?: number;
};

type ChatMessage = { role: "user" | "assistant"; content: string; sources?: Job[] };
type Theme = "light" | "dark";
type TextScale = "default" | "large" | "xlarge";
type CountryShape = { name: string; path: string };
type GeoFeature = { properties: { name: string }; geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] } };
type AdminDraft = Pick<Job, "title" | "company" | "type" | "specialization" | "vacancies" | "minimumRequirement" | "email"> & {
  salary: string;
  locationMode: "malaysia" | "international";
  state: string;
  country: string;
  mapX?: number;
  mapY?: number;
};

const DOSM_SOURCE = "https://www.dosm.gov.my/portal-main/release-content/salaries-and-wages-survey-report-2024";
const PREFS_KEY = "vacancyportal-view-prefs";
const emptyDraft: AdminDraft = { title: "", company: "", type: "Permanent", specialization: "", locationMode: "malaysia", state: "", country: "", salary: "", vacancies: 1, minimumRequirement: "Diploma", email: "" };
const malaysiaStates = ["Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan", "Pahang", "Pulau Pinang", "Perak", "Perlis", "Sabah", "Sarawak", "Selangor", "Terengganu", "W.P. Kuala Lumpur", "W.P. Labuan", "W.P. Putrajaya"];
const malaysiaStateAliases: Record<string, string> = { "Kuala Lumpur": "W.P. Kuala Lumpur" };

function countryPath(feature: GeoFeature) {
  const polygons = feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates as number[][][]]
    : feature.geometry.coordinates as number[][][][];
  return polygons.flatMap((polygon) => polygon.map((ring) => {
    let previousX: number | undefined;
    return ring.map(([longitude, latitude], index) => {
      const x = ((longitude + 180) / 360) * 1000;
      const y = ((90 - latitude) / 180) * 500;
      const command = index === 0 || (previousX !== undefined && Math.abs(x - previousX) > 500) ? "M" : "L";
      previousX = x;
      return `${command}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ") + " Z";
  })).join(" ");
}

const salaryBenchmarks = [
  { match: /manufactur|engineering|quality|production|machine|operator/i, amount: 3278, label: "Manufacturing sector mean" },
  { match: /construction|architect|quantity|building|civil/i, amount: 3035, label: "Construction sector mean" },
  { match: /agri|farm|plantation/i, amount: 2409, label: "Agriculture sector mean" },
  { match: /clerical|administrative|secretarial|reception/i, amount: 2931, label: "Clerical support mean" },
  { match: /sales|retail|hotel|tourism|food|beverage|restaurant|customer service/i, amount: 2561, label: "Services and sales mean" },
  { match: /mining|quarry/i, amount: 5904, label: "Mining and quarrying sector mean" },
  { match: /software|information|technology|account|audit|bank|finance|education|health|marketing|design/i, amount: 3831, label: "Services sector mean" },
];

function formatSalary(job: Job) {
  return job.salary ? `RM ${job.salary.toLocaleString()} / ${job.payFrequency.toLowerCase()}` : "Salary not stated";
}

function benchmarkFor(job: Job) {
  const haystack = `${job.title} ${job.specialization}`;
  return salaryBenchmarks.find((item) => item.match.test(haystack)) ?? { amount: 3652, label: "Malaysia employee mean" };
}

function roleDescription(job: Job) {
  const role = job.title.toLowerCase();
  const specialization = job.specialization.toLowerCase();
  let focus = `support day-to-day work in ${job.specialization.toLowerCase()}, coordinate assigned tasks, maintain accurate records, and communicate progress with the team`;
  if (/account|audit|tax|finance|bank/.test(role + specialization)) focus = "support financial records, reconciliations, reporting, documentation, and routine compliance work";
  else if (/software|developer|program|technology|digital/.test(role + specialization)) focus = "support digital systems, troubleshoot issues, document work, and contribute to assigned technical or product tasks";
  else if (/marketing|design|creative|content/.test(role + specialization)) focus = "help prepare campaigns or creative materials, coordinate content, and track the delivery of assigned marketing work";
  else if (/hotel|tourism|restaurant|food|chef|hospitality/.test(role + specialization)) focus = "support guest or food-service operations, follow service procedures, and help maintain a safe, organised customer experience";
  else if (/admin|clerical|reception|secretar/.test(role + specialization)) focus = "handle routine administration, organise documents, coordinate enquiries, and keep office information up to date";
  else if (/sales|retail|customer/.test(role + specialization)) focus = "assist customers, explain available products or services, follow up on enquiries, and maintain accurate sales records";
  else if (/engineer|technician|maintenance|production|quality/.test(role + specialization)) focus = "support technical or production work, follow safety and quality procedures, document findings, and escalate operational issues";
  return `This ${job.type.toLowerCase()} opportunity is expected to ${focus}. The listing asks for at least ${job.minimumRequirement.toLowerCase()} level and is based in ${job.location}. This overview is generated from the vacancy title and specialization; confirm exact duties with the employer.`;
}

export default function Home() {
  const { user, role } = useAuth();
  const [customJobs, setCustomJobs] = useState<Job[]>([]);
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
  const [draft, setDraft] = useState<AdminDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [adminMessage, setAdminMessage] = useState("");
  const [adminQuery, setAdminQuery] = useState("");
  const [adminCompany, setAdminCompany] = useState("All companies");
  const [adminSpecialization, setAdminSpecialization] = useState("All specializations");
  const [adminType, setAdminType] = useState("All opportunities");
  const [countryShapes, setCountryShapes] = useState<CountryShape[]>([]);
  const [hoveredCountry, setHoveredCountry] = useState<{ name: string; x: number; y: number } | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>({ left: 8, top: 8 });
  const worldMapRef = useRef<HTMLButtonElement>(null);
  const countryTooltipRef = useRef<HTMLSpanElement>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Ask me to compare jobs, find internships, or explain a listed company profile. I only use the supplied vacancy records." },
  ]);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const [currentStudent, setCurrentStudent] = useState<StudentProfile>(sampleStudentProfiles[0]);
  const [recommendationMode, setRecommendationMode] = useState<"all" | "recommended" | "excluded">("all");
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [cvModalOpen, setCvModalOpen] = useState(false);

  useEffect(() => {
    if (!chatOpen || !chatMessagesRef.current) return;
    chatMessagesRef.current.scrollTo({
      top: chatMessagesRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages, chatOpen]);

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
    return onSnapshot(collection(db, "vacancies"), (snapshot) => {
      setCustomJobs(snapshot.docs.map((item) => item.data() as Job).sort((a, b) => b.id - a.id));
      setJobsLoading(false);
    }, () => {
      setAdminMessage("Vacancies could not be loaded.");
      setJobsLoading(false);
    });
  }, [user]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.textScale = textScale;
    localStorage.setItem(PREFS_KEY, JSON.stringify({ perPage, columns, textScale, theme }));
  }, [perPage, columns, textScale, theme]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setSelectedJob(null); setAdminOpen(false); setChatOpen(false); }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  const isAnyModalOpen = Boolean(selectedJob || adminOpen || studentModalOpen || cvModalOpen);

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

  useEffect(() => {
    if (!adminOpen || countryShapes.length) return;
    fetch("/countries.geojson")
      .then((response) => response.json())
      .then((data: { features: GeoFeature[] }) => setCountryShapes(data.features.map((feature) => ({
        name: feature.properties.name,
        path: countryPath(feature),
      })).sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setAdminMessage("The interactive country map could not be loaded."));
  }, [adminOpen, countryShapes.length]);

  useLayoutEffect(() => {
    if (!hoveredCountry || !worldMapRef.current || !countryTooltipRef.current) return;
    const map = worldMapRef.current.getBoundingClientRect();
    const tooltip = countryTooltipRef.current.getBoundingClientRect();
    const nextPosition = positionTooltip(hoveredCountry.x, hoveredCountry.y, map.width, map.height, tooltip.width, tooltip.height);
    setTooltipPosition(nextPosition);
  }, [hoveredCountry]);

  const jobs = customJobs;
  const canManageJobs = role === "admin" || role === "superadmin";
  const isStudent = !canManageJobs;
  const companies = useMemo(() => ["All companies", ...Array.from(new Set(jobs.map((job) => job.company))).filter(Boolean).sort()], [jobs]);
  const specializations = useMemo(() => ["All specializations", ...Array.from(new Set(jobs.map((job) => job.specialization))).filter(Boolean).sort()], [jobs]);
  const types = useMemo(() => ["All opportunities", ...Array.from(new Set(jobs.map((job) => job.type))).filter(Boolean).sort()], [jobs]);
  useEffect(() => {
    // Keep controlled selects valid when an edit or deletion removes their selected option.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!companies.includes(adminCompany)) setAdminCompany("All companies");
    if (!specializations.includes(adminSpecialization)) setAdminSpecialization("All specializations");
    if (!types.includes(adminType)) setAdminType("All opportunities");
  }, [companies, specializations, types, adminCompany, adminSpecialization, adminType]);

  useEffect(() => {
    if (!isStudent || !currentStudent || specializations.length <= 1) return;
    const haystack = `${currentStudent.major} ${currentStudent.faculty}`.toLowerCase();
    
    let targetPattern: RegExp | null = null;
    if (/computer science|information technology|artificial intelligence|cybersecurity|software|computing/i.test(haystack)) {
      targetPattern = /^IT\b|IT\s*-|Software/i;
    } else if (/accountancy|accounting|finance|acca/i.test(haystack)) {
      targetPattern = /accounting|finance/i;
    } else if (/business|administration/i.test(haystack)) {
      targetPattern = /marketing\/business|business/i;
    } else if (/hospitality|hotel|culinary/i.test(haystack)) {
      targetPattern = /hotel|tourism|food/i;
    } else if (/communication|advertising|journalism|media/i.test(haystack)) {
      targetPattern = /digital marketing|advertising|creative|journalist/i;
    } else if (/mechatronics|engineering|electronics/i.test(haystack)) {
      targetPattern = /manufacturing|engineering/i;
    } else if (/food science|biotechnology|environmental|life sciences|pharmacy|biomedical/i.test(haystack)) {
      targetPattern = /food tech|nutritionist|manufacturing/i;
    } else if (/education|tesl|special needs|early childhood/i.test(haystack)) {
      targetPattern = /education/i;
    } else if (/psychology/i.test(haystack)) {
      targetPattern = /human resources|education/i;
    }

    if (targetPattern) {
      const matchedSpec = specializations.find((s) => targetPattern!.test(s));
      if (matchedSpec) {
        setSpecialization(matchedSpec);
        setPage(1);
      }
    }
  }, [isStudent, currentStudent, specializations]);
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
    return baseMatches
      .filter((job) => {
        const rec = evaluateJobForStudent(job, currentStudent);
        if (recommendationMode === "recommended") return rec.status === "recommended";
        if (recommendationMode === "excluded") return rec.status === "excluded";
        return true;
      })
      .sort((a, b) => {
        const recA = evaluateJobForStudent(a, currentStudent);
        const recB = evaluateJobForStudent(b, currentStudent);
        if (recA.status === "excluded" && recB.status !== "excluded") return 1;
        if (recA.status !== "excluded" && recB.status === "excluded") return -1;
        return recB.matchScore - recA.matchScore;
      });
  }, [jobs, query, company, specialization, type, maxSalary, recommendationMode, currentStudent, isStudent]);
  const adminFilteredJobs = useMemo(() => {
    const search = adminQuery.trim().toLowerCase();
    return customJobs.filter((job) =>
      (!search || [job.title, job.company, job.location, job.specialization, job.type].some((value) => value.toLowerCase().includes(search))) &&
      (adminCompany === "All companies" || job.company === adminCompany) &&
      (adminSpecialization === "All specializations" || job.specialization === adminSpecialization) &&
      (adminType === "All opportunities" || job.type === adminType)
    );
  }, [customJobs, adminQuery, adminCompany, adminSpecialization, adminType]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, pageCount);
  const visibleJobs = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);
  const selectedMapCountry = countryShapes.find((country) => country.name.toLocaleLowerCase() === draft.country.trim().toLocaleLowerCase())?.name;
  const adminMessageIsError = adminMessage.startsWith("Complete") || adminMessage.includes("could not");
  const resetFilters = () => { setQuery(""); setCompany("All companies"); setSpecialization("All specializations"); setType("All opportunities"); setMaxSalary(10000); setPage(1); };
  const resetAdminFilters = () => { setAdminQuery(""); setAdminCompany("All companies"); setAdminSpecialization("All specializations"); setAdminType("All opportunities"); };

  function glow(event: PointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--mouse-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--mouse-y", `${event.clientY - rect.top}px`);
  }

  async function saveVacancy(event: FormEvent) {
    event.preventDefault();
    if (!canManageJobs || !db || !user) return;
    const location = draft.locationMode === "malaysia" ? draft.state : draft.country.trim();
    if (!draft.title.trim() || !draft.company.trim() || !draft.specialization.trim() || !location) {
      setAdminMessage("Complete the role, company, specialization, and location fields.");
      return;
    }
    const salary = draft.salary === "" ? 0 : Number(draft.salary);
    const isEditing = editingId !== null;
    const existingJob = isEditing ? customJobs.find((job) => job.id === editingId) : undefined;
    const newJob: Job = {
      ...draft,
      id: editingId ?? Date.now(),
      location,
      salary,
      salaryLabel: salary ? `MYR${salary}` : "Not stated",
      payFrequency: existingJob?.payFrequency ?? "Monthly",
      detailsLink: existingJob?.detailsLink ?? "",
      companySummary: existingJob?.companySummary ?? "",
      companySources: existingJob?.companySources ?? [],
      isCustom: true,
    };
    try {
      const jobData = { ...JSON.parse(JSON.stringify(newJob)) as Job, updatedAt: serverTimestamp(), isCustom: true };
      if (isEditing) await updateDoc(doc(db, "vacancies", String(newJob.id)), jobData);
      else await setDoc(doc(db, "vacancies", String(newJob.id)), { ...jobData, createdBy: user.uid, createdAt: serverTimestamp() });
      setDraft(emptyDraft);
      setEditingId(null);
      if (isEditing) setAdminMessage("Vacancy updated.");
      else { setAdminMessage(""); resetFilters(); setAdminOpen(false); }
    } catch { setAdminMessage("Vacancy could not be saved."); }
  }

  async function removeCustomJob(id: number) {
    if (!canManageJobs || !db) return;
    try {
      await deleteDoc(doc(db, "vacancies", String(id)));
      if (editingId === id) { setEditingId(null); setDraft(emptyDraft); }
      setAdminMessage("Vacancy deleted.");
    } catch { setAdminMessage("Vacancy could not be deleted."); }
  }

  async function importVacancies(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || role !== "superadmin" || !db || !user) return;
    try {
      const activeDb = db;
      const imported = JSON.parse(await file.text()) as Job[];
      if (!Array.isArray(imported) || imported.length > 500 || imported.some((job) => !job.id || !job.title || !job.company)) throw new Error();
      const batch = writeBatch(activeDb);
      imported.forEach((job) => {
        const malaysiaState = malaysiaStates.includes(job.location) ? job.location : malaysiaStateAliases[job.location];
        batch.set(doc(activeDb, "vacancies", String(job.id)), {
          ...JSON.parse(JSON.stringify(job)) as Job,
          isCustom: true,
          location: malaysiaState ?? job.location,
          locationMode: malaysiaState ? "malaysia" : "international",
          state: malaysiaState ?? "",
          country: malaysiaState ? "" : job.location,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
      setAdminMessage(`${imported.length} vacancies imported.`);
    } catch { setAdminMessage("Import failed. Choose a valid vacancy JSON file with no more than 500 records."); }
  }

  function editCustomJob(job: Job) {
    const inferredMalaysia = job.locationMode === "malaysia" || (!job.locationMode && malaysiaStates.includes(job.location));
    setEditingId(job.id);
    setDraft({
      title: job.title,
      company: job.company,
      type: job.type,
      specialization: job.specialization,
      locationMode: inferredMalaysia ? "malaysia" : "international",
      state: job.state ?? (inferredMalaysia ? job.location : ""),
      country: job.country ?? (inferredMalaysia ? "" : job.location),
      mapX: job.mapX,
      mapY: job.mapY,
      salary: job.salary ? String(job.salary) : "",
      vacancies: job.vacancies,
      minimumRequirement: job.minimumRequirement,
      email: job.email,
    });
    setAdminMessage("Editing vacancy. Save to apply changes.");
  }

  function pinpointCountry(event: ReactMouseEvent<HTMLButtonElement>) {
    const pointedCountry = (event.target as SVGElement).dataset?.country;
    setDraft({ ...draft, country: pointedCountry ?? hoveredCountry?.name ?? draft.country, mapX: undefined, mapY: undefined });
  }

  function moveCountryLabel(event: PointerEvent<HTMLButtonElement>) {
    const name = (event.target as SVGElement).dataset?.country;
    if (!name) {
      setHoveredCountry(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setHoveredCountry({
      name,
      x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)),
    });
  }

  function askAssistant(event?: FormEvent, suggested?: string) {
    event?.preventDefault();
    const question = (suggested ?? chatInput).trim();
    if (!question) return;
    setChatOpen(true);
    setChatInput("");
    setMessages((current) => [...current, { role: "user", content: question }]);
    const result = answerFromJobs(question, jobs);
    setMessages((current) => [...current, { role: "assistant", content: result.answer, sources: result.sources as Job[] }]);
  }

  return (
    <main id="top">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="VacancyPortal home"><span className="brand-mark">VP</span><span>Vacancy<span>Portal</span></span><small>POC</small></a>
        <nav aria-label="Main navigation"><a className="active" href="#jobs" aria-current="page">Vacancies</a><button onClick={() => setChatOpen(true)}>Assistant</button></nav>
        <div className="header-actions">
          {isStudent && (
            <>
              <button className="icon-button" onClick={() => setStudentModalOpen(true)} title="View Student Academic Results & Transcript">🎓</button>
              <button className="admin-button border border-indigo-200 bg-indigo-50/90 text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-200 dark:hover:bg-indigo-900 font-bold transition-all shadow-sm" onClick={() => setCvModalOpen(true)}>📄 1-Click CV Generator</button>
            </>
          )}
          <button className="icon-button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>{theme === "light" ? "☾" : "☀"}</button>
          {canManageJobs && <button className="admin-button" onClick={() => setAdminOpen(true)}>＋ Add vacancy</button>}
          <button className="assistant-button" onClick={() => setChatOpen(true)}><span>✦</span> Ask assistant</button>
          <AuthAccount />
        </div>
      </header>

      <section className="utility-bar" aria-label="Vacancy display settings">
        <div><strong>Browse vacancies</strong><span>{jobsLoading ? "Loading records…" : `${jobs.length} records available`}</span></div>
        <button className="mobile-filter-toggle" aria-expanded={mobileFiltersOpen} aria-controls="vacancy-filters" onClick={() => setMobileFiltersOpen((open) => !open)}>{mobileFiltersOpen ? "Hide filters" : "Filter results"}</button>
        <label>Per page<select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}>{[6, 9, 12, 24].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label>Layout<select value={columns} onChange={(e) => setColumns(Number(e.target.value))}><option value={3}>3 columns</option><option value={2}>2 columns</option></select></label>
        <label>Text size<select value={textScale} onChange={(e) => setTextScale(e.target.value as TextScale)}><option value="default">Default</option><option value="large">Large</option><option value="xlarge">Extra large</option></select></label>
      </section>

      <section className="workspace" id="jobs">
        <aside className={`filters ${mobileFiltersOpen ? "open" : ""}`} id="vacancy-filters">
          <div className="section-heading"><div><span>FILTERS</span><h2>Refine results</h2></div><button onClick={resetFilters}>Reset</button></div>
          
          {isStudent && (
            <>
              <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/80 p-3.5 dark:border-indigo-900/60 dark:bg-indigo-950/50 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">🎓 Student Academic Match</span>
                  <button type="button" onClick={() => setStudentModalOpen(true)} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 underline hover:opacity-80">Switch Profile</button>
                </div>
                <div className="mt-1 text-xs font-bold text-slate-900 dark:text-white">{currentStudent.fullName}</div>
                <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300">{currentStudent.major} • CGPA {currentStudent.cgpa.toFixed(2)}</div>
              </div>

              <label className="field">
                <span>AI Academic Recommendation</span>
                <select value={recommendationMode} onChange={(e) => { setRecommendationMode(e.target.value as "all" | "recommended" | "excluded"); setPage(1); }}>
                  <option value="all">All Vacancies (Score Sorted)</option>
                  <option value="recommended">🌟 Recommended for Me (High Grades)</option>
                  <option value="excluded">⚠️ Excluded Vacancies (Low Subject Grades)</option>
                </select>
              </label>
            </>
          )}

          <label className="field"><span>Search</span><div className="search-wrap"><input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Role, company or location" /></div></label>
          <label className="field"><span>Company</span><select value={company} onChange={(e) => { setCompany(e.target.value); setPage(1); }}>{companies.map(item => <option key={item}>{item}</option>)}</select></label>
          <label className="field"><span>Specialization</span><select value={specialization} onChange={(e) => { setSpecialization(e.target.value); setPage(1); }}>{specializations.map(item => <option key={item}>{item}</option>)}</select></label>
          <label className="field"><span>Opportunity type</span><select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>{types.map(item => <option key={item}>{item}</option>)}</select></label>
          <label className="field salary-field"><span>Maximum monthly salary <b>RM {maxSalary.toLocaleString()}</b></span><input type="range" min="500" max="10000" step="100" value={maxSalary} onChange={(e) => { setMaxSalary(Number(e.target.value)); setPage(1); }} /><div><small>RM 500</small><small>RM 10,000+</small></div></label>
          <button className="intern-shortcut" onClick={() => { setType("Internship"); setPage(1); }}><span aria-hidden="true">IN</span><div><strong>Internships</strong><small>Show internship listings only</small></div><b aria-hidden="true">→</b></button>
          <div className="data-note"><span>i</span><p><strong>Market salary context</strong><br/>Details use 2024 DOSM occupation or sector means. They are benchmarks, not employer offers.</p></div>
        </aside>

        <section className="results">
          <div className="results-head"><div><span>VACANCIES</span><h1>{filtered.length} opportunities</h1></div><p>Choose a card to see the role overview, market benchmark, company context, and contact details.</p></div>
          {visibleJobs.length ? <div className="job-grid" style={{ "--columns": columns } as CSSProperties}>{visibleJobs.map(job => {
            const rec = isStudent ? evaluateJobForStudent(job, currentStudent) : null;
            return (
              <article className="job-card" key={job.id} tabIndex={0} role="button" aria-label={`View ${job.title} at ${job.company}`} onPointerMove={glow} onClick={() => setSelectedJob(job)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedJob(job); } }}>
                <div className="card-top">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`type ${job.type.toLowerCase().includes("intern") ? "intern" : ""}`}>{job.type}</span>
                    {rec?.status === "recommended" && (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        🌟 {rec.matchScore}% Match
                      </span>
                    )}
                    {rec?.status === "excluded" && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-800 dark:bg-red-950 dark:text-red-300">
                        ⚠️ Low Grade
                      </span>
                    )}
                  </div>
                  <span className="vacancies">{job.vacancies} {job.vacancies === 1 ? "place" : "places"}</span>
                </div>
                <h2>{job.title}</h2><p className="company">{job.company}</p>
                <div className="meta"><span>{job.location}</span><span>{job.specialization}</span><span>{job.minimumRequirement}</span></div>
                <div className="card-foot"><div><small>LISTED SALARY</small><strong>{formatSalary(job)}</strong></div><span className="view-job">View details <span>→</span></span></div>
              </article>
            );
          })}</div> : <div className="empty"><strong>No matching vacancies</strong><p>Try widening the salary range or clearing a filter.</p><button onClick={resetFilters}>Reset filters</button></div>}
          {pageCount > 1 && <div className="pagination"><button disabled={currentPage === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>← Previous</button><span>Page {currentPage} of {pageCount}</span><button disabled={currentPage === pageCount} onClick={() => setPage(p => Math.min(pageCount, p + 1))}>Next →</button></div>}
        </section>
      </section>

      <footer><a className="brand" href="#top"><span className="brand-mark">VP</span><span>Vacancy<span>Portal</span></span></a><p>Proof of concept. Verify vacancy details directly with the employer.</p>{canManageJobs && <button onClick={() => setAdminOpen(true)}>Admin tools</button>}</footer>

      {selectedJob && (() => {
        const rec = isStudent ? evaluateJobForStudent(selectedJob, currentStudent) : null;
        return (
          <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedJob(null); }}><section className="job-detail" role="dialog" aria-modal="true" aria-labelledby="job-detail-title">
            <button className="modal-close" onClick={() => setSelectedJob(null)} aria-label="Close job details" autoFocus>×</button>
            <div className="detail-header">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`type ${selectedJob.type.toLowerCase().includes("intern") ? "intern" : ""}`}>{selectedJob.type}</span>
                  {rec && (
                    <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${rec.status === "recommended" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : rec.status === "excluded" ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}>
                      Academic Match: {rec.matchScore}% ({rec.status})
                    </span>
                  )}
                </div>
                <h2 id="job-detail-title">{selectedJob.title}</h2>
                <p>{selectedJob.company} · {selectedJob.location}</p>
              </div>
              <div className="detail-salary"><small>LISTED SALARY</small><strong>{formatSalary(selectedJob)}</strong></div>
            </div>
            <div className="detail-grid">
              <div className="detail-main">
                <section><span className="detail-label">ROLE OVERVIEW</span><p>{roleDescription(selectedJob)}</p></section>
                {rec && (rec.highlights.length > 0 || rec.exclusions.length > 0) && (
                  <section className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3.5 dark:border-indigo-900/50 dark:bg-indigo-950/30">
                    <span className="detail-label">ACADEMIC GRADE MATCH ANALYSIS</span>
                    {rec.highlights.map((h, i) => <p key={i} className="mt-1 text-xs text-emerald-700 dark:text-emerald-400 font-medium">✓ {h}</p>)}
                    {rec.exclusions.map((e, i) => <p key={i} className="mt-1 text-xs text-red-600 dark:text-red-400 font-medium">✕ {e}</p>)}
                  </section>
                )}
                <section><span className="detail-label">LISTING DETAILS</span><dl><div><dt>Specialization</dt><dd>{selectedJob.specialization}</dd></div><div><dt>Minimum requirement</dt><dd>{selectedJob.minimumRequirement}</dd></div><div><dt>Available places</dt><dd>{selectedJob.vacancies}</dd></div><div><dt>Pay frequency</dt><dd>{selectedJob.payFrequency}</dd></div></dl></section>
                {selectedJob.companySummary && <section><span className="detail-label">SUPPLIED COMPANY DISCUSSION</span><p className="company-context">{selectedJob.companySummary}</p><small className="caution">Unverified supplied snippets; confirm independently.</small></section>}
              </div>
              <aside className="market-card"><span className="detail-label">MALAYSIA MARKET CONTEXT</span><strong>RM {benchmarkFor(selectedJob).amount.toLocaleString()}</strong><p>{benchmarkFor(selectedJob).label}, monthly, DOSM Salaries & Wages Survey 2024.</p>{selectedJob.type.toLowerCase().includes("intern") && <div className="benchmark-note">This workforce benchmark is not an internship allowance estimate.</div>}<a href={DOSM_SOURCE} target="_blank" rel="noreferrer">View official source ↗</a><hr/><span className="detail-label">CONTACT</span>{selectedJob.email ? <a className="enquire-main" href={`mailto:${selectedJob.email}?subject=${encodeURIComponent(`Enquiry: ${selectedJob.title}`)}`}>Email employer →</a> : <p>No enquiry email supplied.</p>}</aside>
            </div>
          </section></div>
        );
      })()}

      {adminOpen && canManageJobs && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAdminOpen(false); }}><section className="admin-panel" role="dialog" aria-modal="true" aria-labelledby="admin-title">
        <button className="modal-close" onClick={() => setAdminOpen(false)} aria-label="Close admin tools" autoFocus>×</button><span className="detail-label">ADMIN</span><h2 id="admin-title">{editingId ? "Edit vacancy" : "Add a vacancy"}</h2><p className="admin-intro">Changes are shared with signed-in VacancyPortal users.</p>
        {role === "superadmin" && <label className="import-vacancies">Initial data import<input type="file" accept="application/json,.json" onChange={importVacancies}/><small>Select private vacancy JSON. File stays local and only its records are uploaded to Firestore.</small></label>}
        {role === "superadmin" && <RoleManager />}
        <form onSubmit={saveVacancy} className="admin-form"><label>Job title<input required value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })}/></label><label>Company<input required value={draft.company} onChange={e => setDraft({ ...draft, company: e.target.value })}/></label><label>Type<select value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value })}><option>Permanent</option><option>Internship</option><option>Contract</option><option>Part-time</option></select></label><label>Specialization<select required value={draft.specialization} onChange={e => setDraft({ ...draft, specialization: e.target.value })}><option value="" disabled>Select specialization</option>{specializations.filter(item => item !== "All specializations").map(item => <option key={item} value={item}>{item}</option>)}</select></label>
          <fieldset className="location-choice full"><legend>Location type</legend><label><input type="radio" name="location-mode" checked={draft.locationMode === "malaysia"} onChange={() => setDraft({ ...draft, locationMode: "malaysia", country: "", mapX: undefined, mapY: undefined })}/> Malaysia</label><label><input type="radio" name="location-mode" checked={draft.locationMode === "international"} onChange={() => setDraft({ ...draft, locationMode: "international", state: "" })}/> International</label></fieldset>
          {draft.locationMode === "malaysia" ? <label className="full">Malaysian state<select required value={draft.state} onChange={e => setDraft({ ...draft, state: e.target.value })}><option value="" disabled>Select state or federal territory</option>{malaysiaStates.map(state => <option key={state} value={state}>{state}</option>)}</select></label> : <div className="international-location full"><label>Exact country<input required list="world-country-list" value={draft.country} placeholder="e.g. Singapore" onChange={e => setDraft({ ...draft, country: e.target.value })}/><datalist id="world-country-list">{countryShapes.map(country => <option key={country.name} value={country.name}/>)}</datalist></label><span className="map-instruction">Hover to identify a country. Click it to select and highlight the country.</span><button ref={worldMapRef} type="button" className="world-map" onClick={pinpointCountry} onPointerMove={moveCountryLabel} onPointerLeave={() => setHoveredCountry(null)} aria-label={`World map country location picker${hoveredCountry ? `: ${hoveredCountry.name}` : ""}`}><svg viewBox="0 0 1000 500" role="img" aria-label="Interactive world countries">{countryShapes.map(country => <path key={country.name} d={country.path} data-country={country.name} className={selectedMapCountry === country.name ? "selected-country" : undefined}/>)}</svg>{!countryShapes.length && <span className="map-loading">Loading countries…</span>}{hoveredCountry && <span ref={countryTooltipRef} className="country-tooltip" style={{ left: tooltipPosition.left, top: tooltipPosition.top }}>{hoveredCountry.name}</span>}</button><small>{selectedMapCountry ? `${selectedMapCountry} selected and highlighted.` : "No country selected yet."}</small><a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Public-domain boundaries: Natural Earth ↗</a></div>}
          <label>Monthly salary (RM)<input type="number" min="0" step="1" placeholder="e.g. 1800" value={draft.salary} onChange={e => setDraft({ ...draft, salary: e.target.value })}/></label><label>Vacancies<input type="number" min="1" value={draft.vacancies} onChange={e => setDraft({ ...draft, vacancies: Number(e.target.value) })}/></label><label>Minimum requirement<select value={draft.minimumRequirement} onChange={e => setDraft({ ...draft, minimumRequirement: e.target.value })}><option>SPM</option><option>Certificate</option><option>Diploma</option><option>Degree</option><option>Post-graduate</option></select></label><label><span className="field-label">Enquiry email <small>Optional</small></span><input type="email" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })}/></label><div className="admin-form-footer full">{adminMessage && <p className={`admin-message ${adminMessageIsError ? "error" : ""}`} role="status" aria-live="polite">{adminMessage}</p>}<div className="admin-submit">{editingId && <button type="button" className="cancel-edit" onClick={() => { setEditingId(null); setDraft(emptyDraft); setAdminMessage(""); }}>Cancel edit</button>}<button className="save-job" type="submit">{editingId ? "Save changes" : "Add vacancy"}</button></div></div></form>
        {customJobs.length > 0 && <section className="local-jobs" aria-labelledby="admin-vacancies-title"><div className="local-jobs-head"><div><span className="detail-label">VACANCIES</span><h3 id="admin-vacancies-title">Manage vacancies</h3></div><strong aria-live="polite">{adminFilteredJobs.length} of {customJobs.length}</strong></div><div className="admin-job-filters"><label className="admin-job-search"><span>Search vacancies</span><input type="search" value={adminQuery} onChange={e => setAdminQuery(e.target.value)} placeholder="Title, company or location"/></label><label><span>Company</span><select value={adminCompany} onChange={e => setAdminCompany(e.target.value)}>{companies.map(item => <option key={item}>{item}</option>)}</select></label><label><span>Specialization</span><select value={adminSpecialization} onChange={e => setAdminSpecialization(e.target.value)}>{specializations.map(item => <option key={item}>{item}</option>)}</select></label><label><span>Opportunity type</span><select value={adminType} onChange={e => setAdminType(e.target.value)}>{types.map(item => <option key={item}>{item}</option>)}</select></label><button type="button" className="reset-admin-filters" onClick={resetAdminFilters}>Reset filters</button></div>{adminFilteredJobs.length > 0 ? <div className="local-job-list">{adminFilteredJobs.map(job => <div className="local-job" key={job.id}><span><b>{job.title}</b><small>{job.company} · {job.location}</small></span><div className="local-job-actions"><button className="edit-local" onClick={() => editCustomJob(job)}>Edit</button><button className="delete-local" onClick={() => removeCustomJob(job.id)}>Delete</button></div></div>)}</div> : <div className="admin-jobs-empty"><strong>No vacancies match these filters.</strong><p>Try another search or clear the filters.</p><button type="button" onClick={resetAdminFilters}>Reset filters</button></div>}</section>}
      </section></div>}

      {chatOpen && <div className="chat-shell" role="dialog" aria-label="Grounded job assistant"><div className="chat-head"><div><span className="chat-icon" aria-hidden="true">✦</span><div><strong>Job Assistant</strong><small><i></i> Supplied records only</small></div></div><button onClick={() => setChatOpen(false)} aria-label="Close assistant">×</button></div><div className="chat-messages" ref={chatMessagesRef} aria-live="polite">{messages.map((message, index) => <div key={index} className={`message ${message.role}`}><p>{message.content}</p>{message.sources && message.sources.length > 0 && <div className="sources"><span>Sources</span>{message.sources.slice(0, 3).map(source => <button key={source.id} onClick={() => { setSelectedJob(source); setChatOpen(false); }}>{source.title} · {source.company}</button>)}</div>}</div>)}</div><form className="chat-form" onSubmit={askAssistant}><input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Ask about jobs or companies…" aria-label="Your question"/><button disabled={!chatInput.trim()} aria-label="Send question">↑</button></form><div className="chat-boundary">Answers only from supplied records</div></div>}

      {isStudent && (
        <>
          <StudentModal
            currentStudent={currentStudent}
            isOpen={studentModalOpen}
            onClose={() => setStudentModalOpen(false)}
            onSelectStudent={(student) => setCurrentStudent(student)}
            onOpenCvGenerator={() => setCvModalOpen(true)}
          />

          <CvGeneratorModal
            student={currentStudent}
            isOpen={cvModalOpen}
            onClose={() => setCvModalOpen(false)}
            onUpdateStudent={(updated) => setCurrentStudent(updated)}
          />
        </>
      )}
    </main>
  );
}
