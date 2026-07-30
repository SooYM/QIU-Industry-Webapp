import { FormEvent, useState } from "react";
import type { User } from "firebase/auth";
import { deleteResume, saveResume } from "../../lib/data/firestore";
import type { Resume } from "../../lib/data/types";

export function StudentResume({
  user,
  course,
  myResume,
}: {
  user: User;
  course: string | null;
  myResume: Resume | null;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [link, setLink] = useState("");

  const studentEmail = user.email ?? "";
  const studentName = user.displayName || studentEmail || "Student";

  function report(text: string, error = false) { setMessage(text); setIsError(error); }

  async function submitLink(event: FormEvent) {
    event.preventDefault();
    const url = link.trim();
    if (!/^https?:\/\/.+/i.test(url)) { report("Enter a valid link starting with http:// or https://", true); return; }
    setBusy(true);
    report("Saving your resume link…");
    try {
      await saveResume({
        id: user.uid, studentUid: user.uid, studentEmail, studentName,
        course: course ?? undefined, fileUrl: url, fileName: "Resume link", source: "link",
      });
      report("Resume link saved. Employers and admins can now view it.");
      setLink("");
    } catch {
      report("Could not save your link. Please try again.", true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="results" aria-labelledby="resume-title">
      <div className="results-head"><div><span>MY RESUME</span><h1 id="resume-title">Submit your resume</h1></div><p>Share a link to your resume. Your latest submission is visible to employers and admins.</p></div>

      <section className="local-jobs" aria-labelledby="resume-current-title">
        <div className="local-jobs-head"><div><span className="detail-label">CURRENT SUBMISSION</span><h3 id="resume-current-title">Your resume on file</h3></div></div>
        {myResume?.fileUrl ? (
          <div className="local-job">
            <span><b>Resume link</b><small>Submitted — visible to employers &amp; admins</small></span>
            <div className="local-job-actions">
              <a className="admin-button" href={myResume.fileUrl} target="_blank" rel="noreferrer">Open resume ↗</a>
              <button type="button" className="delete-local" onClick={() => { if (confirm("Remove your submitted resume?")) deleteResume(user.uid).catch(() => {}); }}>Remove</button>
            </div>
          </div>
        ) : (
          <div className="admin-jobs-empty"><strong>No resume submitted yet</strong><p>Add a resume link below to appear in the employer resume viewer.</p></div>
        )}
      </section>

      <div className="mt-4 rounded-xl p-4 panel-accent">
        <span className="detail-label">ADD OR REPLACE</span>
        <form onSubmit={submitLink} className="mt-2 flex flex-wrap items-center gap-3">
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://drive.google.com/…"
            aria-label="Resume link"
            className="flex-1 min-w-[220px] h-11 px-3 rounded-lg border border-token text-sm"
            style={{ background: "var(--surface)", color: "inherit" }}
            disabled={busy}
          />
          <button type="submit" className="save-job" disabled={busy || !link.trim()}>{busy ? "Saving…" : "Save link"}</button>
        </form>
        <div className="resume-hint" role="note">
          <b>How to share:</b> paste a <b>Google Drive / OneDrive / Dropbox</b> link, then set its sharing to <b>&ldquo;Anyone with the link&rdquo;</b> so employers and admins can open it. <b>PDF preferred.</b>
        </div>
        {message && <p className={`admin-message ${isError ? "error" : ""} mt-2`} role="status" aria-live="polite">{message}</p>}
      </div>
    </section>
  );
}
