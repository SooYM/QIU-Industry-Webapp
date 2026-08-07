import { useEffect, useState, type FormEvent } from "react";
import type { InterviewBooking, InterviewSlot, Resume, SessionType } from "../../lib/data/types";
import { hasGeneratedCV } from "../../lib/data/types";
import {
  deleteInterviewSlot, saveInterviewSlot, subscribeInterviewBookings, subscribeInterviewSlots,
  subscribeResumes,
} from "../../lib/data/firestore";

/** How a slot's offer reads on screen. Older slots carry no value = interview. */
export function offerLabel(offers: InterviewSlot["offers"]): string {
  return offers === "consultancy" ? "Consultancy"
    : offers === "both" ? "Interview or consultancy"
    : "Mock interview";
}

/** Two slots on one day collide unless one finishes before the other starts. */
function overlaps(a: { startTime: string; endTime: string }, b: { startTime: string; endTime: string }) {
  return a.startTime < b.endTime && b.startTime < a.endTime;
}

function useCompanySlots(companyName: string) {
  const [slots, setSlots] = useState<InterviewSlot[]>([]);
  useEffect(() => subscribeInterviewSlots(setSlots, companyName), [companyName]);
  return slots;
}

/** Employer tool: open a new mock interview slot. */
export function MockInterviewForm({ companyName, userEmail }: { companyName: string; userEmail: string }) {
  const slots = useCompanySlots(companyName);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("09:30");
  const [location, setLocation] = useState("");
  const [maxBookings, setMaxBookings] = useState(1);
  const [offers, setOffers] = useState<SessionType | "both">("both");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!date || !startTime || !endTime) {
      setError("Please fill in the date and both times.");
      return;
    }
    if (endTime <= startTime) {
      setError("The end time must be after the start time.");
      return;
    }

    // Checking the id alone only catches an identical start time, so a 09:30
    // slot and a 09:31 slot both got created and a student could be booked into
    // two interviews running at once. Compare the whole time range instead.
    const clash = slots.find((slot) => slot.date === date && overlaps(slot, { startTime, endTime }));
    if (clash) {
      setError(`That overlaps your existing ${clash.startTime}–${clash.endTime} slot on ${clash.date}. Choose a time after it, or delete that slot first.`);
      return;
    }

    const slotId = `${companyName.toLowerCase().replace(/\s+/g, "_")}_${date}_${startTime.replace(":", "")}`;
    try {
      await saveInterviewSlot({
        id: slotId,
        companyName,
        date,
        startTime,
        endTime,
        location,
        maxBookings,
        offers,
        bookedStudents: [],
        createdBy: userEmail,
      });
      setSuccess(`Slot opened: ${date}, ${startTime}–${endTime}.`);
      setDate("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to open the slot.");
    }
  };

  return (
    <section className="local-jobs" aria-labelledby="add-mock-interview-title">
      <div className="local-jobs-head">
        <div>
          <span className="detail-label">MOCK INTERVIEWS</span>
          <h3 id="add-mock-interview-title">Add a mock interview session</h3>
        </div>
      </div>
      <p className="admin-intro">Open a time slot students can book on event day. Slots cannot overlap each other.</p>

      {error && <div className="p-3 text-sm ui-note-danger">{error}</div>}
      {success && <div className="p-3 text-sm ui-note-success">{success}</div>}

      <form onSubmit={handleCreate} className="admin-form">
        <label>
          <span className="field-label">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          <span className="field-label">Location / mode</span>
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Hall A — Booth 12" />
        </label>
        <label>
          <span className="field-label">Start time</span>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
        </label>
        <label>
          <span className="field-label">End time</span>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
        </label>
        <label>
          <span className="field-label">Session offered</span>
          <select value={offers} onChange={(e) => setOffers(e.target.value as SessionType | "both")}>
            <option value="both">Interview or consultancy — student chooses</option>
            <option value="interview">Mock interview only</option>
            <option value="consultancy">Consultancy only</option>
          </select>
        </label>
        <label>
          <span className="field-label">Capacity <small>Students per slot</small></span>
          <input type="number" min={1} max={20} value={maxBookings} onChange={(e) => setMaxBookings(Number(e.target.value))} />
        </label>
        <div className="admin-form-footer full">
          <div className="admin-submit">
            <button type="submit" className="admin-button">+ Open mock interview slot</button>
          </div>
        </div>
      </form>
    </section>
  );
}

