import { FormEvent, useEffect, useState } from "react";
import type { AppSettings } from "../../lib/data/types";
import { DEFAULT_SETTINGS, saveSettings, subscribeSettings } from "../../lib/data/firestore";
import { CompanyManager } from "./CompanyManager";

const TAB_LABELS: { key: keyof AppSettings["tabs"]; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "events", label: "Events" },
  { key: "resume", label: "My Resume" },
  { key: "vacancies", label: "Vacancies" },
  { key: "history", label: "History" },
];

/**
 * The one place non-IT staff change how the portal reads and behaves: copy,
 * attendance rules, which sections are visible, and the exhibitor line-up.
 */
export function SettingsPanel() {
  const [form, setForm] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeSettings(setForm), []);

  const set = (patch: Partial<AppSettings>) => setForm((f) => ({ ...f, ...patch }));
  const setTab = (key: keyof AppSettings["tabs"], on: boolean) => setForm((f) => ({ ...f, tabs: { ...f.tabs, [key]: on } }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("Saving settings…");
    try {
      await saveSettings({
        ...form,
        qrRotateSeconds: Math.min(600, Math.max(5, Number(form.qrRotateSeconds) || DEFAULT_SETTINGS.qrRotateSeconds)),
        ccaPercent: Math.min(100, Math.max(0, Number(form.ccaPercent))),
        ccaFloorMinutes: Math.min(1440, Math.max(0, Number(form.ccaFloorMinutes))),
      });
      setMessage("Settings saved. Changes apply to everyone immediately.");
    } catch { setMessage("Could not save settings."); }
    finally { setBusy(false); }
  }

  return (
    <div className="settings-panel">
      <form onSubmit={submit} className="admin-form">
        <div className="section-heading full"><div><span>BRANDING</span><h3>Title &amp; tagline</h3></div></div>
        <label className="full">Portal title<input value={form.portalTitle} maxLength={120} onChange={(e) => set({ portalTitle: e.target.value })} /><small className="field-label">Shown in the top bar and Home page. The first word is styled separately.</small></label>
        <label className="full">Tagline<input value={form.portalTagline} maxLength={200} onChange={(e) => set({ portalTagline: e.target.value })} /><small className="field-label">Shown on the Home page and in the footer.</small></label>

        <div className="section-heading full"><div><span>ATTENDANCE</span><h3>QR &amp; CCA rules</h3></div></div>
        <label>Default QR rotate (seconds)<input type="number" min="5" max="600" value={form.qrRotateSeconds} onChange={(e) => set({ qrRotateSeconds: Number(e.target.value) })} /><small className="field-label">Per-event value overrides this.</small></label>
        <label>CCA threshold (% of session)<input type="number" min="0" max="100" value={form.ccaPercent} onChange={(e) => set({ ccaPercent: Number(e.target.value) })} /></label>
        <label>CCA minimum minutes floor<input type="number" min="0" max="1440" value={form.ccaFloorMinutes} onChange={(e) => set({ ccaFloorMinutes: Number(e.target.value) })} /><small className="field-label">Used when an event has no set length.</small></label>

        <div className="section-heading full"><div><span>SECTIONS</span><h3>Show / hide tabs</h3></div></div>
        <fieldset className="toggle-grid full">
          {TAB_LABELS.map(({ key, label }) => (
            <label key={key} className="toggle-row"><input type="checkbox" checked={form.tabs[key] !== false} onChange={(e) => setTab(key, e.target.checked)} /> {label}</label>
          ))}
        </fieldset>

        <div className="admin-form-footer full">
          {message && <p className="admin-message" role="status" aria-live="polite">{message}</p>}
          <div className="admin-submit"><button type="submit" className="save-job" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button></div>
        </div>
      </form>

      <CompanyManager />
    </div>
  );
}
