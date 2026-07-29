import { ChangeEvent, useState } from "react";
import type { User } from "firebase/auth";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "../../app/firebase-client";
import { saveResume } from "../../lib/data/firestore";
import type { Resume } from "../../lib/data/types";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

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

  const studentEmail = user.email ?? "";
  const studentName = user.displayName || studentEmail || "Student";

  function report(text: string, error = false) { setMessage(text); setIsError(error); }

  async function uploadPdf(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!storage) { report("File storage is not configured for this deployment.", true); return; }
    if (file.type !== "application/pdf") { report("Please choose a PDF file.", true); return; }
    if (file.size > MAX_BYTES) { report("PDF is larger than 5 MB. Please upload a smaller file.", true); return; }

    setBusy(true);
    report("Uploading your resume…");
    try {
      const safeName = file.name.replace(/[^\w.-]+/g, "_");
      const fileRef = ref(storage, `resumes/${user.uid}/${safeName}`);
      await uploadBytes(fileRef, file);
      const fileUrl = await getDownloadURL(fileRef);
      await saveResume({
        id: user.uid, studentUid: user.uid, studentEmail, studentName,
        course: course ?? undefined, fileUrl, fileName: file.name, source: "upload",
      });
      report("Resume submitted. Employers and admins can now view it.");
    } catch {
      report("Upload failed. Please try again.", true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="results" aria-labelledby="resume-title">
      <div className="results-head"><div><span>MY RESUME</span><h1 id="resume-title">Submit your resume</h1></div><p>Upload a PDF resume. Your latest submission is shared with employers and admins.</p></div>

      <section className="local-jobs" aria-labelledby="resume-current-title">
        <div className="local-jobs-head"><div><span className="detail-label">CURRENT SUBMISSION</span><h3 id="resume-current-title">Your resume on file</h3></div></div>
        {myResume ? (
          <div className="local-job">
            <span>
              <b>{myResume.fileName ?? "Submitted resume"}</b>
              <small>Uploaded PDF</small>
            </span>
            <div className="local-job-actions">
              {myResume.fileUrl
                ? <a className="edit-local" href={myResume.fileUrl} target="_blank" rel="noreferrer">Open PDF</a>
                : <span className="text-xs text-accent italic">No file on record</span>}
            </div>
          </div>
        ) : (
          <div className="admin-jobs-empty"><strong>No resume submitted yet</strong><p>Upload a PDF below to appear in the employer resume viewer.</p></div>
        )}
      </section>

      <div className="mt-4 rounded-xl p-4 panel-accent">
        <span className="detail-label">ADD OR REPLACE</span>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <label className="admin-button tone-accent font-bold cursor-pointer">
            {busy ? "Uploading…" : myResume?.fileUrl ? "Replace PDF" : "Upload PDF"}
            <input type="file" accept="application/pdf" className="sr-only" disabled={busy} onChange={uploadPdf} />
          </label>
        </div>
        <small className="text-accent mt-2 block">PDF only, up to 5 MB.</small>
        {message && <p className={`admin-message ${isError ? "error" : ""} mt-2`} role="status" aria-live="polite">{message}</p>}
      </div>
    </section>
  );
}
