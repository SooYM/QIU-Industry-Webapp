import { FormEvent, useEffect, useState } from "react";
import type { Company } from "../../lib/data/types";
import { useAuth } from "../../app/auth-context";
import { normalizeEmail } from "../../app/auth-policy";
import { deleteCompany, saveCompany, subscribeCompanies } from "../../lib/data/firestore";

type Draft = { name: string; website: string; logoUrl: string; videoUrl: string; summary: string; order: string };
const emptyDraft: Draft = { name: "", website: "", logoUrl: "", videoUrl: "", summary: "", order: "" };

/** Admin CRUD for the exhibitors shown on the Home landing. */
export function CompanyManager() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => subscribeCompanies(setCompanies, () => {}), []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) { setMessage("Company name is required."); return; }
    const record: Company = {
      id: editingId ?? Date.now(),
      name: draft.name.trim(),
      website: draft.website.trim() || undefined,
      logoUrl: draft.logoUrl.trim() || undefined,
      videoUrl: draft.videoUrl.trim() || undefined,
      summary: draft.summary.trim() || undefined,
      order: draft.order.trim() ? Number(draft.order) : undefined,
    };
    try {
      await saveCompany(record, editingId !== null, normalizeEmail(user?.email));
      setDraft(emptyDraft);
      setEditingId(null);
      setMessage(editingId ? "Exhibitor updated." : "Exhibitor added.");
    } catch { setMessage("Could not save the exhibitor."); }
  }

  function edit(c: Company) {
    setEditingId(c.id);
    setDraft({ name: c.name, website: c.website ?? "", logoUrl: c.logoUrl ?? "", videoUrl: c.videoUrl ?? "", summary: c.summary ?? "", order: c.order != null ? String(c.order) : "" });
    setMessage("Editing exhibitor. Save to apply changes.");
  }

  return (
    <section className="local-jobs" aria-labelledby="company-manager-title">
      <div className="local-jobs-head"><div><span className="detail-label">EXHIBITORS</span><h3 id="company-manager-title">Companies on the Home page</h3></div><strong>{companies.length}</strong></div>

      <form onSubmit={submit} className="admin-form">
        <label className="full">Company name<input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
        <label>Website URL<input type="url" value={draft.website} placeholder="https://…" onChange={(e) => setDraft({ ...draft, website: e.target.value })} /></label>
        <label>Display order<input type="number" value={draft.order} placeholder="e.g. 1" onChange={(e) => setDraft({ ...draft, order: e.target.value })} /></label>
        <label className="full">Logo image URL<input type="url" value={draft.logoUrl} placeholder="https://…/logo.png" onChange={(e) => setDraft({ ...draft, logoUrl: e.target.value })} /></label>
        <label className="full">Company video (YouTube URL)<input type="url" value={draft.videoUrl} placeholder="https://www.youtube.com/watch?v=…" onChange={(e) => setDraft({ ...draft, videoUrl: e.target.value })} /></label>
        <label className="full"><span className="field-label">Company profile / blurb</span><textarea rows={3} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} /></label>
        <div className="admin-form-footer full">
          {message && <p className="admin-message" role="status" aria-live="polite">{message}</p>}
          <div className="admin-submit">
            {editingId && <button type="button" className="cancel-edit" onClick={() => { setEditingId(null); setDraft(emptyDraft); setMessage(""); }}>Cancel edit</button>}
            <button type="submit" className="save-job">{editingId ? "Save changes" : "Add exhibitor"}</button>
          </div>
        </div>
      </form>

      {companies.length > 0 && (
        <div className="local-job-list">
          {companies.map((c) => (
            <div className="local-job" key={c.id}>
              <span><b>{c.name}</b><small>{[c.website, c.videoUrl ? "has video" : null].filter(Boolean).join(" · ") || "No links"}</small></span>
              <div className="local-job-actions">
                <button className="edit-local" onClick={() => edit(c)}>Edit</button>
                <button className="delete-local" onClick={() => { if (confirm(`Remove "${c.name}" from the Home page?`)) deleteCompany(c.id).catch(() => {}); }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
