import type { UserRole } from "../app/auth-policy";
import { Modal } from "../components/Modal";

type Section = { heading: string; points: string[] };

const GUIDES: Record<"student" | "employer" | "admin", { title: string; intro: string; sections: Section[] }> = {
  student: {
    title: "Welcome — here's how to use the portal",
    intro: "Find opportunities matched to your course, apply, and check in to Industry Day sessions.",
    sections: [
      { heading: "🎯 Vacancies", points: ["Jobs matching your course are badged 🌟 and sorted first.", "Use “Recommended for my course” to filter, or browse all.", "Open any job to see scope, requirements, salary and the company video."] },
      { heading: "📄 My Resume", points: ["Add a shareable resume link (Google Drive / OneDrive — set to “anyone with the link”).", "You must submit a resume before you can apply to a job."] },
      { heading: "✅ Applying & History", points: ["Open a job → Apply. It’s saved under History.", "Changed your mind? Withdraw an application from History."] },
      { heading: "✦ Ask about this job", points: ["Inside a job, use “Ask about this job” — it answers only from that listing."] },
      { heading: "📅 Events & attendance", points: ["Open Events to see live/upcoming sessions.", "At the hall, scan the QR on screen to CHECK IN, and again at the end to CHECK OUT.", "CCA credit needs enough time between check-in and check-out — don’t leave early."] },
    ],
  },
  employer: {
    title: "Welcome, employer — here's your dashboard",
    intro: "Post roles under your company, review candidates, and see questions about your company.",
    sections: [
      { heading: "➕ Post a vacancy", points: ["Employer dashboard → Vacancies. Your company is set by the admin — you don’t type it.", "New posts and edits go to the admin for approval before students see them."] },
      { heading: "📄 Resumes & applicants", points: ["Resumes tab: open student resume links.", "Activity tab: see who applied to your company’s roles."] },
      { heading: "💬 Company questions", points: ["Chats tab: questions students asked about your company — shown anonymously."] },
    ],
  },
  admin: {
    title: "Welcome, admin — full control",
    intro: "Manage vacancies and events, approve employer posts, and oversee student activity.",
    sections: [
      { heading: "🗂 Vacancies & approvals", points: ["Admin dashboard → Vacancies to add/edit/delete any listing.", "Approvals tab: approve or reject employer submissions — or “Approve all”."] },
      { heading: "📅 Events", points: ["Events tab → Add event (date, time, speaker).", "▶ Present QR on the projector — it rotates every 30s (anti-cheat).", "Assign QR presenters (emails) so a volunteer can run one event’s QR only.", "Export each event’s attendance to Excel."] },
      { heading: "👥 People & oversight", points: ["Access tab: assign roles and whitelist non-QIU employers (set their company).", "Activity & Chats tabs: student applications and assistant questions, grouped by student."] },
    ],
  },
};

export function Guide({ role, onClose }: { role: UserRole | null; onClose: () => void }) {
  const key = role === "superadmin" || role === "admin" ? "admin" : role === "employer" ? "employer" : "student";
  const guide = GUIDES[key];
  return (
    <Modal className="admin-panel guide" labelledBy="guide-title" closeLabel="Close guide" onClose={onClose}>
      <span className="detail-label">GETTING STARTED</span>
      <h2 id="guide-title">{guide.title}</h2>
      <p className="admin-intro">{guide.intro}</p>
      <div className="guide-sections">
        {guide.sections.map((s) => (
          <section key={s.heading} className="guide-section">
            <h3>{s.heading}</h3>
            <ul>{s.points.map((p, i) => <li key={i}>{p}</li>)}</ul>
          </section>
        ))}
      </div>
      <div className="admin-submit" style={{ marginTop: "1rem" }}><button className="save-job" type="button" onClick={onClose}>Got it</button></div>
    </Modal>
  );
}
