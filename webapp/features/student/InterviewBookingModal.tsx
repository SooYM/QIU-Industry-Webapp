import { useEffect, useState } from "react";
import type { InterviewBookingStudent, InterviewSlot, SessionType } from "../../lib/data/types";
import {
  bookInterviewSlot, cancelInterviewBooking, subscribeInterviewSlots, subscribeMyInterviewBookings,
} from "../../lib/data/firestore";
import { Modal } from "../../components/Modal";
import { offerLabel } from "../admin/MockInterviews";

/** Two slots on the same day clash when neither one finishes before the other starts. */
function overlaps(a: InterviewSlot, b: InterviewSlot): boolean {
  return a.startTime < b.endTime && b.startTime < a.endTime;
}

export function InterviewBookingModal({
  companyName,
  studentUid,
  studentName,
  studentEmail,
  studentCourse,
  studentEmployeeId,
  onClose,
}: {
  companyName?: string;
  studentUid: string;
  studentName: string;
  studentEmail: string;
  studentCourse?: string;
  studentEmployeeId?: string;
  onClose: () => void;
}) {
  const [slots, setSlots] = useState<InterviewSlot[]>([]);
  const [myBookings, setMyBookings] = useState<InterviewSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  // Which slot is mid-booking, and the kind of session picked for it.
  const [choosingSlot, setChoosingSlot] = useState<InterviewSlot | null>(null);
  const [chosenType, setChosenType] = useState<SessionType>("interview");

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    return subscribeInterviewSlots((data) => {
      // A slot whose day has passed can no longer be booked, so don't offer it.
      setSlots(data.filter((slot) => slot.date >= today));
      setLoading(false);
    }, companyName);
  }, [companyName]);

  // Every slot this student already holds, across all companies — needed to stop
  // them booking two interviews that run at the same time.
  useEffect(() => subscribeMyInterviewBookings(studentUid, setMyBookings), [studentUid]);

  const handleBook = async (slot: InterviewSlot, sessionType: SessionType) => {
    setError("");
    setSuccess("");

    // Firestore rules can enforce a slot's own capacity but cannot see across
    // documents, so the clash check has to happen here.
    const clash = myBookings.find((b) => b.id !== slot.id && b.date === slot.date && overlaps(b, slot));
    if (clash) {
      setError(`That clashes with your ${clash.startTime}–${clash.endTime} interview with ${clash.companyName}. Cancel that one first.`);
      return;
    }

    try {
      const studentData: InterviewBookingStudent = {
        studentUid,
        studentName,
        studentEmail,
        course: studentCourse,
        employeeId: studentEmployeeId,
        sessionType,
      };
      await bookInterviewSlot(slot.id, studentData);
      setChoosingSlot(null);
      setSuccess(`Booked a ${sessionType === "consultancy" ? "consultancy" : "mock interview"} with ${slot.companyName}, ${slot.date} at ${slot.startTime}.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to book this mock interview.");
    }
  };

  const handleCancel = async (slotId: string) => {
    setError("");
    setSuccess("");
    try {
      await cancelInterviewBooking(slotId, studentUid);
      setSuccess("Your booking has been cancelled.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to cancel the booking.");
    }
  };

  return (
    <Modal className="job-detail" labelledBy="interview-booking-title" closeLabel="Close mock interview booking" onClose={onClose}>
      <div className="detail-header">
        <div>
          <h2 id="interview-booking-title">Book a mock interview or consultancy</h2>
          <p>{companyName ? `Available slots for ${companyName}` : "Browse and book company sessions"}</p>
        </div>
      </div>

      {error && <div className="p-3 mb-3 text-sm ui-note-danger">{error}</div>}
      {success && <div className="p-3 mb-3 text-sm ui-note-success">{success}</div>}

      {loading ? (
        <p className="text-center py-6 ui-muted">Loading sessions…</p>
      ) : slots.length === 0 ? (
        <div className="py-8 text-center ui-muted">
          <p>No sessions are currently open for {companyName ?? "this company"}.</p>
          <p className="text-xs mt-1 ui-muted">Please check back later, or contact the employer directly.</p>
        </div>
      ) : (
        <div className="space-y-3 my-4 max-h-[60dvh] overflow-y-auto pr-1">
          {slots.map((slot) => {
            const bookedCount = slot.bookedStudents?.length ?? 0;
            const isFull = bookedCount >= slot.maxBookings;
            const isMyBooking = slot.bookedStudents?.some((b) => b.studentUid === studentUid);
            const clash = !isMyBooking && myBookings.some((b) => b.id !== slot.id && b.date === slot.date && overlaps(b, slot));

            return (
              <div key={slot.id} className={`p-4 flex flex-wrap items-center justify-between gap-3 ui-card${isMyBooking ? " ui-card-selected" : ""}`}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold ui-strong">{slot.companyName}</span>
                    <span className="text-xs px-2 py-0.5 rounded tone-neutral font-medium">{slot.date}</span>
                  </div>
                  <div className="text-sm ui-muted mt-1">
                    🕒 {slot.startTime}–{slot.endTime}{slot.location ? ` · 📍 ${slot.location}` : ""}
                  </div>
                  <div className="text-xs ui-muted mt-1">
                    {offerLabel(slot.offers)} · {bookedCount} / {slot.maxBookings} booked
                    {clash && " · clashes with another booking"}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 justify-end">
                  {isMyBooking ? (
                    <button
                      type="button"
                      onClick={() => handleCancel(slot.id)}
                      className="text-xs font-semibold ui-btn ui-btn-danger"
                    >
                      Cancel booking
                    </button>
                  ) : choosingSlot?.id === slot.id ? (
                    <>
                      <label className="sr-only" htmlFor={`type-${slot.id}`}>Session type</label>
                      <select
                        id={`type-${slot.id}`}
                        className="ui-field ui-field-inline text-xs"
                        value={chosenType}
                        onChange={(e) => setChosenType(e.target.value as SessionType)}
                      >
                        <option value="interview">Mock interview</option>
                        <option value="consultancy">Consultancy</option>
                      </select>
                      <button type="button" className="text-xs font-semibold ui-btn ui-btn-primary" onClick={() => handleBook(slot, chosenType)}>
                        Confirm
                      </button>
                      <button type="button" className="text-xs font-semibold ui-btn ui-btn-quiet" onClick={() => setChoosingSlot(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={isFull || clash}
                      onClick={() => {
                        // Only ask when the employer actually offers both; otherwise
                        // the choice is already made and a prompt is friction.
                        if (slot.offers === "both") { setChosenType("interview"); setChoosingSlot(slot); return; }
                        handleBook(slot, slot.offers === "consultancy" ? "consultancy" : "interview");
                      }}
                      className="text-xs font-semibold ui-btn ui-btn-primary"
                    >
                      {isFull ? "Fully booked" : clash ? "Time clash" : "Book slot"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
