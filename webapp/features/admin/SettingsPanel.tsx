import { FormEvent, useEffect, useState } from "react";
import type { AppSettings } from "../../lib/data/types";
import { DEFAULT_SETTINGS, resetAllData, saveSettings, subscribeSettings } from "../../lib/data/firestore";
import { useAuth } from "../../app/auth-context";
import { normalizeEmail } from "../../app/auth-policy";
import { notify } from "../../components/toast";
import { DataExport } from "./DataExport";

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
  const { role, user } = useAuth();
  const [form, setForm] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => subscribeSettings(setForm), []);

  async function resetAll() {
    const answer = window.prompt("DANGER: this permanently erases ALL vacancies, applications, resumes, events, attendance, companies, registrations and non-superadmin accounts. This cannot be undone.\n\nType CONFIRM-RESET to proceed:");
    if (answer !== "CONFIRM-RESET") { setMessage(answer == null ? "" : "Reset cancelled — you must type CONFIRM-RESET exactly."); return; }
    setResetting(true);
    setMessage("Resetting all data…");
    try { await resetAllData(normalizeEmail(user?.email)); setMessage("All data has been reset. The portal is now empty."); notify("All data reset — portal is now empty."); }
    catch { setMessage("Reset failed — some records may remain. Try again."); notify("Reset failed — some records may remain.", "error"); }
    finally { setResetting(false); }
  }

  const set = (patch: Partial<AppSettings>) => setForm((f) => ({ ...f, ...patch }));
  const setTab = (key: keyof AppSettings["tabs"], on: boolean) => setForm((f) => ({ ...f, tabs: { ...f.tabs, [key]: on } }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("Saving settings…");
    try {
      await saveSettings({
        ...form,
        qrRotateSeconds: Number(form.qrRotateSeconds) === 0 ? 0 : Math.min(600, Math.max(5, Number(form.qrRotateSeconds) || DEFAULT_SETTINGS.qrRotateSeconds)),
        ccaPercent: Math.min(100, Math.max(0, Number(form.ccaPercent))),
        eventSpecializations: Array.from(new Set(form.eventSpecializations.map((item) => item.trim()).filter(Boolean))).slice(0, 50),
      });
      setMessage("Settings saved. Changes apply to everyone immediately.");
      notify("Settings saved.");
    } catch { setMessage("Could not save settings."); notify("Could not save settings.", "error"); }
    finally { setBusy(false); }
  }

  return (
    <div className="settings-panel">
      <form onSubmit={submit} className="admin-form">
        <div className="section-heading full"><div><span>BRANDING</span><h3>Title &amp; tagline</h3></div></div>
        <label className="full">Portal title<input value={form.portalTitle} maxLength={120} onChange={(e) => set({ portalTitle: e.target.value })} /><small className="field-label">Shown in the top bar and Home page. The first word is styled separately.</small></label>
        <label className="full">Tagline<input value={form.portalTagline} maxLength={200} onChange={(e) => set({ portalTagline: e.target.value })} /><small className="field-label">Shown on the Home page and in the footer.</small></label>

        <div className="section-heading full"><div><span>ATTENDANCE</span><h3>QR &amp; CCA rules</h3></div></div>
        <label>Default QR rotate (seconds)<input type="number" min="0" max="600" value={form.qrRotateSeconds} onChange={(e) => set({ qrRotateSeconds: Number(e.target.value) })} /><small className="field-label">Use 0 for one static QR. Otherwise use 5–600 seconds; the previous QR remains valid for one extra interval.</small></label>
        <label>CCA threshold (% of session)<input type="number" min="0" max="100" value={form.ccaPercent || ""} onChange={(e) => set({ ccaPercent: Number(e.target.value) })} /></label>

        <label className="full"><span className="field-label">Event specializations <small>One option per line; include “Other” wherever it should appear.</small></span><textarea rows={8} value={form.eventSpecializations.join("\n")} onChange={(e) => set({ eventSpecializations: e.target.value.split("\n") })} /></label>

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

      <DataExport />

      {role === "superadmin" && (
        <div className="danger-zone">
          <div className="section-heading"><div><span>DANGER ZONE</span><h3>Reset all data</h3></div></div>
          <p>Wipes every vacancy, application, resume, event, attendance record, company and registration back to empty. Portal settings and your superadmin account are kept. This cannot be undone.</p>
          <button type="button" className="delete-local danger-reset" onClick={resetAll} disabled={resetting}>{resetting ? "Resetting…" : "Reset all data & start empty"}</button>
        </div>
      )}
    </div>
  );
}
