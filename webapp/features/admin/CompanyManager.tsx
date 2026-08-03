import { FormEvent, useEffect, useState } from "react";
import { isApprovedCompany, type Company } from "../../lib/data/types";
import { useAuth } from "../../app/auth-context";
import { logoFromWebsite, normalizeEmail } from "../../app/auth-policy";
import { ImagePreview } from "../../components/ImagePreview";
import { Modal } from "../../components/Modal";
import { notify } from "../../components/toast";
import { downloadCsv, toCsv } from "../../lib/data/csv";
import { clearCompanies, deleteCompany, saveCompany, stageCompanyEdit, subscribeCompanies } from "../../lib/data/firestore";

type Draft = { name: string; email: string; website: string; logoUrl: string; videoUrl: string; summary: string; boothNumber: string; logoBackground: "auto" | "light" | "dark" };
const emptyDraft: Draft = { name: "", email: "", website: "", logoUrl: "", videoUrl: "", summary: "", boothNumber: "", logoBackground: "auto" };

/**
 * Company editor. Admins manage every company (edit / delete / clear all;
 * approval lives in the Approvals tab). In employer mode it edits ONLY that
 * employer's own single profile — the company name is fixed by their admin
 * assignment, and every save is submitted as `pending` for admin approval.
 */
export function CompanyManager({ employer, view = "both" }: { employer?: { email: string; companyName: string }; view?: "add" | "manage" | "both" }) {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => subscribeCompanies((rows) => { setCompanies(rows); setLoaded(true); }, () => {}), []);

  const myCompany = employer ? companies.find((c) => normalizeEmail(c.createdBy) === employer.email) : undefined;
  useEffect(() => {
    if (!employer || !loaded || editingId !== null) return;
    if (myCompany) fill(myCompany);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employer, loaded, myCompany?.id]);

  function fill(c: Company) {
    setEditingId(c.id);
    setDraft({ name: c.name, email: c.email ?? "", website: c.website ?? "", logoUrl: c.logoUrl ?? "", videoUrl: c.videoUrl ?? "", summary: c.summary ?? "", boothNumber: c.boothNumber ?? "", logoBackground: c.logoBackground ?? "auto" });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const name = employer ? employer.companyName : draft.name.trim();
    if (!name) { setMessage(employer ? "Your account has no company assigned — ask an admin." : "Company name is required."); return; }
    if (!employer && !draft.email.trim()) { setMessage("Company email is required."); return; }
    const existing = editingId !== null ? companies.find((c) => c.id === editingId) : undefined;
    const record: Company = {
      id: editingId ?? Date.now(),
      name,
      email: employer ? existing?.email : draft.email.trim(),
      website: draft.website.trim() || undefined,
      logoUrl: draft.logoUrl.trim() || undefined,
      videoUrl: draft.videoUrl.trim() || undefined,
      summary: draft.summary.trim() || undefined,
      // Booth is a venue/organiser concern — admins set it; employers keep any existing value.
      boothNumber: employer ? existing?.boothNumber : (draft.boothNumber.trim() || undefined),
      logoBackground: draft.logoBackground,
      status: employer ? "pending" : "approved",
    };
    // An employer editing an already-live profile stages the change (keeps the
    // live one on Home) so an admin can review the diff before it goes public.
    const liveExists = existing && isApprovedCompany(existing);
    try {
      let msg: string; let kind: "success" | "info" = "success";
      if (employer && liveExists) {
        await stageCompanyEdit(existing!.id, {
          website: record.website, logoUrl: record.logoUrl, videoUrl: record.videoUrl,
          summary: record.summary, logoBackground: record.logoBackground,
        });
        msg = "Changes submitted for admin approval."; kind = "info";
      } else {
        await saveCompany(record, editingId !== null, normalizeEmail(user?.email));
        if (!employer) { setDraft(emptyDraft); setEditingId(null); }
        msg = employer ? "Submitted for admin approval." : editingId ? "Company updated." : "Company added.";
        if (employer) kind = "info";
      }
      setMessage(msg); notify(msg, kind);
    } catch { setMessage("Could not save. Please try again."); notify("Could not save. Please try again.", "error"); }
  }

  function edit(c: Company) { fill(c); setMessage("Editing company. Save to apply changes."); }
  function cancelEdit() { setEditingId(null); setDraft(emptyDraft); setMessage(""); }

  // ---- Employer mode: a single self-service profile form --------------------
  if (employer) {
    const pending = myCompany && !isApprovedCompany(myCompany);
    return (
      <section className="local-jobs" aria-labelledby="employer-company-title">
        <div className="local-jobs-head"><div><span className="detail-label">COMPANY PROFILE</span><h3 id="employer-company-title">Your Home-page profile</h3></div>{myCompany && <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${isApprovedCompany(myCompany) ? "tone-success" : "tone-neutral"}`}>{isApprovedCompany(myCompany) ? "Live" : "Pending approval"}</span>}</div>
        {!employer.companyName
          ? <div className="admin-jobs-empty"><strong>No company assigned</strong><p>Ask an admin to set your company before adding a profile.</p></div>
          : <>
            <p className="admin-intro">You are posting as <b>{employer.companyName}</b> — the name is set by your admin. Edits go for approval before they show on Home.{pending ? " Your latest changes are awaiting review." : ""}</p>
            <CompanyForm draft={draft} setDraft={setDraft} onSubmit={submit} showName={false} showBooth={false} submitLabel={myCompany ? "Submit changes" : "Submit for approval"} />
            {message && <p className="admin-message mt-2" role="status" aria-live="polite">{message}</p>}
          </>}
      </section>
    );
  }

  // ---- Admin mode -----------------------------------------------------------
  const showAddForm = view !== "manage" && editingId === null;
  const showList = view !== "add";
  return (
    <section className="local-jobs" aria-labelledby="company-manager-title">
      <div className="local-jobs-head"><div><span className="detail-label">COMPANIES</span><h3 id="company-manager-title">{showAddForm && !showList ? "Add a company" : showList && !showAddForm ? "Manage companies" : "Companies"}</h3></div><strong>{companies.length}</strong></div>

      {showAddForm && <>
        <CompanyForm draft={draft} setDraft={setDraft} onSubmit={submit} showName showBooth submitLabel="Add company" />
        {message && <p className="admin-message mt-2" role="status" aria-live="polite">{message}</p>}
      </>}

      {editingId !== null && <Modal className="admin-panel" labelledBy="exhibitor-edit-title" closeLabel="Close company editor" onClose={cancelEdit}>
        <span className="detail-label">COMPANIES</span><h2 id="exhibitor-edit-title">Edit company</h2>
        <CompanyForm draft={draft} setDraft={setDraft} onSubmit={submit} showName showBooth submitLabel="Save changes" onCancel={cancelEdit} />
        {message && <p className="admin-message mt-2" role="status" aria-live="polite">{message}</p>}
      </Modal>}

      {showList && companies.length > 0 && (
        <>
          <div className="local-jobs-head mt-4">
            <div><span className="detail-label">MANAGE</span><h3>All companies</h3></div>
            <div className="flex items-center gap-2">
              <button type="button" className="admin-button" onClick={() => { const rows = companies.map((c) => [c.name, c.email ?? "", c.boothNumber ?? "", c.website ?? "", c.videoUrl ?? "", isApprovedCompany(c) ? "Approved" : "Pending", c.createdBy ?? "", (c.summary ?? "").replace(/\s+/g, " ").trim()]); downloadCsv(`companies-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(["Company", "Email", "Booth", "Website", "Video", "Status", "Created by", "Summary"], rows)); notify(`Exported ${companies.length} companies.`); }}>⬇ Export CSV</button>
              <button type="button" className="delete-local" onClick={() => { if (confirm(`Remove ALL ${companies.length} companies? This cannot be undone.`)) clearCompanies(companies.map((c) => c.id)).then(() => { setMessage("All companies cleared."); notify("All companies cleared."); }); }}>Clear all</button>
            </div>
          </div>
          <div className="local-job-list">
            {companies.map((c) => (
              <div className="local-job" key={c.id}>
                <span><b>{c.name} {!isApprovedCompany(c) && <span className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold tone-neutral">Pending</span>}{c.boothNumber && <span className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold tone-accent">Booth {c.boothNumber}</span>}</b><small>{[c.email, c.website].filter(Boolean).join(" · ") || "No contact details"}</small></span>
                <div className="local-job-actions">
                  <button className="edit-local" onClick={() => { edit(c); }}>Edit</button>
                  <button className="delete-local" onClick={() => { if (confirm(`Remove "${c.name}" from the Home page?`)) deleteCompany(c.id).then(() => notify(`Removed ${c.name}.`)).catch(() => notify("Could not remove.", "error")); }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {showList && companies.length === 0 && !showAddForm && <div className="admin-jobs-empty"><strong>No companies yet</strong><p>Add one from the “Add company” tab.</p></div>}
    </section>
  );
}

function CompanyForm({ draft, setDraft, onSubmit, onCancel, showName, showBooth, submitLabel }: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onSubmit: (e: FormEvent) => void;
  onCancel?: () => void;
  showName: boolean;
  showBooth: boolean;
  submitLabel: string;
}) {
  return (
    <form onSubmit={onSubmit} className="admin-form">
      {showName && <label className="full">Company name<input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>}
      {showName && <label>Company email<input type="email" required value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></label>}
      <label>Website URL<input type="url" value={draft.website} placeholder="https://…" onChange={(e) => setDraft({ ...draft, website: e.target.value })} /></label>
      {showBooth && <label>Booth number<input value={draft.boothNumber} placeholder="e.g. A12" onChange={(e) => setDraft({ ...draft, boothNumber: e.target.value })} /></label>}
      <label className="full">Logo image URL
        <span className="register-logo-row"><input type="url" value={draft.logoUrl} placeholder="https://…/logo.png" onChange={(e) => setDraft({ ...draft, logoUrl: e.target.value })} /><button type="button" className="reset-admin-filters register-logo-btn" onClick={() => setDraft({ ...draft, logoUrl: logoFromWebsite(draft.website) })} disabled={!draft.website.trim()}>From website</button></span>
        <small className="field-label">Auto-fetches the brand logo from the website — or paste your own link.</small>
      </label>
      <div className="full"><ImagePreview url={draft.logoUrl} label="Logo preview" /></div>
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
