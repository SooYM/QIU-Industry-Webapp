import { Modal } from "../../components/Modal";
import type { DashboardActivity } from "./AdminSummary";

/** Pop-out for the "Students active" tile: the distinct students behind the
 *  number, each with how many actions they took and their most recent one. */
export function DashboardStudentsModal({ title, entries, onClose }: {
  title: string;
  entries: DashboardActivity[];
  onClose: () => void;
}) {
  const byStudent = new Map<string, { name: string; count: number; last: Date | null }>();
  for (const entry of entries) {
    const key = entry.studentUid || entry.actor;
    if (!key) continue;
    const current = byStudent.get(key) ?? { name: entry.actor || "Student", count: 0, last: null };
    current.count += 1;
    if (entry.date && (!current.last || entry.date > current.last)) current.last = entry.date;
    byStudent.set(key, current);
  }
  const rows = [...byStudent.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return (
    <Modal className="admin-panel dashboard-activity-list" labelledBy="dash-students-title" closeLabel="Close students list" onClose={onClose}>
      <span className="detail-label">STUDENTS</span>
      <h2 id="dash-students-title">{title}</h2>
      <p className="admin-intro">{rows.length} distinct student{rows.length === 1 ? "" : "s"} with activity in this scope.</p>
      {rows.length ? (
        <div className="local-job-list">
          {rows.map((row, i) => (
            <div className="local-job" key={i}>
              <span><b>{row.name}</b><small>{row.count} action{row.count === 1 ? "" : "s"}{row.last ? ` · last ${row.last.toLocaleDateString(undefined, { day: "numeric", month: "short" })}` : ""}</small></span>
            </div>
          ))}
        </div>
      ) : <div className="dashboard-empty"><strong>No active students</strong><p>No student activity in the current scope.</p></div>}
    </Modal>
  );
}
