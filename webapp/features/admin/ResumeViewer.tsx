import { useEffect, useState } from "react";
import { subscribeResumes } from "../../lib/data/firestore";
import type { Resume } from "../../lib/data/types";

export function ResumeViewer() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => subscribeResumes((rows) => { setResumes(rows); setLoading(false); }), []);

  return (
    <section className="local-jobs" aria-labelledby="resumes-title">
      <div className="local-jobs-head"><div><span className="detail-label">RESUMES</span><h3 id="resumes-title">Submitted student resumes</h3></div><strong>{resumes.length}</strong></div>
      {loading ? (
        <p className="role-manager-state" role="status">Loading resumes…</p>
      ) : resumes.length ? (
        <div className="local-job-list">
          {resumes.map((resume) => (
            <div className="local-job" key={resume.id}>
              <span>
                <b>{resume.studentName || resume.studentEmail}</b>
                <small>{resume.studentEmail}{resume.course ? ` · ${resume.course}` : ""} · {resume.source === "generated" ? "Generated CV" : "Uploaded PDF"}</small>
              </span>
              <div className="local-job-actions">
                {resume.fileUrl
                  ? <a className="edit-local" href={resume.fileUrl} target="_blank" rel="noreferrer">Open resume</a>
                  : <span className="text-xs text-accent italic">No file uploaded</span>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="admin-jobs-empty"><strong>No resumes submitted yet</strong><p>Student submissions from the My Resume tab appear here.</p></div>
      )}
    </section>
  );
}
