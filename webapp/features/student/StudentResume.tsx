import { FormEvent, useState } from "react";
import type { User } from "firebase/auth";
import { deleteResume, saveResume } from "../../lib/data/firestore";
import { hasGeneratedCV, type Resume, type ResumeProfile } from "../../lib/data/types";
import { GeneratedCV } from "./GeneratedCV";
import { notify } from "../../components/toast";

const emptyProfile: ResumeProfile = {
  headline: "", summary: "", phone: "", cgpa: "", fypTitle: "", fypSummary: "",
  skills: "", education: "", experience: "", achievements: "", links: [],
};

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
  const [profile, setProfile] = useState<ResumeProfile>({ ...emptyProfile, ...(myResume?.profile ?? {}) });
  const [linksText, setLinksText] = useState((myResume?.profile?.links ?? []).join("\n"));

  const studentEmail = user.email ?? "";
  const studentName = user.displayName || studentEmail || "Student";
  const set = (patch: Partial<ResumeProfile>) => setProfile((p) => ({ ...p, ...patch }));

  function report(text: string, error = false) { setMessage(text); setIsError(error); }
  function done(text: string, error = false) { report(text, error); notify(text, error ? "error" : "success"); }

  // Live preview reflects unsaved edits, including the links textarea.
  const previewProfile: ResumeProfile = {
    ...profile,
    links: linksText.split(/[\s,]+/).map((l) => l.trim()).filter(Boolean),
  };
  const previewReady = hasGeneratedCV(previewProfile);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!previewReady) { done("Add at least a summary, skills, or education before saving your CV.", true); return; }
    setBusy(true);
    report("Saving your CV details…");
    try {
      await saveResume({
        id: user.uid, studentUid: user.uid, studentEmail, studentName,
        course: course ?? undefined,
        // Keep any existing shared link; primary source is the generated CV unless only a link exists.
        fileUrl: myResume?.fileUrl,
        fileName: myResume?.fileName,
        source: myResume?.fileUrl ? "link" : "generated",
        profile: previewProfile,
      });
      done("CV details saved. Employers and admins can view your generated CV.");
    } catch {
      done("Could not save your CV details. Please try again.", true);
    } finally {
      setBusy(false);
    }
  }

  async function clearGeneratedCV() {
    if (!confirm("Remove your generated CV? Your entered details will be cleared.")) return;
    setBusy(true);
    report("Clearing your generated CV…");
    try {
      await saveResume({
        id: user.uid, studentUid: user.uid, studentEmail, studentName,
        course: course ?? undefined, fileUrl: myResume?.fileUrl, fileName: myResume?.fileName,
        source: myResume?.fileUrl ? "link" : "generated", profile: {},
      });
      setProfile({ ...emptyProfile });
      setLinksText("");
      done("Generated CV cleared.");
    } catch {
      done("Could not clear your generated CV. Please try again.", true);
    } finally {
      setBusy(false);
    }
  }

  async function submitLink(event: FormEvent) {
    event.preventDefault();
    const url = link.trim();
    if (!/^https?:\/\/.+/i.test(url)) { done("Enter a valid link starting with http:// or https://", true); return; }
    setBusy(true);
    report("Saving your resume link…");
    try {
      await saveResume({
        id: user.uid, studentUid: user.uid, studentEmail, studentName,
        course: course ?? undefined, fileUrl: url, fileName: "Resume link", source: "link",
        profile: myResume?.profile,
      });
      done("Resume link saved. Employers and admins can now open it.");
      setLink("");
    } catch {
      done("Could not save your link. Please try again.", true);
    } finally {
      setBusy(false);
    }
  }

  const generatedOnFile = hasGeneratedCV(myResume?.profile);
  const linkOnFile = Boolean(myResume?.fileUrl);

  return (
    <section className="results" aria-labelledby="resume-title">
      <div className="results-head"><div><span>MY RESUME</span><h1 id="resume-title">Build your CV</h1></div><p>Fill in your details to generate a clean CV, and/or paste a link to your own resume. When you apply, you choose which one to send.</p></div>

      <section className="local-jobs" aria-labelledby="resume-current-title">
        <div className="local-jobs-head"><div><span className="detail-label">ON FILE</span><h3 id="resume-current-title">What employers can see</h3></div></div>
        <div className="resume-status-grid">
          <div className={`resume-status ${generatedOnFile ? "ready" : ""}`}>
            <strong>{generatedOnFile ? "✓ Generated CV ready" : "Generated CV not built yet"}</strong>
            {generatedOnFile
              ? <div className="local-job-actions"><button type="button" className="delete-local" onClick={clearGeneratedCV} disabled={busy}>Clear CV</button></div>
              : <small>Fill in the form below to create one.</small>}
          </div>
          <div className={`resume-status ${linkOnFile ? "ready" : ""}`}>
            <strong>{linkOnFile ? "✓ Resume link on file" : "No resume link yet"}</strong>
            {linkOnFile
              ? <div className="local-job-actions"><a className="admin-button" href={myResume!.fileUrl} target="_blank" rel="noreferrer">Open link ↗</a><button type="button" className="delete-local" onClick={() => { if (confirm("Remove your submitted resume link?")) deleteResume(user.uid).then(() => notify("Resume link removed.")).catch(() => notify("Could not remove.", "error")); }}>Remove</button></div>
              : <small>Optional — paste one below.</small>}
          </div>
        </div>
      </section>

      {/* Option 1 — the generated CV */}
      <div className="mt-4 rounded-xl p-4 panel-accent">
        <span className="detail-label">OPTION 1 · GENERATE A CV</span>
        <div className="resume-builder">
          <form onSubmit={saveProfile} className="cv-form">
            <label className="full">Headline<input value={profile.headline ?? ""} placeholder="e.g. Final-year Computer Science student" onChange={(e) => set({ headline: e.target.value })} maxLength={120} /></label>
            <label className="full"><span className="field-label">Profile summary</span><textarea rows={3} value={profile.summary ?? ""} placeholder="A short paragraph about you, your interests and career goals." onChange={(e) => set({ summary: e.target.value })} /></label>
            <label>Phone<input value={profile.phone ?? ""} placeholder="+60…" onChange={(e) => set({ phone: e.target.value })} maxLength={40} /></label>
            <label>CGPA / results<input value={profile.cgpa ?? ""} placeholder="e.g. 3.75 / 4.00" onChange={(e) => set({ cgpa: e.target.value })} maxLength={40} /></label>
            <label className="full">Final-year project title<input value={profile.fypTitle ?? ""} placeholder="e.g. Real-time attendance with rotating QR codes" onChange={(e) => set({ fypTitle: e.target.value })} maxLength={200} /></label>
            <label className="full"><span className="field-label">Final-year project summary</span><textarea rows={2} value={profile.fypSummary ?? ""} placeholder="What it does, your role, the tech used." onChange={(e) => set({ fypSummary: e.target.value })} /></label>
            <label className="full"><span className="field-label">Education</span><textarea rows={2} value={profile.education ?? ""} placeholder="Programme, institution, years." onChange={(e) => set({ education: e.target.value })} /></label>
            <label className="full"><span className="field-label">Experience</span><textarea rows={3} value={profile.experience ?? ""} placeholder="Internships, part-time roles, projects — one per line." onChange={(e) => set({ experience: e.target.value })} /></label>
            <label className="full"><span className="field-label">Skills</span><textarea rows={2} value={profile.skills ?? ""} placeholder="Comma or line separated, e.g. Python, React, teamwork" onChange={(e) => set({ skills: e.target.value })} /></label>
            <label className="full"><span className="field-label">Achievements</span><textarea rows={2} value={profile.achievements ?? ""} placeholder="Awards, certifications, notable results." onChange={(e) => set({ achievements: e.target.value })} /></label>
            <label className="full"><span className="field-label">Portfolio / LinkedIn links <small>One per line</small></span><textarea rows={2} value={linksText} placeholder={"https://linkedin.com/in/you\nhttps://github.com/you"} onChange={(e) => setLinksText(e.target.value)} /></label>
            <div className="admin-form-footer full"><div className="admin-submit"><button type="submit" className="save-job" disabled={busy}>{busy ? "Saving…" : "Save CV details"}</button></div></div>
          </form>

          <div className="cv-preview">
            <div className="cv-preview-head"><span className="detail-label">LIVE PREVIEW</span>{previewReady && <button type="button" className="admin-button" onClick={() => window.print()}>🖨 Print / Save as PDF</button>}</div>
            <div className="cv-print">
              {previewReady
                ? <GeneratedCV name={studentName} email={studentEmail} course={course} profile={previewProfile} />
                : <div className="admin-jobs-empty"><strong>Your CV preview appears here</strong><p>Start filling in the form and your CV builds live.</p></div>}
            </div>
          </div>
        </div>
      </div>

      {/* Option 2 — a shared link */}
      <div className="mt-4 rounded-xl p-4 panel-accent">
        <span className="detail-label">OPTION 2 · PASTE YOUR OWN RESUME LINK</span>
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
      </div>

      {message && <p className={`admin-message ${isError ? "error" : ""} mt-2`} role="status" aria-live="polite">{message}</p>}
    </section>
  );
}
