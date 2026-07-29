import { useEffect, useState } from "react";
import type { Attendance, EventItem } from "../../lib/data/types";
import { subscribeAttendance } from "../../lib/data/firestore";
import { Modal } from "../../components/Modal";

function fmt(ts: unknown): string {
  if (ts && typeof ts === "object" && "toDate" in ts) {
    return (ts as { toDate: () => Date }).toDate().toLocaleString();
  }
  return "";
}

function downloadCsv(event: EventItem, rows: Attendance[]) {
  const header = ["Event", "Student", "Email", "Check-in", "Check-out", "Duration (min)", "CCA eligible"];
  const body = rows.map((r) => [event.title, r.studentName, r.studentEmail, fmt(r.checkInAt), fmt(r.checkOutAt), r.durationMinutes ?? "", r.caEligible ? "Yes" : "No"]);
  const csv = [header, ...body]
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  // Prepend BOM so Excel opens UTF-8 correctly.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `attendance_${event.title.replace(/[^\w]+/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function EventAttendance({ event, onClose }: { event: EventItem; onClose: () => void }) {
  const [rows, setRows] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => subscribeAttendance((all) => { setRows(all.filter((r) => r.eventId === event.id)); setLoading(false); }), [event.id]);

  const sorted = [...rows].sort((a, b) => (b.checkInMs ?? 0) - (a.checkInMs ?? 0));

  return (
    <Modal className="admin-panel" labelledBy="attendance-title" closeLabel="Close attendance" onClose={onClose}>
      <span className="detail-label">ATTENDANCE</span>
      <h2 id="attendance-title">{event.title}</h2>
      <div className="local-jobs-head">
        <div><span className="detail-label">RECORDS</span><h3>{sorted.length} attendee{sorted.length === 1 ? "" : "s"}</h3></div>
        <button type="button" className="admin-button" onClick={() => downloadCsv(event, sorted)} disabled={!sorted.length}>⬇ Export to Excel (CSV)</button>
      </div>
      {loading ? <p className="role-manager-state" role="status">Loading…</p>
        : sorted.length ? (
          <div className="local-job-list">
            {sorted.map((r) => (
              <div className="local-job" key={r.id}>
                <span>
                  <b>{r.studentName || r.studentEmail} {r.caEligible ? <span className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold tone-success">CCA eligible</span> : r.checkOutMs ? <span className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold tone-danger">Below threshold</span> : <span className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold tone-neutral">Checked in</span>}</b>
                  <small>{r.studentEmail} · {r.durationMinutes != null ? `${r.durationMinutes} min` : "in progress"}</small>
                </span>
              </div>
            ))}
          </div>
        ) : <div className="admin-jobs-empty"><strong>No attendance yet</strong><p>Records appear as students scan the QR.</p></div>}
    </Modal>
  );
}
