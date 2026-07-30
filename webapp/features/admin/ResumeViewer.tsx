import { useEffect, useState } from "react";
import { subscribeResumes } from "../../lib/data/firestore";
import { hasGeneratedCV, type Resume } from "../../lib/data/types";
import { GeneratedCV } from "../student/GeneratedCV";

export function ResumeViewer() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => subscribeResumes((rows) => { setResumes(rows); setLoading(false); }), []);

  return (
    <section className="local-jobs" aria-labelledby="resumes-title">
      <div className="local-jobs-head"><div><span className="detail-label">RESUMES</span><h3 id="resumes-title">Submitted student resumes</h3></div><strong>{resumes.length}</strong></div>
      {loading ? (
        <p className="role-manager-state" role="status">Loading resumes…</p>
      ) : resumes.length ? (
        <div className="local-job-list">
          {resumes.map((resume) => {
            const generated = hasGeneratedCV(resume.profile);
            const kinds = [generated && "Generated CV", resume.fileUrl && "Shared link"].filter(Boolean).join(" · ") || "No content";
            const isOpen = expanded === resume.id;
            return (
              <div className="local-job local-job-stack" key={resume.id}>
                <div className="local-job-row">
                  <span>
                    <b>{resume.studentName || resume.studentEmail}</b>
                    <small>{resume.studentEmail}{resume.course ? ` · ${resume.course}` : ""} · {kinds}</small>
                  </span>
                  <div className="local-job-actions">
                    {generated && <button type="button" className="edit-local" onClick={() => setExpanded(isOpen ? null : resume.id)}>{isOpen ? "Hide CV" : "View generated CV"}</button>}
                    {resume.fileUrl && <a className="edit-local" href={resume.fileUrl} target="_blank" rel="noreferrer">Open link ↗</a>}
                    {!generated && !resume.fileUrl && <span className="text-xs text-accent italic">Nothing submitted</span>}
                  </div>
                </div>
                {generated && isOpen && (
                  <div className="cv-print mt-2">
                    <GeneratedCV name={resume.studentName || resume.studentEmail} email={resume.studentEmail} course={resume.course} profile={resume.profile!} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="admin-jobs-empty"><strong>No resumes submitted yet</strong><p>Student submissions from the My Resume tab appear here.</p></div>
      )}
    </section>
  );
}
