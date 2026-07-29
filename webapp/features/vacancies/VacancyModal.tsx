import type { Job } from "../../lib/data/types";
import type { StudentProfile } from "../../app/student-data";
import { evaluateJobForStudent } from "../../app/recommendation";
import { getYouTubeEmbedUrl } from "../../app/auth-policy";
import { Modal } from "../../components/Modal";
import { benchmarkFor, formatSalary, roleDescription, DOSM_SOURCE } from "./vacancy-utils";

export function VacancyModal({
  job,
  isStudent,
  currentStudent,
  applied = false,
  onApply,
  onClose,
}: {
  job: Job;
  isStudent: boolean;
  currentStudent: StudentProfile;
  applied?: boolean;
  onApply?: () => void;
  onClose: () => void;
}) {
  const rec = isStudent ? evaluateJobForStudent(job, currentStudent) : null;
  const benchmark = benchmarkFor(job);
  return (
    <Modal className="job-detail" labelledBy="job-detail-title" closeLabel="Close job details" onClose={onClose}>
      <div className="detail-header">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`type ${job.type.toLowerCase().includes("intern") ? "intern" : ""}`}>{job.type}</span>
            {rec && (
              <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${rec.status === "recommended" ? "tone-success" : rec.status === "excluded" ? "tone-danger" : "tone-neutral"}`}>
                Academic Match: {rec.matchScore}% ({rec.status})
              </span>
            )}
          </div>
          <h2 id="job-detail-title">{job.title}</h2>
          <p>{job.company} · {job.location}</p>
        </div>
        <div className="detail-salary"><small>LISTED SALARY</small><strong>{formatSalary(job)}</strong></div>
      </div>
      <div className="detail-grid">
        <div className="detail-main">
          <section><span className="detail-label">ROLE OVERVIEW</span><p>{roleDescription(job)}</p></section>
          {rec && (rec.highlights.length > 0 || rec.exclusions.length > 0) && (
            <section className="rounded-xl p-3.5 panel-accent">
              <span className="detail-label">ACADEMIC GRADE MATCH ANALYSIS</span>
              {rec.highlights.map((h, i) => <p key={i} className="mt-1 text-xs font-medium text-success">✓ {h}</p>)}
              {rec.exclusions.map((e, i) => <p key={i} className="mt-1 text-xs font-medium text-danger">✕ {e}</p>)}
            </section>
          )}
          <section><span className="detail-label">LISTING DETAILS</span><dl><div><dt>Specialization</dt><dd>{job.specialization}</dd></div><div><dt>Minimum requirement</dt><dd>{job.minimumRequirement}</dd></div><div><dt>Available places</dt><dd>{job.vacancies}</dd></div><div><dt>Pay frequency</dt><dd>{job.payFrequency}</dd></div></dl></section>
          {job.companySummary && <section><span className="detail-label">SUPPLIED COMPANY DISCUSSION</span><p className="company-context">{job.companySummary}</p><small className="caution">Unverified supplied snippets; confirm independently.</small></section>}
          <section className="mt-4">
            <span className="detail-label flex items-center gap-1.5">
              🎬 CORPORATE INTRO VIDEO
            </span>
            <div className="overflow-hidden rounded-xl border border-token bg-slate-900 shadow-sm mt-1.5">
              <iframe
                src={getYouTubeEmbedUrl(job.youtubeUrl)}
                title={`${job.company} Corporate Video`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full aspect-video rounded-xl border-0"
              />
            </div>
            <small className="text-[11px] text-accent mt-1 block">
              Corporate video preview supplied for {job.company}.
            </small>
          </section>
        </div>
        <aside className="market-card"><span className="detail-label">MALAYSIA MARKET CONTEXT</span><strong>RM {benchmark.amount.toLocaleString()}</strong><p>{benchmark.label}, monthly, DOSM Salaries & Wages Survey 2024.</p>{job.type.toLowerCase().includes("intern") && <div className="benchmark-note">This workforce benchmark is not an internship allowance estimate.</div>}<a href={DOSM_SOURCE} target="_blank" rel="noreferrer">View official source ↗</a><hr/><span className="detail-label">CONTACT</span>{job.email ? <a className="enquire-main" href={`mailto:${job.email}?subject=${encodeURIComponent(`Enquiry: ${job.title}`)}`}>Email employer →</a> : <p>No enquiry email supplied.</p>}
        {isStudent && (
          <>
            <hr/>
            <span className="detail-label">APPLICATION</span>
            {applied ? (
              <p className="rounded-lg px-3 py-2 text-xs font-bold tone-success" role="status">✓ Applied — saved to your History.</p>
            ) : (
              <button type="button" className="enquire-main" onClick={onApply}>Apply to this vacancy →</button>
            )}
            <small className="text-accent">Applying records your interest and attaches your submitted resume if available.</small>
          </>
        )}</aside>
      </div>
    </Modal>
  );
}
