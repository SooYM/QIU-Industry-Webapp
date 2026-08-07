import { Modal } from "../../components/Modal";
import type { DashboardActivity, DashboardActivityType } from "./AdminSummary";

const LABELS: Record<DashboardActivityType, string> = {
  application: "Application", view: "Vacancy interest", attendance: "Event check-in", question: "Assistant question",
};

function formatWhen(date: Date | null) {
  return date?.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) ?? "Date unavailable";
}

/**
 * A pop-out that lists every record behind a bento tile. Clicking a row opens
 * that specific item (vacancy, event or conversation) and closes this list.
 */
export function DashboardActivityListModal({ title, entries, onOpen, onClose }: {
  title: string;
  entries: DashboardActivity[];
  onOpen: (entry: DashboardActivity) => void;
  onClose: () => void;
}) {
  const sorted = [...entries].sort((a, b) => (b.date?.getTime() ?? -1) - (a.date?.getTime() ?? -1));
  return (
    <Modal className="admin-panel dashboard-activity-list" labelledBy="dash-activity-title" closeLabel="Close activity list" onClose={onClose}>
      <span className="detail-label">ACTIVITY</span>
      <h2 id="dash-activity-title">{title}</h2>
      <p className="admin-intro">{sorted.length} record{sorted.length === 1 ? "" : "s"}{sorted.length ? " — click any row to open it." : "."}</p>
      {sorted.length ? (
        <div className="activity-table">
          <div className="activity-list-head" aria-hidden="true"><span>Type / subject</span><span>Context</span><span>Date</span><span>Action</span></div>
          <ol className="activity-list">
            {sorted.map((entry) => (
              <li key={`${entry.type}-${entry.id}`}>
                <button className="activity-row" type="button" onClick={() => { onOpen(entry); onClose(); }} aria-label={`Open ${LABELS[entry.type].toLowerCase()}: ${entry.subject}`}>
                  <span className="activity-primary"><span className={`activity-kind ${entry.type}`}>{LABELS[entry.type]}</span><strong>{entry.subject}</strong><small>{entry.actor}</small></span>
                  <span className="activity-context"><span className="sr-only">Context: </span>{entry.context}</span>
                  <time dateTime={entry.date?.toISOString()}><span className="sr-only">Date: </span>{formatWhen(entry.date)}</time>
                  <span className="activity-open" aria-hidden="true">Open</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      ) : <div className="dashboard-empty"><strong>Nothing here yet</strong><p>No records of this type in the current scope.</p></div>}
    </Modal>
  );
}
