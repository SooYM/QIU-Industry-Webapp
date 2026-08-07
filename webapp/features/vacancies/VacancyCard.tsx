import { useState } from "react";
import type { Company, Job } from "../../lib/data/types";
import { useLogoBackdrop } from "../home/useLogoBackdrop";
import { formatSalary, jobStatusMeta } from "./vacancy-utils";

export function VacancyCard({
  job,
  company,
  recommended = false,
  applied = false,
  showStatus = false,
  onOpen,
}: {
  job: Job;
  company?: Company;
  recommended?: boolean;
  applied?: boolean;
  showStatus?: boolean;
  onOpen: (job: Job) => void;
}) {
  const status = showStatus ? jobStatusMeta(job) : null;
  const backdrop = useLogoBackdrop(company?.logoUrl, company?.logoBackground ?? "auto");
  const [logoOk, setLogoOk] = useState(true);
  return (
    <article className={`job-card${recommended ? " is-recommended" : ""}${applied ? " is-applied" : ""}`} tabIndex={0} role="button" aria-label={`View ${job.title} at ${job.company}${applied ? " — you have applied" : ""}${recommended ? " — recommended for your profile" : ""}`} onClick={() => onOpen(job)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(job); } }}>
      {applied && (
        <span className="applied-stamp" aria-hidden="true">
          <svg viewBox="0 0 140 84">
            <ellipse cx="70" cy="42" rx="66" ry="38" />
            <ellipse cx="70" cy="42" rx="58" ry="31" className="inner" />
            <text x="70" y="50">APPLIED</text>
            <text x="19" y="49" className="star">★</text>
            <text x="121" y="49" className="star">★</text>
            <text x="70" y="22" className="dots">· · · · ·</text>
            <text x="70" y="76" className="dots">· · · · ·</text>
          </svg>
        </span>
      )}
      <div className="card-top">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`type ${job.type.toLowerCase().includes("intern") ? "intern" : ""}`}>{job.type}</span>
          {recommended && (
            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold tone-success">🌟 Recommended for your profile</span>
          )}
          {applied && <span className="applied-label rounded px-1.5 py-0.5 text-[10px] font-bold tone-success">Applied</span>}
          {status && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${status.tone}`}>{status.label}</span>
          )}
        </div>
        <span className="vacancies">{job.vacancies} {job.vacancies === 1 ? "place" : "places"}</span>
      </div>
      <h2>{job.title}</h2><div className="job-company-line">{company?.logoUrl && logoOk && <img className={`job-company-logo logo-${backdrop}`} src={company.logoUrl} alt="" onError={() => setLogoOk(false)} />}<p className="company">{job.company}</p></div>
      <div className="meta"><span>{job.location}</span><span>{job.specialization}</span><span>{job.minimumRequirement}</span></div>
      <div className="card-foot"><div><small>LISTED SALARY</small><strong>{formatSalary(job)}</strong></div><span className="view-job">View details <span>→</span></span></div>
    </article>
  );
}
