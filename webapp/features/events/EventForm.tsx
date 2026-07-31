import { FormEvent, useState } from "react";
import type { EventItem, Speaker } from "../../lib/data/types";
import { eventSpecializations, eventSpeakers } from "../../lib/data/types";
import { saveEvent } from "../../lib/data/firestore";
import { normalizeEmail } from "../../app/auth-policy";
import { Modal } from "../../components/Modal";
import { ImagePreview } from "../../components/ImagePreview";
import { notify } from "../../components/toast";

const PREDEFINED_SPECS = [
  "AI & Machine Learning",
  "Cybersecurity",
  "Web Development",
  "Data Analytics",
  "Software Engineering",
  "Networking & Cloud",
  "Accounting",
  "Finance",
  "Business & Management",
  "Hospitality & Tourism",
  "Marketing",
  "Engineering",
  "Food Technology",
  "Education",
  "Psychology & HR",
  "Pharmacy & Healthcare",
  "Design & Multimedia",
  "Telecommunications",
];

type Draft = Omit<EventItem, "id" | "createdBy" | "presenters" | "speakerLinks" | "speakerName" | "speakerPhotoUrl" | "speakers" | "qrRotateSeconds" | "specialization" | "specializations"> & { specializations: string[]; customSpecialization?: string };

const emptyDraft: Draft = { title: "", description: "", location: "", startAt: "", endAt: "", sessionMinutes: 60, specializations: [] };

// Per-speaker editing shape: links are edited as one-per-line text.
type SpeakerDraft = { name: string; photoUrl: string; linksText: string };
const blankSpeaker: SpeakerDraft = { name: "", photoUrl: "", linksText: "" };

/** Minutes between two datetime-local strings (0 when invalid or non-positive). */
function minutesBetween(start: string, end: string) {
  const s = new Date(start).getTime(), e = new Date(end).getTime();
  return Number.isFinite(s) && Number.isFinite(e) && e > s ? Math.round((e - s) / 60000) : 0;
}

