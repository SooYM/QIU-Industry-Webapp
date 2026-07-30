import { useEffect, useState } from "react";
import { approveCompany, approveJob, deleteCompany, rejectJob, subscribeCompanies } from "../../lib/data/firestore";
import { isApprovedCompany, type Company, type Job } from "../../lib/data/types";
import { jobStatusMeta } from "../vacancies/vacancy-utils";

/** Fields an employer changed in a staged edit, as (field, was, becomes) rows. */
function changedFields(job: Job): [string, unknown, unknown][] {
  if (!job.pendingEdit) return [];
  const current = job as unknown as Record<string, unknown>;
  return Object.entries(job.pendingEdit)
    .filter(([key, value]) => key !== "id" && current[key] !== value)
    .map(([key, value]) => [key, current[key], value]);
}

export function ApprovalQueue({ jobs }: { jobs: Job[] }) {
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);

  useEffect(() => subscribeCompanies(setCompanies, () => {}), []);

  const q = query.trim().toLowerCase();
  const match = (...fields: (string | undefined)[]) => !q || fields.some((f) => (f ?? "").toLowerCase().includes(q));

  const pendingJobs = jobs
    .filter((job) => job.status === "pending" || job.status === "pending_edit")
    .filter((job) => match(job.title, job.company, job.location, job.createdBy));
  const pendingCompanies = companies
    .filter((c) => !isApprovedCompany(c))
    .filter((c) => match(c.name, c.createdBy));

  async function approve(job: Job) {
    setMessage("");
    try { await approveJob(job); setMessage(`Approved "${job.title}".`); }
    catch { setMessage("Could not approve the vacancy."); }
  }
  async function reject(job: Job) {
    setMessage("");
    try { await rejectJob(job.id); setMessage(`Rejected "${job.title}".`); }
    catch { setMessage("Could not reject the vacancy."); }
  }
  async function approveAll() {
    setMessage("");
    try { await Promise.all(pendingJobs.map((j) => approveJob(j))); setMessage(`Approved ${pendingJobs.length} vacancies.`); }
    catch { setMessage("Some vacancies could not be approved."); }
  }
  async function approveCo(c: Company) {
    setMessage("");
    try { await approveCompany(c.id); setMessage(`Approved "${c.name}".`); }
    catch { setMessage("Could not approve the company."); }
  }

  return (
    <section aria-labelledby="approval-title">
      <div className="local-jobs-head"><div><span className="detail-label">APPROVAL QUEUE</span><h3 id="approval-title">Awaiting review</h3></div><strong aria-live="polite">{pendingJobs.length + pendingCompanies.length}</strong></div>
      <input type="search" className="admin-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search pending vacancies and companies…" aria-label="Search approvals" />
      {message && <p className="admin-message" role="status" aria-live="polite">{message}</p>}

      {/* Section 1 — vacancies */}
      <div className="local-jobs" style={{ marginTop: ".5rem" }}>
        <div className="local-jobs-head"><div><span className="detail-label">VACANCIES</span><h3>Vacancies &amp; staged edits</h3></div>{pendingJobs.length > 0 && <button type="button" className="admin-button" onClick={approveAll}>✓ Approve all ({pendingJobs.length})</button>}</div>
        {pendingJobs.length ? (
          <div className="local-job-list">
            {pendingJobs.map((job) => {
              const meta = jobStatusMeta(job);
              const changes = changedFields(job);
              return (
                <div className="local-job" key={job.id} style={{ alignItems: "flex-start" }}>
                  <span>
                    <b>{job.title} <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${meta.tone}`}>{meta.label}</span></b>
                    <small>{job.company} · {job.location} {job.createdBy && `(by ${job.createdBy})`}</small>
                    {job.status === "pending_edit" && (
                      <span className="mt-1 block text-[11px] text-accent">
                        {changes.length
                          ? changes.map(([field, was, becomes]) => (
                              <span key={field} className="block"><b>{field}:</b> <span className="line-through opacity-70">{String(was ?? "—")}</span> → <span className="text-success">{String(becomes ?? "—")}</span></span>
                            ))
                          : "Staged edit with no field changes."}
                      </span>
                    )}
                  </span>
                  <div className="local-job-actions">
                    <button className="edit-local" onClick={() => approve(job)}>Approve</button>
                    <button className="delete-local" onClick={() => reject(job)}>Reject</button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <div className="admin-jobs-empty"><strong>No vacancies to review</strong><p>New employer vacancies and staged edits appear here.</p></div>}
      </div>

      {/* Section 2 — exhibitor profiles */}
      <div className="local-jobs">
        <div className="local-jobs-head"><div><span className="detail-label">EXHIBITORS</span><h3>Company profiles</h3></div><strong>{pendingCompanies.length}</strong></div>
        {pendingCompanies.length ? (
          <div className="local-job-list">
            {pendingCompanies.map((c) => (
              <div className="local-job" key={c.id}>
                <span><b>{c.name}</b><small>{c.createdBy ? `by ${c.createdBy}` : "—"}{c.website ? ` · ${c.website}` : ""}</small></span>
                <div className="local-job-actions">
                  <button className="edit-local" onClick={() => approveCo(c)}>Approve</button>
                  <button className="delete-local" onClick={() => { if (confirm(`Delete "${c.name}"?`)) deleteCompany(c.id).catch(() => {}); }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        ) : <div className="admin-jobs-empty"><strong>No company profiles to review</strong><p>Employer-submitted profiles appear here for approval.</p></div>}
      </div>
    </section>
  );
}
