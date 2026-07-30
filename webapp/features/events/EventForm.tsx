import { FormEvent, useState } from "react";
import type { EventItem } from "../../lib/data/types";
import { saveEvent } from "../../lib/data/firestore";
import { normalizeEmail } from "../../app/auth-policy";
import { Modal } from "../../components/Modal";

type Draft = Omit<EventItem, "id" | "createdBy" | "presenters" | "speakerLinks" | "qrRotateSeconds">;

const emptyDraft: Draft = { title: "", description: "", location: "", speakerName: "", startAt: "", endAt: "", sessionMinutes: 60 };

export function EventForm({ editing, userEmail, defaultRotateSeconds, onClose }: { editing: EventItem | null; userEmail: string; defaultRotateSeconds: number; onClose: () => void }) {
  const [draft, setDraft] = useState<Draft>(editing
    ? { title: editing.title, description: editing.description, location: editing.location, speakerName: editing.speakerName, startAt: editing.startAt, endAt: editing.endAt, sessionMinutes: editing.sessionMinutes }
    : emptyDraft);
  const [presentersText, setPresentersText] = useState((editing?.presenters ?? []).join(", "));
  const [speakerLinksText, setSpeakerLinksText] = useState((editing?.speakerLinks ?? []).join("\n"));
  const [speakerPhoto, setSpeakerPhoto] = useState(editing?.speakerPhotoUrl ?? "");
  const [rotateSeconds, setRotateSeconds] = useState(editing?.qrRotateSeconds ?? defaultRotateSeconds);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.title.trim() || !draft.startAt || !draft.endAt) { setMessage("Title, start and end are required."); return; }
    if (editing && !window.confirm("Save changes to this event? Students who already checked in will see the updated details.")) return;
    const presenters = Array.from(new Set(presentersText.split(/[\s,;]+/).map((e) => normalizeEmail(e)).filter(Boolean)));
    const speakerLinks = Array.from(new Set(speakerLinksText.split(/[\s,]+/).map((l) => l.trim()).filter(Boolean))).slice(0, 10);
    const record: EventItem = {
      id: editing?.id ?? Date.now(),
      title: draft.title.trim(),
      description: draft.description.trim(),
      location: draft.location.trim(),
      speakerName: draft.speakerName.trim(),
      speakerLinks,
      ...(speakerPhoto.trim() ? { speakerPhotoUrl: speakerPhoto.trim() } : {}),
      startAt: draft.startAt,
      endAt: draft.endAt,
      sessionMinutes: Number(draft.sessionMinutes) || 0,
      presenters,
      qrRotateSeconds: Math.min(600, Math.max(5, Number(rotateSeconds) || defaultRotateSeconds)),
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
        <label>QR rotate (seconds)<input type="number" min="5" max="600" value={rotateSeconds} onChange={(e) => setRotateSeconds(Number(e.target.value))} /><small className="field-label">How often the attendance QR changes. Default {defaultRotateSeconds}s.</small></label>
        <label className="full">Speaker photo URL <small className="field-label">Optional — paste a headshot image link (e.g. from their LinkedIn photo)</small><input type="url" value={speakerPhoto} placeholder="https://…/speaker.jpg" onChange={(e) => setSpeakerPhoto(e.target.value)} /></label>
        <label className="full"><span className="field-label">Speaker links <small>Optional — LinkedIn / portfolio URLs, one per line</small></span><textarea rows={2} value={speakerLinksText} placeholder={"https://linkedin.com/in/speaker\nhttps://speaker.dev"} onChange={(e) => setSpeakerLinksText(e.target.value)} /></label>
        <label className="full"><span className="field-label">QR presenters <small>Optional — one or more emails allowed to show this event&apos;s QR (comma or space separated)</small></span><textarea rows={2} value={presentersText} placeholder="volunteer1@qiu.edu.my, staff2@qiu.edu.my, staff3@qiu.edu.my" onChange={(e) => setPresentersText(e.target.value)} /></label>
        <div className="admin-form-footer full">
          {message && <p className="admin-message error" role="status">{message}</p>}
          <div className="admin-submit"><button className="save-job" type="submit">{editing ? "Save changes" : "Add event"}</button></div>
        </div>
      </form>
    </Modal>
  );
}