/** Add minutes to a datetime-local start, returned as a datetime-local string. */
function addMinutes(start: string, mins: number) {
  const s = new Date(start).getTime();
  if (!Number.isFinite(s)) return "";
  const d = new Date(s + mins * 60000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventForm({ editing, userEmail, defaultRotateSeconds, onClose }: { editing: EventItem | null; userEmail: string; defaultRotateSeconds: number; onClose: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => {
    if (!editing) return emptyDraft;
    const all = eventSpecializations(editing);
    const known = all.filter((s) => PREDEFINED_SPECS.includes(s));
    const custom = all.filter((s) => !PREDEFINED_SPECS.includes(s));
    return {
      title: editing.title, description: editing.description, location: editing.location, startAt: editing.startAt, endAt: editing.endAt, sessionMinutes: editing.sessionMinutes,
      specializations: custom.length ? [...known, "Other"] : known,
      customSpecialization: custom.join(", ") || undefined,
    };
  });
  const [speakers, setSpeakers] = useState<SpeakerDraft[]>(() => {
    const list = editing ? eventSpeakers(editing) : [];
    return list.length ? list.map((s) => ({ name: s.name, photoUrl: s.photoUrl ?? "", linksText: (s.links ?? []).join("\n") })) : [{ ...blankSpeaker }];
  });
  const [presentersText, setPresentersText] = useState((editing?.presenters ?? []).join(", "));
  const [rotateSeconds, setRotateSeconds] = useState(editing?.qrRotateSeconds ?? defaultRotateSeconds);
  const [message, setMessage] = useState("");

  const updateSpeaker = (i: number, patch: Partial<SpeakerDraft>) => setSpeakers((rows) => rows.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const speakerLinks = (text: string) => Array.from(new Set(text.split(/[\s,]+/).map((l) => l.trim()).filter(Boolean))).slice(0, 10);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.title.trim() || !draft.startAt || !draft.endAt) { setMessage("Title, start and end are required."); return; }
    if (editing && !window.confirm("Save changes to this event? Students who already checked in will see the updated details.")) return;
    const presenters = Array.from(new Set(presentersText.split(/[\s,;]+/).map((e) => normalizeEmail(e)).filter(Boolean)));
    // Build the distinct speaker list, then derive the legacy flat fields from it
    // (names joined, links flattened, first photo) so old readers still work.
    const speakerList: Speaker[] = speakers
      .map((s) => ({ name: s.name.trim(), photoUrl: s.photoUrl.trim() || undefined, links: speakerLinks(s.linksText) }))
      .filter((s) => s.name || s.photoUrl || (s.links && s.links.length))
      .map((s) => ({ name: s.name, ...(s.photoUrl ? { photoUrl: s.photoUrl } : {}), ...(s.links && s.links.length ? { links: s.links } : {}) }));
    const flatLinks = Array.from(new Set(speakerList.flatMap((s) => s.links ?? []))).slice(0, 10);
    const firstPhoto = speakerList.find((s) => s.photoUrl)?.photoUrl;
    // Resolve the checked specializations, expanding "Other" to the custom values.
    const specializations = Array.from(new Set(draft.specializations.flatMap((s) =>
      s === "Other" ? (draft.customSpecialization ?? "").split(",").map((v) => v.trim()).filter(Boolean) : [s],
    )));
    const record: EventItem = {
      id: editing?.id ?? Date.now(),
      title: draft.title.trim(),
      description: draft.description.trim(),
      location: draft.location.trim(),
      speakerName: speakerList.map((s) => s.name).filter(Boolean).join(", "),
      speakerLinks: flatLinks,
      ...(firstPhoto ? { speakerPhotoUrl: firstPhoto } : {}),
      ...(speakerList.length ? { speakers: speakerList } : {}),
      ...(specializations.length ? { specializations } : {}),
      startAt: draft.startAt,
      endAt: draft.endAt,
      sessionMinutes: minutesBetween(draft.startAt, draft.endAt),
      presenters,
      qrRotateSeconds: Math.min(600, Math.max(5, Number(rotateSeconds) || defaultRotateSeconds)),
    };
    try {
      await saveEvent(record, Boolean(editing), normalizeEmail(userEmail));
      notify(editing ? "Event updated." : "Event added.");
      onClose();
    } catch { setMessage("Could not save the event."); notify("Could not save the event.", "error"); }
  }

  return (
    <Modal className="admin-panel" labelledBy="event-form-title" closeLabel="Close event form" onClose={onClose}>
      <span className="detail-label">EVENTS</span>
      <h2 id="event-form-title">{editing ? "Edit event" : "Add an event"}</h2>
      <form onSubmit={submit} className="admin-form">
        <label className="full">Event title<input required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
        <label className="full"><span className="field-label">Description</span><textarea rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
        <fieldset className="full"><legend className="field-label">Target specializations <small>Tick all that apply — the event is recommended to students in these fields</small></legend>
          <div className="toggle-grid">
            {[...PREDEFINED_SPECS, "Other"].map((item) => {
              const on = draft.specializations.includes(item);
              return (
                <label key={item} className="toggle-row">
                  <input type="checkbox" checked={on} onChange={(e) => setDraft({ ...draft, specializations: e.target.checked ? [...draft.specializations, item] : draft.specializations.filter((s) => s !== item) })} /> {item}
                </label>
              );
            })}
          </div>
        </fieldset>
        {draft.specializations.includes("Other") && (
          <label className="full">
            <span className="field-label">Custom specialization(s) <small>Comma-separated, e.g. Graphic Design, Robotics</small></span>
            <input required value={draft.customSpecialization ?? ""} placeholder="e.g. Graphic Design, Robotics" onChange={(e) => setDraft({ ...draft, customSpecialization: e.target.value })} />
          </label>
        )}
        <label>Starts (date &amp; time)<input type="datetime-local" required value={draft.startAt} onChange={(e) => setDraft({ ...draft, startAt: e.target.value })} /></label>
        <label>Ends (date &amp; time)<input type="datetime-local" required value={draft.endAt} onChange={(e) => setDraft({ ...draft, endAt: e.target.value })} /></label>
        <label>Location / hall<input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} /></label>
        <label>Session length (minutes) <small className="field-label">auto from start &amp; end — edit to move the end time</small><input type="number" min="0" value={minutesBetween(draft.startAt, draft.endAt)} disabled={!draft.startAt} onChange={(e) => setDraft({ ...draft, endAt: addMinutes(draft.startAt, Math.max(0, Number(e.target.value) || 0)) })} /></label>
        <label>QR rotate (seconds)<input type="number" min="5" max="600" value={rotateSeconds || ""} onChange={(e) => setRotateSeconds(Number(e.target.value))} /><small className="field-label">How often the attendance QR changes. Default {defaultRotateSeconds}s.</small></label>
        <fieldset className="full speaker-editor"><legend className="field-label">Speakers / Hosts <small>Add each speaker with their own photo &amp; links</small></legend>
          {speakers.map((sp, i) => (
            <div className="speaker-row" key={i}>
              <div className="speaker-row-head"><b>Speaker {i + 1}</b>{speakers.length > 1 && <button type="button" className="delete-local" onClick={() => setSpeakers(speakers.filter((_, j) => j !== i))}>Remove</button>}</div>
              <label>Name<input value={sp.name} placeholder="e.g. Jane Doe" onChange={(e) => updateSpeaker(i, { name: e.target.value })} /></label>
              <label>Photo URL <small className="field-label">Optional — paste a headshot image link</small><input type="url" value={sp.photoUrl} placeholder="https://…/photo.jpg" onChange={(e) => updateSpeaker(i, { photoUrl: e.target.value })} /></label>
              <ImagePreview url={sp.photoUrl} label="Photo preview" />
              <label><span className="field-label">Links <small>Optional — LinkedIn / portfolio, one per line</small></span><textarea rows={2} value={sp.linksText} placeholder={"https://linkedin.com/in/speaker\nhttps://speaker.dev"} onChange={(e) => updateSpeaker(i, { linksText: e.target.value })} /></label>
            </div>
          ))}
          <button type="button" className="admin-button self-start" onClick={() => setSpeakers([...speakers, { ...blankSpeaker }])}>＋ Add speaker</button>
        </fieldset>
        <label className="full"><span className="field-label">QR presenters <small>Optional — one or more emails allowed to show this event&apos;s QR (comma or space separated)</small></span><textarea rows={2} value={presentersText} placeholder="volunteer1@qiu.edu.my, staff2@qiu.edu.my, staff3@qiu.edu.my" onChange={(e) => setPresentersText(e.target.value)} /></label>
        <div className="admin-form-footer full">
          {message && <p className="admin-message error" role="status">{message}</p>}
          <div className="admin-submit"><button className="save-job" type="submit">{editing ? "Save changes" : "Add event"}</button></div>
        </div>
      </form>
    </Modal>
  );
}
