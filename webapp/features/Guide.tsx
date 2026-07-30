import type { ReactNode } from "react";
import type { UserRole } from "../app/auth-policy";
import { Modal } from "../components/Modal";

type Section = { heading: string; points: string[]; demo?: ReactNode };

/** A non-interactive preview of a real button/badge, reusing the live styles. */
function Chip({ className, children, style }: { className: string; children: ReactNode; style?: React.CSSProperties }) {
  return <span className={`guide-chip ${className}`} style={style}>{children}</span>;
}
function Demo({ label, children }: { label?: string; children: ReactNode }) {
  return <div className="guide-demo"><span className="guide-demo-label">{label ?? "Looks like"}</span><div className="guide-demo-row">{children}</div></div>;
}

const GUIDES: Record<"student" | "employer" | "admin", { title: string; intro: string; sections: Section[] }> = {
  student: {
    title: "Welcome to QIU Industry Day 2026",
    intro: "A quick tour of everything you can do. Reopen this any time from the ? button in the top bar.",
    sections: [
      {
        heading: "1 · Start at Home",
        points: [
          "The Home tab shows the companies attending Industry Day.",
          "Tap any company to see its profile, website and video.",
        ],
        demo: <Demo><Chip className="tone-accent" style={{ borderRadius: ".6rem", padding: ".5rem .9rem", fontWeight: 700 }}>Home</Chip></Demo>,
      },
      {
        heading: "2 · Build your resume",
        points: [
          "In My Resume you have two options: fill in your details (results, FYP title, skills…) to generate a clean CV, and/or paste a link to your own resume.",
          "Preview your generated CV live and Print → Save as PDF any time.",
          "You'll need at least one before you can apply, so it's best to do this early.",
        ],
        demo: <Demo><Chip className="tone-accent" style={{ borderRadius: ".6rem", padding: ".5rem .9rem", fontWeight: 700 }}>My Resume</Chip><Chip className="save-job">Save CV details</Chip></Demo>,
      },
      {
        heading: "3 · Browse vacancies matched to your course",
        points: [
          "Roles that fit your course carry this badge and appear first.",
          "Use the filters (company, specialization, salary) to narrow the list.",
          "Tap any card to read the full job scope, requirements, salary and company video.",
        ],
        demo: <Demo><Chip className="tone-success" style={{ borderRadius: ".5rem", padding: ".35rem .6rem", fontWeight: 700, fontSize: ".75rem" }}>🌟 Recommended for your course</Chip></Demo>,
      },
      {
        heading: "4 · Apply (and change your mind freely)",
        points: [
          "Inside a job, press Apply. If you have both a generated CV and a link, you choose which one to attach.",
          "Your application is saved to the History tab. Changed your mind? Withdraw it any time.",
        ],
        demo: <Demo><Chip className="enquire-main">Apply to this vacancy →</Chip><Chip className="cancel-edit">Withdraw application</Chip></Demo>,
      },
      {
        heading: "5 · Ask about a specific job",
        points: ["Each job has an assistant that answers only from that listing's details."],
        demo: <Demo><Chip className="job-assistant-toggle">✦ Ask about this job ▼</Chip></Demo>,
      },
      {
        heading: "6 · Attend Industry Day sessions",
        points: [
          "The Events tab lists live and upcoming sessions.",
          "At the venue, scan the QR on the hall screen to CHECK IN, and again at the end to CHECK OUT.",
          "CCA credit needs enough time between the two scans — please stay and remember to check out.",
        ],
        demo: <Demo><Chip className="tone-success" style={{ borderRadius: ".5rem", padding: ".35rem .6rem", fontWeight: 700, fontSize: ".75rem" }}>● Live now</Chip></Demo>,
      },
    ],
  },
  employer: {
    title: "Welcome — your Employer Dashboard",
    intro: "Post roles, review candidates, and see what students ask. Reopen this any time from the ? button.",
    sections: [
      {
        heading: "1 · Post a vacancy",
        points: [
          "Open the Employer dashboard and go to the Vacancies tab.",
          "Your company name is filled in automatically from your account, so you can leave that part to us.",
          "New listings and edits go to an admin for a quick approval before students see them.",
        ],
        demo: <Demo><Chip className="admin-button">Employer dashboard</Chip><Chip className="save-job">Add vacancy</Chip></Demo>,
      },
      {
        heading: "2 · Review candidates",
        points: ["Resumes tab: open the resume links students submitted.", "Activity tab: see who applied to your roles."],
        demo: <Demo label="Tabs"><Chip className="tone-accent" style={{ borderRadius: ".5rem", padding: ".4rem .7rem", fontWeight: 700 }}>Resumes</Chip><Chip className="text-accent" style={{ padding: ".4rem .7rem", fontWeight: 700 }}>Activity</Chip></Demo>,
      },
      {
        heading: "3 · Questions about your company",
        points: ["The Chats tab shows questions students asked about your company — anonymously (you see the question, not who asked)."],
      },
    ],
  },
  admin: {
    title: "Welcome — Admin overview",
    intro: "Manage vacancies and events, approve employer posts, and oversee activity. Reopen this any time from the ? button.",
    sections: [
      {
        heading: "1 · Vacancies & approvals",
        points: [
          "Admin dashboard → Vacancies to add, edit or delete any listing.",
          "The Approvals tab holds employer submissions — approve/reject each, or approve them all at once.",
        ],
        demo: <Demo><Chip className="admin-button">Admin dashboard</Chip><Chip className="admin-button">✓ Approve all (3)</Chip></Demo>,
      },
      {
        heading: "2 · Events & attendance",
        points: [
          "Events tab → Add event (calendar + clock), location and speaker.",
          "Use Present QR on the projector — the code rotates every 30s so a screenshot can't be reused.",
          "Assign QR presenters (emails) so a volunteer can run just that one event's QR.",
          "Open Attendance on any event to review who attended and export to Excel.",
        ],
        demo: <Demo><Chip className="admin-button">＋ Add event</Chip><Chip className="edit-local">▶ Present QR</Chip><Chip className="edit-local">Attendance</Chip><Chip className="admin-button">⬇ Export to Excel</Chip></Demo>,
      },
      {
        heading: "3 · People & oversight",
        points: [
          "Access tab: assign roles and approve non-QIU employers (set their company).",
          "Activity & Chats tabs list applications and questions grouped by student — click a student to expand.",
        ],
      },
      {
        heading: "4 · Settings (no code needed)",
        points: [
          "The Settings tab is where you change the portal without a developer.",
          "Edit the title & tagline, add the exhibitor companies for the Home page, tune the QR rotate time and CCA rules, and show/hide whole tabs.",
        ],
        demo: <Demo><Chip className="tone-accent" style={{ borderRadius: ".5rem", padding: ".4rem .7rem", fontWeight: 700 }}>Settings</Chip><Chip className="save-job">Add exhibitor</Chip></Demo>,
      },
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
            {s.demo}
          </section>
        ))}
      </div>
      <div className="admin-submit" style={{ marginTop: "1rem" }}><button className="save-job" type="button" onClick={onClose}>Got it</button></div>
    </Modal>
  );
}
