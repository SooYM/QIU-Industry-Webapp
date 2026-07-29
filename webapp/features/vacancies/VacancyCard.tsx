import type { PointerEvent } from "react";
import type { Job } from "../../lib/data/types";
import type { JobRecommendationResult } from "../../app/recommendation";
import { formatSalary } from "./vacancy-utils";

export function VacancyCard({
  job,
  rec,
  onGlow,
  onOpen,
}: {
  job: Job;
  rec: JobRecommendationResult | null;
  onGlow: (event: PointerEvent<HTMLElement>) => void;
  onOpen: (job: Job) => void;
}) {
  return (
    <article className="job-card" tabIndex={0} role="button" aria-label={`View ${job.title} at ${job.company}`} onPointerMove={onGlow} onClick={() => onOpen(job)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(job); } }}>
      <div className="card-top">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`type ${job.type.toLowerCase().includes("intern") ? "intern" : ""}`}>{job.type}</span>
          {rec?.status === "recommended" && (
            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold tone-success">
              🌟 {rec.matchScore}% Match
            </span>
          )}
          {rec?.status === "excluded" && (
            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold tone-danger">
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
}
