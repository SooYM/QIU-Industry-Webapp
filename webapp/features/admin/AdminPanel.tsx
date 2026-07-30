import { FormEvent, MouseEvent as ReactMouseEvent, PointerEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Job } from "../../lib/data/types";
import { RoleManager, useAuth } from "../../app/auth-context";
import { canEditOrDeleteJob, canManageVacancies, normalizeEmail } from "../../app/auth-policy";
import { db } from "../../app/firebase-client";
import { deleteJob, isApproved, saveJob, stageJobEdit } from "../../lib/data/firestore";
import { positionTooltip } from "../../app/map-tooltip";
import type { TooltipPosition } from "../../app/map-tooltip";
import { Modal } from "../../components/Modal";
import {
  benchmarkFor, countryPath, emptyDraft, jobStatusMeta, malaysiaStates,
  type AdminDraft, type CountryShape, type GeoFeature,
} from "../vacancies/vacancy-utils";
import { ApprovalQueue } from "./ApprovalQueue";
import { ResumeViewer } from "./ResumeViewer";
import { ChatHistory } from "./ChatHistory";
import { StudentActivity } from "./StudentActivity";
import { SettingsPanel } from "./SettingsPanel";
import { CompanyManager } from "./CompanyManager";

const PREDEFINED_SPECS = [
  "IT - Software", "IT - Network/Sys/DB Admin", "IT - Hardware", "Accounting/Finance",
  "Marketing/Business Dev", "Digital Marketing", "Hotel/Tourism", "Food/Beverage/Restaurant",
  "Engineering", "Manufacturing", "Clerical/Administrative", "Customer Service", "Education", "Human Resources",
];

