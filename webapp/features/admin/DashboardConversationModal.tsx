import { Modal } from "../../components/Modal";
import type { DashboardActivity } from "./AdminSummary";

function formatWhen(date: Date | null) {
  return date?.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) ?? "Date unavailable";
}

export function DashboardConversationModal({ activity, onClose }: { activity: DashboardActivity; onClose: () => void }) {
  return (
    <Modal className="dashboard-conversation" labelledBy="dashboard-conversation-title" closeLabel="Close conversation" onClose={onClose}>
      <header className="conversation-head">
        <span className="detail-label">ASSISTANT CONVERSATION</span>
        <h2 id="dashboard-conversation-title">Question about {activity.company || "the portal"}</h2>
        <p>{activity.actor} · {formatWhen(activity.date)}</p>
      </header>
      <div className="conversation-thread">
        <section className="conversation-turn question"><span>Question</span><p>{activity.subject}</p></section>
        <section className="conversation-turn answer"><span>Assistant answer</span><p>{activity.answer || "No recorded answer is available for this question."}</p></section>
      </div>
    </Modal>
  );
}
