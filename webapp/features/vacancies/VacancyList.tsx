import type { CSSProperties } from "react";
import type { Company, Job } from "../../lib/data/types";
import { jobMatchesCourse } from "../../lib/data/course-map";
import type { VacancyView } from "./vacancy-utils";
import { VacancyCard } from "./VacancyCard";

export function VacancyList({
  jobs,
  companiesByName,
  isStudent,
  course,
  appliedIds,
  columns,
  view,
  onSelect,
  onReset,
}: {
  jobs: Job[];
  companiesByName?: ReadonlyMap<string, Company>;
  isStudent: boolean;
  course: string | null;
  appliedIds?: Set<number>;
  columns: number;
  view: VacancyView;
  onSelect: (job: Job) => void;
  onReset: () => void;
}) {
  return (
    <>
      {jobs.length ? (
        <div className={`job-grid ${view === "list" ? "list-view" : "card-view"}`} style={{ "--columns": columns } as CSSProperties}>
          {jobs.map((job) => (
            <VacancyCard
              key={job.id}
              job={job}
              company={companiesByName?.get(job.company.trim().toLowerCase())}
              recommended={isStudent && jobMatchesCourse(job, course)}
              applied={isStudent && Boolean(appliedIds?.has(job.id))}
              showStatus={!isStudent}
              onOpen={onSelect}
            />
          ))}
        </div>
      ) : (
        <div className="empty"><strong>No matching vacancies</strong><p>Try widening the salary range or clearing a filter.</p><button onClick={onReset}>Reset filters</button></div>
      )}
    </>
  );
}