export function AdminPanel({
  open,
  onClose,
  onCreated,
  customJobs,
  companies,
  specializations,
  types,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  customJobs: Job[];
  companies: string[];
  specializations: string[];
  types: string[];
}) {
  const { user, role, company: employerCompany } = useAuth();
  const canManageJobs = canManageVacancies(role);
  const isApprover = role === "admin" || role === "superadmin";
  const isEmployer = role === "employer";
  const [adminView, setAdminView] = useState<"manage" | "approvals" | "resumes" | "chats" | "activity" | "access" | "settings" | "company">("manage");
  const [draft, setDraft] = useState<AdminDraft>(emptyDraft);
  const [titleCommitted, setTitleCommitted] = useState(false);
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

  useEffect(() => {
    // Keep controlled selects valid when an edit or deletion removes their selected option.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!companies.includes(adminCompany)) setAdminCompany("All companies");
    if (!specializations.includes(adminSpecialization)) setAdminSpecialization("All specializations");
    if (!types.includes(adminType)) setAdminType("All opportunities");
  }, [companies, specializations, types, adminCompany, adminSpecialization, adminType]);

  useEffect(() => {
    if (!open || countryShapes.length) return;
    fetch("/countries.geojson")
      .then((response) => response.json())
      .then((data: { features: GeoFeature[] }) => setCountryShapes(data.features.map((feature) => ({
        name: feature.properties.name,
        path: countryPath(feature),
      })).sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setAdminMessage("The interactive country map could not be loaded."));
  }, [open, countryShapes.length]);

  useLayoutEffect(() => {
    if (!hoveredCountry || !worldMapRef.current || !countryTooltipRef.current) return;
    const map = worldMapRef.current.getBoundingClientRect();
    const tooltip = countryTooltipRef.current.getBoundingClientRect();
    setTooltipPosition(positionTooltip(hoveredCountry.x, hoveredCountry.y, map.width, map.height, tooltip.width, tooltip.height));
  }, [hoveredCountry]);

  const adminFilteredJobs = useMemo(() => {
    const search = adminQuery.trim().toLowerCase();
    return customJobs.filter((job) =>
      (!search || [job.title, job.company, job.location, job.specialization, job.type].some((value) => value.toLowerCase().includes(search))) &&
      (adminCompany === "All companies" || job.company === adminCompany) &&
      (adminSpecialization === "All specializations" || job.specialization === adminSpecialization) &&
      (adminType === "All opportunities" || job.type === adminType)
    );
  }, [customJobs, adminQuery, adminCompany, adminSpecialization, adminType]);

  const myCompanies = useMemo(() => {
    const email = normalizeEmail(user?.email);
    return Array.from(new Set(customJobs.filter((job) => normalizeEmail(job.createdBy) === email).map((job) => job.company).filter(Boolean)));
  }, [customJobs, user]);
  // An employer's scope: their admin-assigned company (falling back to companies on their own jobs).
  const employerCompanies = employerCompany ? [employerCompany] : myCompanies;

  const selectedMapCountry = countryShapes.find((country) => country.name.toLocaleLowerCase() === draft.country.trim().toLocaleLowerCase())?.name;
  const adminMessageIsError = adminMessage.startsWith("Complete") || adminMessage.includes("could not");
  // Only surface the salary benchmark once the title is committed (on blur),
  // not on every keystroke.
  const draftBenchmark = useMemo(() => {
    if (!titleCommitted || !draft.title.trim()) return null;
    const effectiveSpec = draft.specialization === "Other" ? (draft.customSpecialization || "") : draft.specialization;
    return benchmarkFor({ title: draft.title, specialization: effectiveSpec });
  }, [titleCommitted, draft.title, draft.specialization, draft.customSpecialization]);
  const resetAdminFilters = () => { setAdminQuery(""); setAdminCompany("All companies"); setAdminSpecialization("All specializations"); setAdminType("All opportunities"); };

  async function saveVacancy(event: FormEvent) {
    event.preventDefault();
    if (!canManageJobs || !db || !user) return;
    const location = draft.locationMode === "malaysia" ? draft.state : draft.country.trim();
    const effectiveSpecialization = draft.specialization === "Other"
      ? (draft.customSpecialization?.trim() || "Other")
      : draft.specialization.trim();
    // Employers post under their assigned company (no company field); admins type one.
    const companyName = isEmployer ? (employerCompany?.trim() ?? "") : draft.company.trim();

    if (isEmployer && !companyName) {
      setAdminMessage("Your account has no company assigned. Ask an admin to set your company.");
      return;
    }
    if (!draft.title.trim() || !companyName || !effectiveSpecialization || !location) {
      setAdminMessage("Complete the role, company, specialization, and location fields.");
      return;
    }
    if (!draft.email.trim()) {
      setAdminMessage("An enquiry email is required.");
      return;
    }
    if (draft.salary.trim() === "" || !(Number(draft.salary) > 0)) {
      setAdminMessage("Enter the monthly salary (RM).");
      return;
    }
    const salary = Number(draft.salary);
    const isEditing = editingId !== null;
    const existingJob = isEditing ? customJobs.find((job) => job.id === editingId) : undefined;

    if (isEditing && existingJob && !canEditOrDeleteJob(existingJob, user.email, role)) {
      setAdminMessage("You can only edit vacancies created by your employer account.");
      return;
    }

    const userEmail = normalizeEmail(user.email);
    // Build the record explicitly — spreading `draft` would leak form-only fields
    // (customSpecialization, hasVideo) that the strict validVacancy rule rejects.
    // Store a video URL only when the employer confirmed one exists.
    const youtubeUrl = draft.hasVideo && draft.youtubeUrl?.trim() ? draft.youtubeUrl.trim() : "";
    const newJob: Job = {
      id: editingId ?? Date.now(),
      title: draft.title.trim(),
      company: companyName,
      type: draft.type,
      specialization: effectiveSpecialization,
      vacancies: draft.vacancies,
      location,
      locationMode: draft.locationMode,
      state: draft.locationMode === "malaysia" ? draft.state : "",
      country: draft.locationMode === "international" ? draft.country.trim() : "",
      mapX: draft.mapX,
      mapY: draft.mapY,
      salary,
      salaryLabel: salary ? `MYR${salary}` : "Not stated",
      payFrequency: existingJob?.payFrequency ?? "Monthly",
      minimumRequirement: draft.minimumRequirement,
      detailsLink: existingJob?.detailsLink ?? "",
      email: draft.email.trim(),
      companySummary: existingJob?.companySummary ?? "",
      companySources: existingJob?.companySources ?? [],
      jobScope: draft.jobScope?.trim() || "",
      requirement: draft.requirement?.trim() || "",
      youtubeUrl,
      createdBy: existingJob?.createdBy ?? userEmail,
      isCustom: true,
    };
    // Approval workflow: employers publish as pending; admins publish live.
    // An employer editing an already-approved job stages the change instead of
    // overwriting the live snapshot.
    if (isEditing && existingJob && role === "employer" && isApproved(existingJob)) {
      try {
        await stageJobEdit(existingJob.id, newJob);
        setDraft(emptyDraft);
        setEditingId(null);
        setTitleCommitted(false);
        setAdminMessage("Edit submitted — awaiting admin approval.");
      } catch { setAdminMessage("Vacancy could not be saved."); }
      return;
    }

    newJob.status = isApprover ? "approved" : "pending";
    try {
      await saveJob(newJob, isEditing, userEmail);
      setDraft(emptyDraft);
      setEditingId(null);
      setTitleCommitted(false);
      if (isEditing) setAdminMessage(isApprover ? "Vacancy updated." : "Vacancy updated — awaiting admin approval.");
      else if (isApprover) { setAdminMessage(""); onCreated(); }
      else setAdminMessage("Vacancy submitted — awaiting admin approval.");
    } catch { setAdminMessage("Vacancy could not be saved."); }
  }

  async function removeCustomJob(id: number) {
    if (!canManageJobs || !db || !user) return;
    const targetJob = customJobs.find((j) => j.id === id);
    if (targetJob && !canEditOrDeleteJob(targetJob, user.email, role)) {
      setAdminMessage("You can only remove vacancies created by your employer account.");
      return;
    }
    try {
      await deleteJob(id);
      if (editingId === id) { setEditingId(null); setDraft(emptyDraft); }
      setAdminMessage("Vacancy deleted.");
    } catch { setAdminMessage("Vacancy could not be deleted."); }
  }

  function editCustomJob(job: Job) {
    if (!canEditOrDeleteJob(job, user?.email, role)) {
      setAdminMessage("Employers can only edit their own created vacancies.");
      return;
    }
    const inferredMalaysia = job.locationMode === "malaysia" || (!job.locationMode && malaysiaStates.includes(job.location));
    const isPredefined = PREDEFINED_SPECS.includes(job.specialization);

    setEditingId(job.id);
    setDraft({
      title: job.title,
      company: job.company,
      type: job.type,
      specialization: isPredefined ? job.specialization : "Other",
      customSpecialization: isPredefined ? "" : job.specialization,
      locationMode: inferredMalaysia ? "malaysia" : "international",
      state: job.state ?? (inferredMalaysia ? job.location : ""),
      country: job.country ?? (inferredMalaysia ? "" : job.location),
      mapX: job.mapX,
      mapY: job.mapY,
      salary: job.salary ? String(job.salary) : "",
      vacancies: job.vacancies,
      minimumRequirement: job.minimumRequirement,
      email: job.email ?? "",
      jobScope: job.jobScope ?? "",
      requirement: job.requirement ?? "",
      youtubeUrl: job.youtubeUrl ?? "",
      hasVideo: Boolean(job.youtubeUrl && job.youtubeUrl.trim()),
    });
    setTitleCommitted(true);
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

  if (!open || !canManageJobs) return null;

  const tabs: { key: typeof adminView; label: string }[] = [
    { key: "manage", label: "Vacancies" },
    ...(isApprover ? [{ key: "approvals" as const, label: "Approvals" }] : []),
    ...(isEmployer ? [{ key: "company" as const, label: "Company profile" }] : []),
    { key: "resumes", label: "Resumes" },
    { key: "activity", label: "Activity" },
    { key: "chats", label: "Chats" },
    ...(isApprover ? [{ key: "access" as const, label: "Access" }, { key: "settings" as const, label: "Settings" }] : []),
  ];
  const viewTitle = adminView === "manage" ? (editingId ? "Edit vacancy" : "Add a vacancy")
    : adminView === "approvals" ? "Approval queue"
    : adminView === "company" ? "Company profile"
    : adminView === "resumes" ? "Student resumes"
    : adminView === "activity" ? "Student activity"
    : adminView === "access" ? "Access control"
    : adminView === "settings" ? "Portal settings"
    : "Assistant chats";

  return (
    <Modal className="admin-panel" labelledBy="admin-title" closeLabel="Close admin tools" onClose={onClose}>
      <span className="detail-label">{isEmployer ? "EMPLOYER" : "ADMIN"}</span><h2 id="admin-title">{viewTitle}</h2><p className="admin-intro">Changes are shared with signed-in QIU Industry Day 2026 users.</p>

      <div className="flex flex-wrap gap-1 border-b border-token my-3" role="tablist" aria-label="Admin sections">
        {tabs.map((tab) => (
          <button key={tab.key} type="button" role="tab" aria-selected={adminView === tab.key}
            className={`px-3 py-2 text-xs font-bold rounded-t-md ${adminView === tab.key ? "tone-accent" : "text-accent"}`}
            onClick={() => setAdminView(tab.key)}>{tab.label}</button>
        ))}
      </div>

      {adminView === "approvals" && isApprover && <ApprovalQueue jobs={customJobs} />}
      {adminView === "resumes" && <ResumeViewer />}
      {adminView === "activity" && (isApprover ? <StudentActivity mode="all" /> : <StudentActivity mode="company" companies={employerCompanies} />)}
      {adminView === "chats" && (isApprover ? <ChatHistory mode="all" /> : <ChatHistory mode="company" companies={employerCompanies} />)}
      {adminView === "access" && isApprover && <RoleManager />}
      {adminView === "company" && isEmployer && <CompanyManager employer={{ email: normalizeEmail(user?.email), companyName: employerCompany ?? "" }} />}
      {adminView === "settings" && isApprover && <SettingsPanel />}

      {adminView === "manage" && <>
      <form onSubmit={saveVacancy} className="admin-form"><label>Job title<input required value={draft.title} onChange={e => { setDraft({ ...draft, title: e.target.value }); setTitleCommitted(false); }} onBlur={() => setTitleCommitted(true)}/></label>{isApprover
  ? <label>Company<input required value={draft.company} onChange={e => setDraft({ ...draft, company: e.target.value })}/></label>
  : <label>Company<input value={employerCompany ?? "No company assigned"} readOnly disabled/><small className="field-label">Posted under your assigned company.</small></label>}<label>Type<select value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value })}><option>Permanent</option><option>Internship</option><option>Contract</option><option>Part-time</option></select></label><label>Specialization<select required value={draft.specialization} onChange={e => setDraft({ ...draft, specialization: e.target.value })}><option value="" disabled>Select specialization</option>{PREDEFINED_SPECS.map(item => <option key={item} value={item}>{item}</option>)}<option value="Other">Other (Specify below)</option></select></label>
        {draft.specialization === "Other" && <label className="full"><span className="field-label">Custom Specialization Title <small>Required for &apos;Other&apos;</small></span><input required value={draft.customSpecialization ?? ""} placeholder="e.g. Culinary Art & Hospitality" onChange={e => setDraft({ ...draft, customSpecialization: e.target.value })}/></label>}
        <label className="full"><span className="field-label">Job scope / responsibilities</span><textarea value={draft.jobScope ?? ""} rows={3} placeholder="Key responsibilities and day-to-day scope of the role" onChange={e => setDraft({ ...draft, jobScope: e.target.value })}/></label>
        <label className="full"><span className="field-label">Requirements</span><textarea value={draft.requirement ?? ""} rows={3} placeholder="Qualifications, skills, and experience required" onChange={e => setDraft({ ...draft, requirement: e.target.value })}/></label>
        <fieldset className="location-choice full"><legend>Location type</legend><label><input type="radio" name="location-mode" checked={draft.locationMode === "malaysia"} onChange={() => setDraft({ ...draft, locationMode: "malaysia", country: "", mapX: undefined, mapY: undefined })}/> Malaysia</label><label><input type="radio" name="location-mode" checked={draft.locationMode === "international"} onChange={() => setDraft({ ...draft, locationMode: "international", state: "" })}/> International</label></fieldset>
        {draft.locationMode === "malaysia" ? <label className="full">Malaysian state<select required value={draft.state} onChange={e => setDraft({ ...draft, state: e.target.value })}><option value="" disabled>Select state or federal territory</option>{malaysiaStates.map(state => <option key={state} value={state}>{state}</option>)}</select></label> : <div className="international-location full"><label>Exact country<input required list="world-country-list" value={draft.country} placeholder="e.g. Singapore" onChange={e => setDraft({ ...draft, country: e.target.value })}/><datalist id="world-country-list">{countryShapes.map(country => <option key={country.name} value={country.name}/>)}</datalist></label><span className="map-instruction">Hover to identify a country. Click it to select and highlight the country.</span><button ref={worldMapRef} type="button" className="world-map" onClick={pinpointCountry} onPointerMove={moveCountryLabel} onPointerLeave={() => setHoveredCountry(null)} aria-label={`World map country location picker${hoveredCountry ? `: ${hoveredCountry.name}` : ""}`}><svg viewBox="0 0 1000 500" role="img" aria-label="Interactive world countries">{countryShapes.map(country => <path key={country.name} d={country.path} data-country={country.name} className={selectedMapCountry === country.name ? "selected-country" : undefined}/>)}</svg>{!countryShapes.length && <span className="map-loading">Loading countries…</span>}{hoveredCountry && <span ref={countryTooltipRef} className="country-tooltip" style={{ left: tooltipPosition.left, top: tooltipPosition.top }}>{hoveredCountry.name}</span>}</button><small>{selectedMapCountry ? `${selectedMapCountry} selected and highlighted.` : "No country selected yet."}</small><a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Public-domain boundaries: Natural Earth ↗</a></div>}
        {draftBenchmark && (
          <div className="full rounded-xl panel-accent p-3.5 my-1 text-xs">
            <div className="flex items-center gap-1.5 font-bold">
              <span>📊</span>
              <span>DOSM Salary Range Benchmark Helper (2024 Survey)</span>
            </div>
            <p className="mt-1">
              Estimated Benchmark Salary Range for <b>{draft.title.trim()}</b>:{" "}
              <span className="font-extrabold text-sm">
                {draftBenchmark.rangeLabel} / month
              </span>{" "}
              <small className="text-accent font-normal">
                (Mean: RM {draftBenchmark.amount.toLocaleString()} / mo · {draftBenchmark.label})
              </small>
            </p>
            <small className="text-[10px] text-accent block mt-0.5">
              Calculated live based on the job title typed above.
            </small>
          </div>
        )}
        <label>Monthly salary (RM)<input type="number" required min="1" step="1" placeholder="e.g. 1800" value={draft.salary} onChange={e => setDraft({ ...draft, salary: e.target.value })}/></label><label>Vacancies<input type="number" min="1" value={draft.vacancies} onChange={e => setDraft({ ...draft, vacancies: Number(e.target.value) })}/></label><label>Minimum requirement<select value={draft.minimumRequirement} onChange={e => setDraft({ ...draft, minimumRequirement: e.target.value })}><option>SPM</option><option>Certificate</option><option>Diploma</option><option>Degree</option><option>Post-graduate</option></select></label><label><span className="field-label">Enquiry email <small>Required</small></span><input type="email" required value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })}/></label><label className="full checkbox-field"><input type="checkbox" checked={draft.hasVideo ?? false} onChange={e => setDraft({ ...draft, hasVideo: e.target.checked, youtubeUrl: e.target.checked ? draft.youtubeUrl : "" })}/><span className="field-label">This company has a corporate video</span></label>{draft.hasVideo && <label className="full"><span className="field-label">Corporate YouTube Video URL</span><input type="url" required value={draft.youtubeUrl ?? ""} placeholder="e.g. https://www.youtube.com/watch?v=..." onChange={e => setDraft({ ...draft, youtubeUrl: e.target.value })}/></label>}<div className="admin-form-footer full">{adminMessage && <p className={`admin-message ${adminMessageIsError ? "error" : ""}`} role="status" aria-live="polite">{adminMessage}</p>}<div className="admin-submit">{editingId && <button type="button" className="cancel-edit" onClick={() => { setEditingId(null); setDraft(emptyDraft); setTitleCommitted(false); setAdminMessage(""); }}>Cancel edit</button>}<button className="save-job" type="submit">{editingId ? "Save changes" : "Add vacancy"}</button></div></div></form>
      {customJobs.length > 0 && <section className="local-jobs" aria-labelledby="admin-vacancies-title"><div className="local-jobs-head"><div><span className="detail-label">VACANCIES</span><h3 id="admin-vacancies-title">Manage vacancies</h3></div><strong aria-live="polite">{adminFilteredJobs.length} of {customJobs.length}</strong></div><div className="admin-job-filters"><label className="admin-job-search"><span>Search vacancies</span><input type="search" value={adminQuery} onChange={e => setAdminQuery(e.target.value)} placeholder="Title, company or location"/></label><label><span>Company</span><select value={adminCompany} onChange={e => setAdminCompany(e.target.value)}>{companies.map(item => <option key={item}>{item}</option>)}</select></label><label><span>Specialization</span><select value={adminSpecialization} onChange={e => setAdminSpecialization(e.target.value)}>{specializations.map(item => <option key={item}>{item}</option>)}</select></label><label><span>Opportunity type</span><select value={adminType} onChange={e => setAdminType(e.target.value)}>{types.map(item => <option key={item}>{item}</option>)}</select></label><button type="button" className="reset-admin-filters" onClick={resetAdminFilters}>Reset filters</button></div>{adminFilteredJobs.length > 0 ? <div className="local-job-list">{adminFilteredJobs.map(job => { const editable = canEditOrDeleteJob(job, user?.email, role); const meta = jobStatusMeta(job); return <div className="local-job" key={job.id}><span><b>{job.title} <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${meta.tone}`}>{meta.label}</span></b><small>{job.company} · {job.location} {job.createdBy && `(by ${job.createdBy})`}</small></span><div className="local-job-actions">{editable ? <><button className="edit-local" onClick={() => editCustomJob(job)}>Edit</button><button className="delete-local" onClick={() => removeCustomJob(job.id)}>Delete</button></> : <span className="text-xs text-accent italic">Created by another account</span>}</div></div>; })}</div> : <div className="admin-jobs-empty"><strong>No vacancies match these filters.</strong><p>Try another search or clear the filters.</p><button type="button" onClick={resetAdminFilters}>Reset filters</button></div>}</section>}
      </>}
    </Modal>
  );
}
