import { useEffect, useState } from "react";
import { FilterReset } from "../../components/FilterReset";
import {
  applyCompanyEdit, approveCompany, approveJob, approveSignup, deleteCompany, deleteSignup,
  rejectCompanyEdit, rejectJob, subscribeCompanies, subscribeSignups,
} from "../../lib/data/firestore";
import type { Company, EmployerSignup, Job } from "../../lib/data/types";
import { getYouTubeEmbedUrl, normalizeEmail } from "../../app/auth-policy";
import { useAuth } from "../../app/auth-context";
import { Modal } from "../../components/Modal";
import { notify } from "../../components/toast";
import { downloadCsv, toCsv } from "../../lib/data/csv";
import { jobStatusMeta } from "../vacancies/vacancy-utils";

/** Vacancy staged-edit diff rows. */
function jobChanges(job: Job): [string, unknown, unknown][] {
  if (!job.pendingEdit) return [];
  const current = job as unknown as Record<string, unknown>;
  return Object.entries(job.pendingEdit).filter(([key, value]) => key !== "id" && current[key] !== value).map(([key, value]) => [key, current[key], value]);
}

/** Company staged-edit diff rows (field, was, becomes). */
function companyChanges(c: Company): [string, unknown, unknown][] {
  if (!c.pendingEdit) return [];
  const current = c as unknown as Record<string, unknown>;
  return Object.entries(c.pendingEdit).filter(([key, value]) => current[key] !== value).map(([key, value]) => [key, current[key], value]);
}

