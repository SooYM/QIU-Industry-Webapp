import type { UserRole } from "../app/auth-policy";
import { Modal } from "../components/Modal";

type Section = { heading: string; points: string[] };

const GUIDES: Record<"student" | "employer" | "admin", { title: string; intro: string; sections: Section[] }> = {
  student: {
    title: "Welcome to QIU Industry Day 2026",
    intro: "Here's a quick tour of everything you can do. You can reopen this guide any time from the ? button in the top bar.",
    sections: [
      { heading: "1 · Add your resume first", points: [
        "Go to the My Resume tab.",
        "Paste a shareable link to your resume — Google Drive, OneDrive or Dropbox — and set its sharing to “Anyone with the link”. PDF is preferred.",
        "You'll need a resume on file before you can apply, so it's best to do this first.",
      ] },
      { heading: "2 · Browse vacancies matched to your course", points: [
        "The Vacancies tab shows every opening. Roles that fit your course carry a 🌟 badge and appear first.",
        "Switch “Course recommendation” to “Recommended for my course” to see only those, or use the filters (company, specialization, salary) to narrow things down.",
        "Tap any card to read the full job scope, requirements, salary and — if provided — the company's intro video.",
      ] },
      { heading: "3 · Apply (and change your mind freely)", points: [
        "Inside a job, press “Apply to this vacancy”. Your application is saved to the History tab.",
        "If you change your mind, you can withdraw the application from History or from the job itself — no problem at all.",
      ] },
      { heading: "4 · Ask about a specific job", points: [
        "Each job has an “Ask about this job” assistant near the Apply button.",
        "It answers only from that listing's details — great for quick questions about scope, requirements or salary.",
      ] },
      { heading: "5 · Attend Industry Day sessions", points: [
        "The Events tab lists live and upcoming sessions with their speakers.",
        "At the venue, scan the QR shown on the hall screen to CHECK IN. Scan again at the end to CHECK OUT.",
        "CCA credit needs enough time between the two scans, so please stay for the session and remember to check out before you leave.",
      ] },
    ],
  },
  employer: {
    title: "Welcome — your Employer Dashboard",
    intro: "Post roles for your company, review candidates, and see what students are asking. Reopen this guide any time from the ? button.",
    sections: [
      { heading: "1 · Post a vacancy", points: [
        "Open the Employer dashboard and go to the Vacancies tab, then fill in the role details.",
        "Your company name is filled in automatically from your account, so you can leave that part to us.",
        "Every new listing (and any later edit) is sent to an admin for a quick approval before students can see it.",
      ] },
      { heading: "2 · Review candidates", points: [
        "Resumes tab: open the resume links students have submitted.",
        "Activity tab: see which students applied to your roles.",
      ] },
      { heading: "3 · Questions about your company", points: [
        "Chats tab shows questions students asked the assistant about your company.",
        "These are shown anonymously — you'll see the questions, not who asked them.",
      ] },
    ],
  },
  admin: {
    title: "Welcome — Admin overview",
    intro: "You manage vacancies and events, approve employer posts, and oversee student activity. Reopen this guide any time from the ? button.",
    sections: [
      { heading: "1 · Vacancies & approvals", points: [
        "Admin dashboard → Vacancies to add, edit or delete any listing.",
        "The Approvals tab holds employer submissions waiting for review — approve or reject each one, or use “Approve all”.",
      ] },
      { heading: "2 · Events & attendance", points: [
        "Events tab → “Add event” to set the date & time (calendar + clock), location and speaker.",
        "Use “▶ Present QR” on the projector — the code rotates every 30 seconds so a screenshot can't be reused.",
        "You can assign QR presenters (their emails) so a volunteer can run just that one event's QR.",
        "Open “Attendance” on any event to review who attended and export the list to Excel.",
      ] },
      { heading: "3 · People & oversight", points: [
        "Access tab: assign roles, and approve non-QIU employer accounts (and set which company they represent).",
        "Activity & Chats tabs list student applications and assistant questions, grouped by student — click a student to expand their entries.",
      ] },
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
