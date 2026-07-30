import { useState } from "react";
import { approveJob, rejectJob } from "../../lib/data/firestore";
import type { Job } from "../../lib/data/types";
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
  const pending = jobs.filter((job) => job.status === "pending" || job.status === "pending_edit");

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
    try { await Promise.all(pending.map((j) => approveJob(j))); setMessage(`Approved ${pending.length} vacancies.`); }
    catch { setMessage("Some vacancies could not be approved."); }
  }

  return (
    <section className="local-jobs" aria-labelledby="approval-title">
      <div className="local-jobs-head"><div><span className="detail-label">APPROVAL QUEUE</span><h3 id="approval-title">Vacancies awaiting review</h3></div>{pending.length > 0 ? <button type="button" className="admin-button" onClick={approveAll}>✓ Approve all ({pending.length})</button> : <strong aria-live="polite">0</strong>}</div>
      {message && <p className="admin-message" role="status" aria-live="polite">{message}</p>}
      {pending.length ? (
        <div className="local-job-list">
          {pending.map((job) => {
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
                            <span key={field} className="block">
                              <b>{field}:</b> <span className="line-through opacity-70">{String(was ?? "—")}</span> → <span className="text-success">{String(becomes ?? "—")}</span>
                            </span>
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
      ) : (
        <div className="admin-jobs-empty"><strong>Nothing to review</strong><p>New employer vacancies and staged edits will appear here.</p></div>
      )}
    </section>
  );
}