/** Employer tool: review open slots and who has booked them. */
export function MockInterviewList({ companyName }: { companyName: string }) {
  const slots = useCompanySlots(companyName);
  const [bookings, setBookings] = useState<InterviewBooking[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [message, setMessage] = useState("");

  // Student contact details live in their own staff-only collection — the slot
  // itself is readable by every student, so it carries uids and nothing else.
  useEffect(() => subscribeInterviewBookings(companyName, setBookings), [companyName]);
  // So an interviewer can read the candidate's CV before the session starts.
  useEffect(() => subscribeResumes(setResumes), []);

  const bookingBySeat = new Map(bookings.map((b) => [b.id, b]));
  const resumeByUid = new Map(resumes.map((r) => [r.studentUid, r]));
  const totalBooked = slots.reduce((sum, slot) => sum + (slot.bookedStudents?.length ?? 0), 0);

  const handleDelete = async (slot: InterviewSlot) => {
    const booked = slot.bookedStudents?.length ?? 0;
    const warning = booked
      ? `Delete the ${slot.startTime}–${slot.endTime} slot on ${slot.date}? ${booked} student${booked === 1 ? "" : "s"} booked it and will lose the booking.`
      : `Delete the ${slot.startTime}–${slot.endTime} slot on ${slot.date}?`;
    if (!window.confirm(warning)) return;
    try {
      await deleteInterviewSlot(slot.id);
      setMessage("Slot removed.");
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Failed to delete the slot.");
    }
  };

  return (
    <section className="local-jobs" aria-labelledby="manage-mock-interview-title">
      <div className="local-jobs-head">
        <div>
          <span className="detail-label">MOCK INTERVIEWS</span>
          <h3 id="manage-mock-interview-title">Manage mock interview sessions</h3>
        </div>
        <div className="flex items-center gap-2">
          <strong>{slots.length}</strong>
          <span className="text-xs ui-muted">slot{slots.length === 1 ? "" : "s"} · {totalBooked} booked</span>
        </div>
      </div>

      {message && <div className="p-3 text-sm ui-note-success">{message}</div>}

      {slots.length === 0 ? (
        <div className="admin-jobs-empty">
          <strong>No mock interview slots yet</strong>
          <p>Use &ldquo;Add mock interview&rdquo; to open a time students can book.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {slots.map((slot) => {
            const seats = slot.bookedStudents ?? [];
            return (
              <div key={slot.id} className="p-4 ui-card space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm ui-strong">{slot.date}</span>
                    <span className="text-xs px-2 py-0.5 rounded tone-neutral font-medium">{slot.startTime}–{slot.endTime}</span>
                    <span className="text-xs px-2 py-0.5 rounded tone-accent font-medium">{offerLabel(slot.offers)}</span>
                    {slot.location && <span className="text-xs ui-muted">📍 {slot.location}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded font-bold ${seats.length >= slot.maxBookings ? "tone-success" : "tone-neutral"}`}>
                      {seats.length} / {slot.maxBookings} booked
                    </span>
                  </div>
                  <button type="button" onClick={() => handleDelete(slot)} className="text-xs font-semibold rounded-lg ui-btn ui-btn-danger">
                    Delete slot
                  </button>
                </div>

                {seats.length > 0 ? (
                  <ul className="space-y-1.5 pl-3 border-l-2 border-token">
                    {seats.map((seat) => {
                      const who = bookingBySeat.get(`${slot.id}_${seat.studentUid}`);
                      const resume = resumeByUid.get(seat.studentUid);
                      const booked = seat.sessionType ?? who?.sessionType;
                      return (
                        <li key={seat.studentUid} className="text-xs ui-strong flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{who?.studentName ?? "Booked student"}</span>
                          {who?.studentEmail && <span className="ui-muted min-w-0 break-all">{who.studentEmail}</span>}
                          {who?.course && <span className="px-1.5 py-0.5 rounded tone-accent text-[10px] font-medium">{who.course}</span>}
                          {who?.employeeId && <span className="ui-muted">ID {who.employeeId}</span>}
                          {booked && <span className="px-1.5 py-0.5 rounded tone-neutral text-[10px] font-medium">{booked === "consultancy" ? "Consultancy" : "Interview"}</span>}
                          {resume?.fileUrl
                            ? <a href={resume.fileUrl} target="_blank" rel="noreferrer" className="font-semibold">📄 Resume ↗</a>
                            : hasGeneratedCV(resume?.profile)
                              ? <span className="ui-muted">📄 CV in portal — see Applicants</span>
                              : <span className="ui-muted italic">No resume submitted</span>}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-xs ui-muted italic">No bookings yet.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
