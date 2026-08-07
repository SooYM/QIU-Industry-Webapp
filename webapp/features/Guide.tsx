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
          "The Home tab shows every company attending Industry Day.",
          "Tap a company for its profile, website, corporate video and booth number.",
          "Its open vacancies are listed on the profile — ones matching your course are highlighted.",
        ],
        demo: <Demo><Chip className="tone-accent" style={{ borderRadius: ".6rem", padding: ".5rem .9rem", fontWeight: 700 }}>Home</Chip></Demo>,
      },
      {
        heading: "2 · Build your resume first",
        points: [
          "In My Resume, either fill in your details (results, FYP, skills) to generate a clean CV, or paste a link to your own.",
          "Preview it live and Print → Save as PDF whenever you like.",
          "You need one before you can apply, so do this early — employers also see it when you book a session with them.",
        ],
        demo: <Demo><Chip className="tone-accent" style={{ borderRadius: ".6rem", padding: ".5rem .9rem", fontWeight: 700 }}>My Resume</Chip><Chip className="save-job">Save CV details</Chip></Demo>,
      },
      {
        heading: "3 · Browse vacancies matched to your course",
        points: [
          "Roles that fit your course carry a badge and sort first.",
          "Filter by company, specialization, type or salary.",
          "Open any card for the full scope, requirements, salary and company video.",
        ],
        demo: <Demo><Chip className="tone-success" style={{ borderRadius: ".5rem", padding: ".35rem .6rem", fontWeight: 700, fontSize: ".75rem" }}>🌟 Recommended for your course</Chip></Demo>,
      },
      {
        heading: "4 · Apply, and change your mind freely",
        points: [
          "Apply from a vacancy and choose which resume to attach.",
          "Withdraw at any time from History — nothing is permanent.",
        ],
      },
      {
        heading: "5 · Book a mock interview or consultancy",
        points: [
          "On a company profile, choose Book mock interview or consultancy.",
          "Where the company offers both, you pick which one you want.",
          "You cannot book two sessions that overlap — the portal blocks the clash and names the one it conflicts with.",
          "Your bookings, and a Withdraw button, live in the History tab.",
        ],
        demo: <Demo><Chip className="ui-btn ui-btn-quiet">📅 Book mock interview or consultancy →</Chip></Demo>,
      },
      {
        heading: "6 · Talks: interest, check-in, questions, reviews",
        points: [
          "Mark a talk as Interested and it is added to your Google Calendar as a reminder.",
          "At the venue, scan the QR to CHECK IN, and scan again at the end to CHECK OUT.",
          "CCA credit needs enough time between the two scans — stay, and remember to check out.",
          "While a talk runs, a facilitator can open a live Q&A so you can ask questions from your seat.",
          "After it ends, students who checked in can leave a star rating and review.",
        ],
        demo: <Demo><Chip className="tone-success" style={{ borderRadius: ".5rem", padding: ".35rem .6rem", fontWeight: 700, fontSize: ".75rem" }}>● Live now</Chip><Chip className="ui-btn ui-btn-primary">☆ Mark as interested</Chip></Demo>,
      },
      {
        heading: "7 · Ask the assistant",
        points: [
          "Every company profile and vacancy has a chat box that answers only from that listing — no invented details.",
          "Ask narrow questions (\u201cwhere is it located?\u201d, \u201cwhat is the salary?\u201d) and you get a narrow answer.",
          "Questions are recorded and visible to the company and to admins, with your name — keep it professional.",
        ],
      },
    ],
  },
  employer: {
    title: "Welcome — your Company Dashboard",
    intro: "Post roles, meet students, and see what they ask. Reopen this any time from the ? button.",
    sections: [
      {
        heading: "1 · Getting access",
        points: [
          "Register with your work email and a password — no Google account needed.",
          "State the company you represent. An admin reviews and approves before you can post anything.",
          "If your profile is still empty after approval, a banner on your dashboard prompts you to complete it.",
        ],
      },
      {
        heading: "2 · Complete your company profile",
        points: [
          "Company profile tab: add your description, website, corporate video and booth number.",
          "This is what students see on the Home page — an empty profile is a blank card.",
          "Edits to an approved profile are staged for a quick admin check before going live.",
        ],
        demo: <Demo><Chip className="admin-button">Company profile</Chip></Demo>,
      },
      {
        heading: "3 · Post vacancies",
        points: [
          "Add vacancy fills in your company name automatically.",
          "New listings and edits go to an admin for approval before students see them.",
          "Manage vacancies to edit or remove anything you have posted.",
        ],
        demo: <Demo><Chip className="save-job">Add vacancy</Chip><Chip className="admin-button">Manage vacancies</Chip></Demo>,
      },
      {
        heading: "4 · Mock interviews & consultancies",
        points: [
          "Add mock interview: open a time slot, set its capacity, and choose whether it is an interview, a consultancy, or either.",
          "Slots cannot overlap each other — the portal rejects a clashing time.",
          "Manage mock interviews shows who booked each slot, with their course, ID and resume link so you can prepare.",
        ],
        demo: <Demo><Chip className="admin-button">Add mock interview</Chip><Chip className="admin-button">Manage mock interviews</Chip></Demo>,
      },
      {
        heading: "5 · See who is interested",
        points: [
          "Your summary shows applications, assistant questions, mock interview bookings and profile visits.",
          "Profile visits count each student once per browser session.",
          "Questions students ask about your company show their name — they are not anonymous.",
          "Every list exports to CSV.",
        ],
        demo: <Demo label="Tabs"><Chip className="tone-accent" style={{ borderRadius: ".5rem", padding: ".4rem .7rem", fontWeight: 700 }}>View applicants</Chip><Chip className="text-accent" style={{ padding: ".4rem .7rem", fontWeight: 700 }}>Activity</Chip><Chip className="text-accent" style={{ padding: ".4rem .7rem", fontWeight: 700 }}>Chats</Chip></Demo>,
      },
    ],
  },
  admin: {
    title: "Welcome — Admin overview",
    intro: "Approve companies, run the events, and oversee everything. Reopen this any time from the ? button.",
    sections: [
      {
        heading: "1 · Companies & approvals",
        points: [
          "Approvals holds company registrations and vacancy submissions — approve or reject each, or approve all at once.",
          "Approving a registration creates the company profile and grants that rep access in one step.",
          "The rep only supplies a name, so add the logo, video and blurb yourself in Manage companies.",
          "Import companies bulk-loads profiles from JSON; re-importing a corrected file updates rather than duplicates.",
        ],
        demo: <Demo><Chip className="admin-button">✓ Approve all (3)</Chip><Chip className="admin-button">Import companies</Chip></Demo>,
      },
      {
        heading: "2 · Access control",
        points: [
          "Approve non-QIU accounts and set each one's role.",
          "Assign company changes which company a rep represents without revoking them.",
          "Revoke removes access and deletes that company's profile and vacancies.",
          "QIU students and staff always sign in with Google; only company reps use a password.",
        ],
        demo: <Demo><Chip className="admin-button">Assign company</Chip><Chip className="access-revoke">Revoke and delete company</Chip></Demo>,
      },
      {
        heading: "3 · Events, QR and the live Q&A",
        points: [
          "Add event with its time, location, speakers and target courses.",
          "Present QR on the projector — the code rotates every 30s so a screenshot cannot be reused.",
          "Add presenters & Q&A facilitators (by email) so a volunteer can run one event's QR and open its live Q&A.",
          "During a talk, you or that facilitator open the Q&A; either of you can delete a message.",
          "Talk Q&A keeps the full history of every question asked, exportable to CSV.",
          "Attendance on any event shows who attended and exports to Excel.",
        ],
        demo: <Demo><Chip className="admin-button">＋ Add event</Chip><Chip className="edit-local">▶ Present QR</Chip><Chip className="admin-button">Talk Q&A</Chip></Demo>,
      },
      {
        heading: "4 · Oversight",
        points: [
          "Activity groups applications, job views and session bookings by student.",
          "Chats lists every assistant question with the student who asked it.",
          "Resumes opens what each student submitted.",
          "Your summary totals check-ins, active students and company profile visits.",
        ],
      },
      {
        heading: "5 · Settings (no code needed)",
        points: [
          "Change the portal title and tagline, tune the QR rotation and CCA threshold, and show or hide whole tabs.",
          "Superadmin can reset all data — it deletes everything except the superadmin account.",
        ],
        demo: <Demo><Chip className="tone-accent" style={{ borderRadius: ".5rem", padding: ".4rem .7rem", fontWeight: 700 }}>Settings</Chip></Demo>,
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
