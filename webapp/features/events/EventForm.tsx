import { FormEvent, useState } from "react";
import type { EventItem } from "../../lib/data/types";
import { saveEvent } from "../../lib/data/firestore";
import { normalizeEmail } from "../../app/auth-policy";
import { Modal } from "../../components/Modal";

type Draft = Omit<EventItem, "id" | "createdBy" | "presenters">;

const emptyDraft: Draft = { title: "", description: "", location: "", speakerName: "", speakerEmail: "", startAt: "", endAt: "", sessionMinutes: 60 };

export function EventForm({ editing, userEmail, onClose }: { editing: EventItem | null; userEmail: string; onClose: () => void }) {
  const [draft, setDraft] = useState<Draft>(editing
    ? { title: editing.title, description: editing.description, location: editing.location, speakerName: editing.speakerName, speakerEmail: editing.speakerEmail, startAt: editing.startAt, endAt: editing.endAt, sessionMinutes: editing.sessionMinutes }
    : emptyDraft);
  const [presentersText, setPresentersText] = useState((editing?.presenters ?? []).join(", "));
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.title.trim() || !draft.startAt || !draft.endAt) { setMessage("Title, start and end are required."); return; }
    // Accept multiple emails separated by comma, semicolon, space, or newline.
    const presenters = Array.from(new Set(presentersText.split(/[\s,;]+/).map((e) => normalizeEmail(e)).filter(Boolean)));
    const record: EventItem = {
      id: editing?.id ?? Date.now(),
      title: draft.title.trim(),
      description: draft.description.trim(),
      location: draft.location.trim(),
      speakerName: draft.speakerName.trim(),
      speakerEmail: draft.speakerEmail.trim(),
      startAt: draft.startAt,
      endAt: draft.endAt,
      sessionMinutes: Number(draft.sessionMinutes) || 0,
      presenters,
    };
    try {
      await saveEvent(record, Boolean(editing), normalizeEmail(userEmail));
      onClose();
    } catch { setMessage("Could not save the event."); }
  }

  return (
    <Modal className="admin-panel" labelledBy="event-form-title" closeLabel="Close event form" onClose={onClose}>
      <span className="detail-label">EVENTS</span>
      <h2 id="event-form-title">{editing ? "Edit event" : "Add an event"}</h2>
      <form onSubmit={submit} className="admin-form">
        <label className="full">Event title<input required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
        <label className="full"><span className="field-label">Description</span><textarea rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
        <label>Starts (date &amp; time)<input type="datetime-local" required value={draft.startAt} onChange={(e) => setDraft({ ...draft, startAt: e.target.value })} /></label>
        <label>Ends (date &amp; time)<input type="datetime-local" required value={draft.endAt} onChange={(e) => setDraft({ ...draft, endAt: e.target.value })} /></label>
        <label>Location / hall<input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} /></label>
        <label>Session length (minutes)<input type="number" min="0" value={draft.sessionMinutes} onChange={(e) => setDraft({ ...draft, sessionMinutes: Number(e.target.value) })} /></label>
        <label>Speaker name<input value={draft.speakerName} onChange={(e) => setDraft({ ...draft, speakerName: e.target.value })} /></label>
        <label>Speaker email<input type="email" value={draft.speakerEmail} onChange={(e) => setDraft({ ...draft, speakerEmail: e.target.value })} /></label>
        <label className="full"><span className="field-label">QR presenters <small>Optional — one or more emails allowed to show this event&apos;s QR (comma or space separated)</small></span><textarea rows={2} value={presentersText} placeholder="volunteer1@qiu.edu.my, staff2@qiu.edu.my, staff3@qiu.edu.my" onChange={(e) => setPresentersText(e.target.value)} /></label>
        <div className="admin-form-footer full">
          {message && <p className="admin-message error" role="status">{message}</p>}
          <div className="admin-submit"><button className="save-job" type="submit">{editing ? "Save changes" : "Add event"}</button></div>
        </div>
      </form>
    </Modal>
  );
}
