import type { PointerEvent } from "react";
import type { Job } from "../../lib/data/types";
import { formatSalary, jobStatusMeta } from "./vacancy-utils";

export function VacancyCard({
  job,
  recommended = false,
  applied = false,
  showStatus = false,
  onGlow,
  onOpen,
}: {
  job: Job;
  recommended?: boolean;
  applied?: boolean;
  showStatus?: boolean;
  onGlow: (event: PointerEvent<HTMLElement>) => void;
  onOpen: (job: Job) => void;
}) {
  const status = showStatus ? jobStatusMeta(job) : null;
  return (
    <article className={`job-card${recommended ? " is-recommended" : ""}${applied ? " is-applied" : ""}`} tabIndex={0} role="button" aria-label={`View ${job.title} at ${job.company}${applied ? " — you have applied" : ""}${recommended ? " — recommended for your profile" : ""}`} onPointerMove={onGlow} onClick={() => onOpen(job)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(job); } }}>
      {applied && <span className="applied-ribbon" aria-hidden="true">APPLIED</span>}
      <div className="card-top">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`type ${job.type.toLowerCase().includes("intern") ? "intern" : ""}`}>{job.type}</span>
          {recommended && (
            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold tone-success">🌟 Recommended for your profile</span>
          )}
          {status && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${status.tone}`}>{status.label}</span>
          )}
        </div>
        <span className="vacancies">{job.vacancies} {job.vacancies === 1 ? "place" : "places"}</span>
      </div>
      <h2>{job.title}</h2><p className="company">{job.company}</p>
      <div className="meta"><span>{job.location}</span><span>{job.specialization}</span><span>{job.minimumRequirement}</span></div>
      <div className="card-foot"><div><small>LISTED SALARY</small><strong>{formatSalary(job)}</strong></div><span className="view-job">View details <span>→</span></span></div>
    </article>
  );
}
