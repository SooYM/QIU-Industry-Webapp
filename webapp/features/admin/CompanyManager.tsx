import { FormEvent, useEffect, useState } from "react";
import { isApprovedCompany, type Company } from "../../lib/data/types";
import { useAuth } from "../../app/auth-context";
import { normalizeEmail } from "../../app/auth-policy";
import { clearCompanies, deleteCompany, saveCompany, subscribeCompanies } from "../../lib/data/firestore";

type Draft = { name: string; website: string; logoUrl: string; videoUrl: string; summary: string; order: string; boothNumber: string; logoBackground: "auto" | "light" | "dark" };
const emptyDraft: Draft = { name: "", website: "", logoUrl: "", videoUrl: "", summary: "", order: "", boothNumber: "", logoBackground: "auto" };

/**
 * Exhibitor editor. Admins manage every company (approve/edit/delete/clear all).
 * In employer mode it edits ONLY that employer's own single profile, which is
 * submitted as `pending` for admin approval before it appears on Home.
 */
export function CompanyManager({ employer }: { employer?: { email: string; companyName: string } }) {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => subscribeCompanies((rows) => { setCompanies(rows); setLoaded(true); }, () => {}), []);

  // Employer: auto-load their own profile into the form once companies arrive.
  const myCompany = employer ? companies.find((c) => normalizeEmail(c.createdBy) === employer.email) : undefined;
  useEffect(() => {
    if (!employer || !loaded || editingId !== null) return;
    if (myCompany) fill(myCompany);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employer, loaded, myCompany?.id]);

  function fill(c: Company) {
    setEditingId(c.id);
    setDraft({ name: c.name, website: c.website ?? "", logoUrl: c.logoUrl ?? "", videoUrl: c.videoUrl ?? "", summary: c.summary ?? "", order: c.order != null ? String(c.order) : "", boothNumber: c.boothNumber ?? "", logoBackground: c.logoBackground ?? "auto" });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const name = employer ? employer.companyName : draft.name.trim();
    if (!name) { setMessage(employer ? "Your account has no company assigned — ask an admin." : "Company name is required."); return; }
    const existing = editingId !== null ? companies.find((c) => c.id === editingId) : undefined;
    const record: Company = {
      id: editingId ?? Date.now(),
      name,
      website: draft.website.trim() || undefined,
      logoUrl: draft.logoUrl.trim() || undefined,
      videoUrl: draft.videoUrl.trim() || undefined,
      summary: draft.summary.trim() || undefined,
      order: draft.order.trim() ? Number(draft.order) : undefined,
      // Booth is a venue/organiser concern — admins set it; employers keep any existing value.
      boothNumber: employer ? existing?.boothNumber : (draft.boothNumber.trim() || undefined),
      logoBackground: draft.logoBackground,
      status: employer ? "pending" : "approved",
    };
    try {
      await saveCompany(record, editingId !== null, normalizeEmail(user?.email));
      if (!employer) { setDraft(emptyDraft); setEditingId(null); }
      setMessage(employer ? "Submitted for admin approval." : editingId ? "Exhibitor updated." : "Exhibitor added.");
    } catch { setMessage("Could not save. Please try again."); }
  }

  function edit(c: Company) { fill(c); setMessage("Editing exhibitor. Save to apply changes."); }

  async function approve(c: Company) {
    try { await saveCompany({ ...c, status: "approved" }, true, normalizeEmail(user?.email)); setMessage(`${c.name} approved.`); }
    catch { setMessage("Could not approve."); }
  }

  // ---- Employer mode: a single self-service profile form --------------------
  if (employer) {
    const pending = myCompany && !isApprovedCompany(myCompany);
    return (
      <section className="local-jobs" aria-labelledby="employer-company-title">
        <div className="local-jobs-head"><div><span className="detail-label">COMPANY PROFILE</span><h3 id="employer-company-title">Your Home-page profile</h3></div>{myCompany && <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${isApprovedCompany(myCompany) ? "tone-success" : "tone-neutral"}`}>{isApprovedCompany(myCompany) ? "Live" : "Pending approval"}</span>}</div>
        {!employer.companyName
          ? <div className="admin-jobs-empty"><strong>No company assigned</strong><p>Ask an admin to set your company before adding a profile.</p></div>
          : <>
            <p className="admin-intro">Edits go to an admin for approval before they show on the Home page.{pending ? " Your latest changes are awaiting review." : ""}</p>
            <CompanyForm draft={draft} setDraft={setDraft} onSubmit={submit} nameLocked={employer.companyName} showBooth={false} submitLabel={myCompany ? "Submit changes" : "Submit for approval"} />
            {message && <p className="admin-message mt-2" role="status" aria-live="polite">{message}</p>}
          </>}
      </section>
    );
  }

  // ---- Admin mode -----------------------------------------------------------
  return (
    <section className="local-jobs" aria-labelledby="company-manager-title">
      <div className="local-jobs-head"><div><span className="detail-label">EXHIBITORS</span><h3 id="company-manager-title">Companies on the Home page</h3></div><strong>{companies.length}</strong></div>

      <CompanyForm draft={draft} setDraft={setDraft} onSubmit={submit} showBooth submitLabel={editingId ? "Save changes" : "Add exhibitor"}
        onCancel={editingId ? () => { setEditingId(null); setDraft(emptyDraft); setMessage(""); } : undefined} />
      {message && <p className="admin-message mt-2" role="status" aria-live="polite">{message}</p>}

      {companies.length > 0 && (
        <>
          <div className="local-jobs-head mt-4"><div><span className="detail-label">MANAGE</span></div><button type="button" className="delete-local" onClick={() => { if (confirm(`Remove ALL ${companies.length} exhibitors? This cannot be undone.`)) clearCompanies(companies.map((c) => c.id)).then(() => setMessage("All exhibitors cleared.")); }}>Clear all exhibitors</button></div>
          <div className="local-job-list">
            {companies.map((c) => (
              <div className="local-job" key={c.id}>
                <span><b>{c.name} {!isApprovedCompany(c) && <span className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold tone-neutral">Pending</span>}{c.boothNumber && <span className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold tone-accent">Booth {c.boothNumber}</span>}</b><small>{[c.createdBy, c.website].filter(Boolean).join(" · ") || "No links"}</small></span>
                <div className="local-job-actions">
                  {!isApprovedCompany(c) && <button className="edit-local" onClick={() => approve(c)}>Approve</button>}
                  <button className="edit-local" onClick={() => edit(c)}>Edit</button>
                  <button className="delete-local" onClick={() => { if (confirm(`Remove "${c.name}" from the Home page?`)) deleteCompany(c.id).catch(() => {}); }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function CompanyForm({ draft, setDraft, onSubmit, onCancel, nameLocked, showBooth, submitLabel }: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onSubmit: (e: FormEvent) => void;
  onCancel?: () => void;
  nameLocked?: string;
  showBooth: boolean;
  submitLabel: string;
}) {
  return (
    <form onSubmit={onSubmit} className="admin-form">
      <label className="full">Company name{nameLocked
        ? <input value={nameLocked} readOnly disabled />
        : <input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />}</label>
      <label>Website URL<input type="url" value={draft.website} placeholder="https://…" onChange={(e) => setDraft({ ...draft, website: e.target.value })} /></label>
      {showBooth
        ? <label>Booth number<input value={draft.boothNumber} placeholder="e.g. A12" onChange={(e) => setDraft({ ...draft, boothNumber: e.target.value })} /></label>
        : <label>Display order<input type="number" value={draft.order} placeholder="e.g. 1" onChange={(e) => setDraft({ ...draft, order: e.target.value })} /></label>}
      {showBooth && <label>Display order<input type="number" value={draft.order} placeholder="e.g. 1" onChange={(e) => setDraft({ ...draft, order: e.target.value })} /></label>}
      <label className="full">Logo image URL<input type="url" value={draft.logoUrl} placeholder="https://…/logo.png" onChange={(e) => setDraft({ ...draft, logoUrl: e.target.value })} /></label>
      <label className="full">Logo tile background<select value={draft.logoBackground} onChange={(e) => setDraft({ ...draft, logoBackground: e.target.value as Draft["logoBackground"] })}><option value="auto">Auto (detect from logo)</option><option value="light">Light</option><option value="dark">Dark</option></select><small className="field-label">Use Dark for white / light-coloured transparent logos so they stay visible.</small></label>
      <label className="full">Corporate video (YouTube URL)<input type="url" value={draft.videoUrl} placeholder="https://www.youtube.com/watch?v=…" onChange={(e) => setDraft({ ...draft, videoUrl: e.target.value })} /></label>
      <label className="full"><span className="field-label">Company profile / blurb</span><textarea rows={3} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} /></label>
      <div className="admin-form-footer full">
        <div className="admin-submit">
          {onCancel && <button type="button" className="cancel-edit" onClick={onCancel}>Cancel edit</button>}
          <button type="submit" className="save-job">{submitLabel}</button>
        </div>
      </div>
    </form>
  );
}
