import { useEffect, useMemo, useState } from "react";
import { subscribeApplications, subscribeResumes } from "../../lib/data/firestore";
import { hasGeneratedCV, type Application, type Resume } from "../../lib/data/types";
import { GeneratedCV } from "../student/GeneratedCV";
import { downloadCV } from "../student/cv-download";
import { csvWhen, downloadCsv, toCsv } from "../../lib/data/csv";
import { notify } from "../../components/toast";
import { companyListIncludes } from "../../lib/data/company-matching";

const today = () => new Date().toISOString().slice(0, 10);

/** Admin: every resume, both types. Employer: only their applicants, and only the
 *  resume type each student chose when applying (generated CV or link). */
export function ResumeViewer({ employer }: { employer?: { companies: string[] } }) {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => subscribeResumes((rows) => { setResumes(rows); setLoading(false); }), []);
  useEffect(() => { if (employer) return subscribeApplications(setApps); }, [employer]);

  const resumeByUid = useMemo(() => new Map(resumes.map((r) => [r.studentUid, r])), [resumes]);
  const q = query.trim().toLowerCase();

  // Employer rows: one per application to their company, carrying the chosen resume.
  const employerRows = useMemo(() => {
    if (!employer) return [];
    return apps
      .filter((a) => companyListIncludes(employer.companies, a.company))
      .map((a) => ({ app: a, resume: resumeByUid.get(a.studentUid) }))
      .filter(({ app }) => !q || [app.studentName, app.studentEmail, app.jobTitle, app.company].some((f) => (f ?? "").toLowerCase().includes(q)));
  }, [employer, apps, resumeByUid, q]);

  const adminRows = q ? resumes.filter((r) => [r.studentName, r.studentEmail, r.course].some((f) => (f ?? "").toLowerCase().includes(q))) : resumes;

  const searchBox = <input type="search" className="admin-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, email or job…" aria-label="Search resumes" />;

  // ---- Employer view (grouped by job) ---------------------------------------
  if (employer) {
    const byJob = new Map<string, typeof employerRows>();
    for (const r of employerRows) {
      const k = r.app.jobTitle || "Other";
      if (!byJob.has(k)) byJob.set(k, []);
      byJob.get(k)!.push(r);
    }
    const jobGroups = [...byJob.entries()].sort((a, b) => b[1].length - a[1].length);

    const exportCsv = () => {
      if (!employerRows.length) { notify("Nothing to export.", "error"); return; }
      const rows = employerRows.map(({ app, resume }) => {
        const choice = app.resumeChoice ?? (resume && hasGeneratedCV(resume.profile) ? "generated" : "link");
        return [app.studentName, app.studentEmail, app.studentEmployeeId ?? "", app.jobTitle, app.company, choice === "generated" ? "Generated CV" : "Shared link", resume?.fileUrl ?? "", csvWhen(app.appliedAt)];
      });
      downloadCsv(`applicants-${today()}.csv`, toCsv(["Student", "Email", "Employee ID", "Job", "Company", "Resume shared", "Resume link", "Applied at"], rows));
      notify(`Exported ${employerRows.length} applicant${employerRows.length === 1 ? "" : "s"}.`);
    };

    const renderRow = ({ app, resume }: (typeof employerRows)[number]) => {
      const choice = app.resumeChoice ?? (resume && hasGeneratedCV(resume.profile) ? "generated" : "link");
      const generated = choice === "generated" && resume && hasGeneratedCV(resume.profile);
      const link = choice === "link" && resume?.fileUrl;
      const key = app.id;
      const isOpen = expanded === key;
      return (
        <div className="local-job local-job-stack" key={key}>
          <div className="local-job-row">
            <span><b>{app.studentName || app.studentEmail}</b><small>{app.studentEmail}{app.studentEmployeeId ? ` · ID ${app.studentEmployeeId}` : ""} · {generated ? "Generated CV" : link ? "Shared link" : "No resume shared"}</small></span>
            <div className="local-job-actions">
              {generated && <><button type="button" className="edit-local" onClick={() => setExpanded(isOpen ? null : key)}>{isOpen ? "Hide CV" : "View CV"}</button><button type="button" className="edit-local" onClick={() => downloadCV(resume!)}>Download</button></>}
              {link && <a className="edit-local" href={resume!.fileUrl} target="_blank" rel="noreferrer">Open link ↗</a>}
              {!generated && !link && <span className="text-xs text-accent italic">Nothing shared</span>}
            </div>
          </div>
          {generated && isOpen && <div className="cv-print mt-2"><GeneratedCV name={app.studentName || app.studentEmail} email={app.studentEmail} course={resume!.course} profile={resume!.profile!} /></div>}
        </div>
      );
    };

    return (
      <section className="local-jobs" aria-labelledby="resumes-title">
        <div className="local-jobs-head"><div><span className="detail-label">CANDIDATE APPLICANTS</span><h3 id="resumes-title">Applicants by job</h3></div><div className="flex items-center gap-2"><strong>{employerRows.length}</strong><button type="button" className="admin-button" onClick={exportCsv} disabled={!employerRows.length}>⬇ Export CSV</button></div></div>
        <p className="text-[11px] text-accent">You only see the resume each student chose to share when applying.</p>
        {searchBox}
        {loading ? <p className="role-manager-state" role="status">Loading…</p>
          : !employer.companies.length ? <div className="admin-jobs-empty"><strong>No company assigned</strong><p>Ask an admin to set your company.</p></div>
          : jobGroups.length ? jobGroups.map(([job, rows]) => (
            <details className="student-group" key={job} open>
              <summary className="student-group-head"><b>{job}</b><small>{rows.length} applicant{rows.length === 1 ? "" : "s"}</small></summary>
              {rows.map(renderRow)}
            </details>
          )) : <div className="admin-jobs-empty"><strong>No applicants yet</strong><p>Resumes appear here when students apply to your vacancies.</p></div>}
      </section>
    );
  }

  // ---- Admin view -----------------------------------------------------------
  const exportAdmin = () => {
    if (!adminRows.length) { notify("Nothing to export.", "error"); return; }
    const rows = adminRows.map((r) => [r.studentName, r.studentEmail, r.employeeId ?? "", r.course ?? "", [hasGeneratedCV(r.profile) && "Generated CV", r.fileUrl && "Shared link"].filter(Boolean).join(" · "), r.fileUrl ?? "", csvWhen(r.updatedAt)]);
    downloadCsv(`resumes-${today()}.csv`, toCsv(["Student", "Email", "Employee ID", "Course", "Resume types", "Resume link", "Updated at"], rows));
    notify(`Exported ${adminRows.length} resume${adminRows.length === 1 ? "" : "s"}.`);
  };
  return (
    <section className="local-jobs" aria-labelledby="resumes-title">
      <div className="local-jobs-head"><div><span className="detail-label">RESUMES</span><h3 id="resumes-title">Submitted student resumes</h3></div><div className="flex items-center gap-2"><strong>{adminRows.length}</strong><button type="button" className="admin-button" onClick={exportAdmin} disabled={!adminRows.length}>⬇ Export CSV</button></div></div>
      {searchBox}
      {loading ? <p className="role-manager-state" role="status">Loading resumes…</p>
        : adminRows.length ? (
          <div className="local-job-list">
            {adminRows.map((resume) => {
              const generated = hasGeneratedCV(resume.profile);
              const kinds = [generated && "Generated CV", resume.fileUrl && "Shared link"].filter(Boolean).join(" · ") || "No content";
              const isOpen = expanded === resume.id;
              return (
                <div className="local-job local-job-stack" key={resume.id}>
                  <div className="local-job-row">
                    <span><b>{resume.studentName || resume.studentEmail}</b><small>{resume.studentEmail}{resume.employeeId ? ` · ID ${resume.employeeId}` : ""}{resume.course ? ` · ${resume.course}` : ""} · {kinds}</small></span>
                    <div className="local-job-actions">
                      {generated && <><button type="button" className="edit-local" onClick={() => setExpanded(isOpen ? null : resume.id)}>{isOpen ? "Hide CV" : "View CV"}</button><button type="button" className="edit-local" onClick={() => downloadCV(resume)}>Download</button></>}
                      {resume.fileUrl && <a className="edit-local" href={resume.fileUrl} target="_blank" rel="noreferrer">Open link ↗</a>}
                      {!generated && !resume.fileUrl && <span className="text-xs text-accent italic">Nothing submitted</span>}
                    </div>
                  </div>
                  {generated && isOpen && <div className="cv-print mt-2"><GeneratedCV name={resume.studentName || resume.studentEmail} email={resume.studentEmail} course={resume.course} profile={resume.profile!} /></div>}
                </div>
              );
            })}
          </div>
        ) : <div className="admin-jobs-empty"><strong>No resumes submitted yet</strong><p>Student submissions from the My Resume tab appear here.</p></div>}
    </section>
  );
}