/** Enlarged preview of a company/registration profile before approving. */
function CompanyPreview({ company, onClose }: { company: Partial<Company>; onClose: () => void }) {
  const embedUrl = getYouTubeEmbedUrl(company.videoUrl);
  const hasVideo = Boolean(embedUrl);
  return (
    <Modal className="job-detail" labelledBy="preview-title" closeLabel="Close preview" onClose={onClose}>
      <div className="detail-header">
        <div className="flex items-center gap-3">
          {company.logoUrl && <img className="exhibitor-logo-lg logo-light" src={company.logoUrl} alt={company.name} style={{ width: "5rem", height: "5rem" }} />}
          <div>
            <h2 id="preview-title">{company.name}</h2>
            {company.website && <p><a href={company.website} target="_blank" rel="noreferrer">{company.website.replace(/^https?:\/\//i, "")} ↗</a></p>}
          </div>
        </div>
      </div>
      <div className="detail-main">
        {company.summary && <section><span className="detail-label">ABOUT</span><p style={{ whiteSpace: "pre-wrap" }}>{company.summary}</p></section>}
        {hasVideo && (
          <section className="mt-4"><span className="detail-label">🎬 CORPORATE VIDEO</span>
            <div className="overflow-hidden rounded-xl border border-token mt-1.5"><iframe src={embedUrl} title={`${company.name} video`} allowFullScreen className="w-full aspect-video rounded-xl border-0" /></div>
          </section>
        )}
        {!company.summary && !hasVideo && !company.logoUrl && <p className="text-accent text-sm">No extra profile details were provided.</p>}
      </div>
    </Modal>
  );
}

export function ApprovalQueue({ jobs }: { jobs: Job[] }) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [signups, setSignups] = useState<EmployerSignup[]>([]);
  const [preview, setPreview] = useState<Partial<Company> | null>(null);

  useEffect(() => subscribeCompanies(setCompanies, () => {}), []);
  useEffect(() => subscribeSignups(setSignups), []);

  const q = query.trim().toLowerCase();
  const match = (...fields: (string | undefined)[]) => !q || fields.some((f) => (f ?? "").toLowerCase().includes(q));

  const pendingJobs = jobs.filter((j) => j.status === "pending" || j.status === "pending_edit").filter((j) => match(j.title, j.company, j.location, j.createdBy));
  const pendingCompanies = companies.filter((c) => c.status === "pending" || c.status === "pending_edit").filter((c) => match(c.name, c.createdBy));
  const pendingSignups = signups.filter((s) => s.status === "pending").filter((s) => match(s.company, s.name, s.email));
  const companyCount = pendingCompanies.length + pendingSignups.length;

  const run = async (fn: () => Promise<void>, ok: string, err: string) => {
    setMessage("");
    try { await fn(); setMessage(ok); notify(ok); }
    catch (error: unknown) {
      // A bare catch here hid a permanent approval failure behind "Could not
      // approve." for long enough that it took a bug report to find.
      const code = (error as { code?: string })?.code ?? "";
      console.error("[approvals]", code || error);
      const detail = `${err}${code ? ` (${code})` : ""}`;
      setMessage(detail); notify(detail, "error");
    }
  };

  const exportCsv = () => {
    const rows = [
      ...pendingJobs.map((j) => ["Vacancy", j.status === "pending_edit" ? "Edit" : "New", j.title, j.company, j.createdBy ?? ""]),
      ...pendingSignups.map((s) => ["Company", "New registration", s.company, s.name, s.email]),
      ...pendingCompanies.map((c) => ["Company", c.status === "pending_edit" ? "Profile edit" : "New", c.name, "", c.createdBy ?? ""]),
    ];
    if (!rows.length) { notify("Nothing to export.", "error"); return; }
    downloadCsv(`approvals-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(["Type", "Kind", "Name", "Contact name", "Contact / created by"], rows));
    notify(`Exported ${rows.length} pending item${rows.length === 1 ? "" : "s"}.`);
  };

  return (
    <section aria-labelledby="approval-title">
      <div className="local-jobs-head"><div><span className="detail-label">APPROVAL QUEUE</span><h3 id="approval-title">Awaiting review</h3></div><div className="flex items-center gap-2"><strong aria-live="polite">{pendingJobs.length + companyCount}</strong><button type="button" className="admin-button" onClick={exportCsv} disabled={!(pendingJobs.length + companyCount)}>⬇ Export CSV</button></div></div>
      <div className="admin-toolbar">
        <input type="search" className="admin-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search pending registrations, vacancies and companies…" aria-label="Search approvals" />
        <FilterReset active={Boolean(query)} onReset={() => setQuery("")} label="Clear search" />
      </div>
      {message && <p className="admin-message" role="status" aria-live="polite">{message}</p>}

      {/* Vacancies */}
      <div className="local-jobs" style={{ marginTop: ".5rem" }}>
        <div className="local-jobs-head"><div><span className="detail-label">VACANCIES</span><h3>Vacancies &amp; staged edits</h3></div>{pendingJobs.length > 0 && <button type="button" className="admin-button" onClick={() => run(() => Promise.all(pendingJobs.map(approveJob)).then(() => {}), `Approved ${pendingJobs.length} vacancies.`, "Some vacancies could not be approved.")}>✓ Approve all ({pendingJobs.length})</button>}</div>
        {pendingJobs.length ? (
          <div className="local-job-list">
            {pendingJobs.map((job) => {
              const meta = jobStatusMeta(job);
              const changes = jobChanges(job);
              return (
                <div className="local-job" key={job.id} style={{ alignItems: "flex-start" }}>
                  <span>
                    <b>{job.title} <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${meta.tone}`}>{meta.label}</span></b>
                    <small>{job.company} · {job.location} {job.createdBy && `(by ${job.createdBy})`}</small>
                    {job.status === "pending_edit" && <span className="mt-1 block text-[11px] text-accent">{changes.length ? changes.map(([f, was, now]) => <span key={f} className="block"><b>{f}:</b> <span className="line-through opacity-70">{String(was ?? "—")}</span> → <span className="text-success">{String(now ?? "—")}</span></span>) : "Staged edit with no field changes."}</span>}
                  </span>
                  <div className="local-job-actions">
                    <button className="edit-local" onClick={() => run(() => approveJob(job), `Approved "${job.title}".`, "Could not approve.")}>Approve</button>
                    <button className="delete-local" onClick={() => run(() => rejectJob(job.id), `Rejected "${job.title}".`, "Could not reject.")}>Reject</button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <div className="admin-jobs-empty"><strong>No vacancies to review</strong><p>New company vacancies and staged edits appear here.</p></div>}
      </div>

      {/* Companies — registrations (new) + profile edits, combined */}
      <div className="local-jobs">
        <div className="local-jobs-head"><div><span className="detail-label">COMPANIES</span><h3>Registrations &amp; profile edits</h3></div><strong>{companyCount}</strong></div>
        {companyCount ? (
          <div className="local-job-list">
            {pendingSignups.map((s) => (
              <div className="local-job" key={`sig-${s.email}`} style={{ alignItems: "flex-start" }}>
                <span>
                  <b>{s.company} <span className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold tone-accent">New registration</span></b>
                  <small>{s.name} · <a href={`mailto:${s.email}`}>{s.email}</a>{s.contact ? ` · ${s.contact}` : ""}{s.website ? ` · ${s.website}` : ""}</small>
                </span>
                <div className="local-job-actions">
                  <a className="edit-local" href={`mailto:${s.email}?subject=${encodeURIComponent(`QIU Industry Day 2026 — ${s.company} registration`)}&body=${encodeURIComponent(`Hi ${s.name},\n\nThank you for registering ${s.company} for QIU Industry Day 2026.\n\n`)}`}>✉ Contact</a>
                  <button className="edit-local" onClick={() => setPreview({ name: s.company, website: s.website, logoUrl: s.logoUrl, videoUrl: s.videoUrl, summary: s.summary })}>View</button>
                  <button className="edit-local" onClick={() => run(() => approveSignup(s, normalizeEmail(user?.email), companies), `Approved ${s.company} — added to companies.`, "Could not approve.")}>Approve</button>
                  <button className="delete-local" onClick={() => { if (confirm(`Reject ${s.company}'s registration?`)) deleteSignup(s.email).then(() => notify(`Rejected ${s.company}.`)); }}>Reject</button>
                </div>
              </div>
            ))}
            {pendingCompanies.map((c) => {
              const isEdit = c.status === "pending_edit";
              const changes = companyChanges(c);
              return (
                <div className="local-job" key={`co-${c.id}`} style={{ alignItems: "flex-start" }}>
                  <span>
                    <b>{c.name} <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${isEdit ? "tone-neutral" : "tone-accent"}`}>{isEdit ? "✎ Profile edit" : "New profile"}</span></b>
                    <small>{c.createdBy || "—"}</small>
                    {isEdit && <span className="mt-1 block text-[11px] text-accent">{changes.length ? changes.map(([f, was, now]) => <span key={f} className="block"><b>{f}:</b> <span className="line-through opacity-70">{String(was ?? "—") || "—"}</span> → <span className="text-success">{String(now ?? "—") || "—"}</span></span>) : "Edit with no visible field changes."}</span>}
                  </span>
                  <div className="local-job-actions">
                    <button className="edit-local" onClick={() => setPreview(isEdit ? { ...c, ...(c.pendingEdit ?? {}) } : c)}>View</button>
                    {isEdit
                      ? <><button className="edit-local" onClick={() => run(() => applyCompanyEdit(c), `Approved edit for ${c.name}.`, "Could not approve.")}>Approve edit</button><button className="delete-local" onClick={() => run(() => rejectCompanyEdit(c.id), `Reverted ${c.name}.`, "Could not reject.")}>Reject</button></>
                      : <><button className="edit-local" onClick={() => run(() => approveCompany(c.id), `Approved ${c.name}.`, "Could not approve.")}>Approve</button><button className="delete-local" onClick={() => { if (confirm(`Delete "${c.name}"?`)) deleteCompany(c.id).then(() => notify(`Deleted ${c.name}.`)).catch(() => notify("Could not delete.", "error")); }}>Delete</button></>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : <div className="admin-jobs-empty"><strong>No companies to review</strong><p>Self-registrations and company profile edits appear here. Approving publishes them to the Home company list.</p></div>}
      </div>

      {preview && <CompanyPreview company={preview} onClose={() => setPreview(null)} />}
    </section>
  );
}
