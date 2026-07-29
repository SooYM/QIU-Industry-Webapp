import type { CSSProperties, PointerEvent } from "react";
import type { Job } from "../../lib/data/types";
import type { StudentProfile } from "../../app/student-data";
import { evaluateJobForStudent } from "../../app/recommendation";
import { VacancyCard } from "./VacancyCard";

export function VacancyList({
  jobs,
  isStudent,
  currentStudent,
  columns,
  currentPage,
  pageCount,
  onGlow,
  onSelect,
  onPrev,
  onNext,
  onReset,
}: {
  jobs: Job[];
  isStudent: boolean;
  currentStudent: StudentProfile;
  columns: number;
  currentPage: number;
  pageCount: number;
  onGlow: (event: PointerEvent<HTMLElement>) => void;
  onSelect: (job: Job) => void;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
}) {
  return (
    <>
      {jobs.length ? (
        <div className="job-grid" style={{ "--columns": columns } as CSSProperties}>
          {jobs.map((job) => (
            <VacancyCard
              key={job.id}
              job={job}
              rec={isStudent ? evaluateJobForStudent(job, currentStudent) : null}
              showStatus={!isStudent}
              onGlow={onGlow}
              onOpen={onSelect}
            />
          ))}
        </div>
      ) : (
        <div className="empty"><strong>No matching vacancies</strong><p>Try widening the salary range or clearing a filter.</p><button onClick={onReset}>Reset filters</button></div>
      )}
      {pageCount > 1 && <div className="pagination"><button disabled={currentPage === 1} onClick={onPrev}>← Previous</button><span>Page {currentPage} of {pageCount}</span><button disabled={currentPage === pageCount} onClick={onNext}>Next →</button></div>}
    </>
  );
}
