import type { ReactNode } from "react";
import type { UserRole } from "../app/auth-policy";
import { Modal } from "../components/Modal";

type Section = { heading: string; points: string[]; demo?: ReactNode };
type GuideDoc = { title: string; intro: string; sections: Section[] };

/** A non-interactive preview of a real button/badge, reusing the live styles. */
function Chip({ className, children, style }: { className: string; children: ReactNode; style?: React.CSSProperties }) {
  return <span className={`guide-chip ${className}`} style={style}>{children}</span>;
}
function Demo({ label, children }: { label?: string; children: ReactNode }) {
  return <div className="guide-demo"><span className="guide-demo-label">{label ?? "Looks like"}</span><div className="guide-demo-row">{children}</div></div>;
}
const pill = { borderRadius: ".6rem", padding: ".5rem .9rem", fontWeight: 700 } as const;
const badge = { borderRadius: ".5rem", padding: ".35rem .6rem", fontWeight: 700, fontSize: ".75rem" } as const;

const student: GuideDoc = {
  title: "Welcome to QIU Industry Day 2026",
  intro: "A full tour of everything you can do as a student. Reopen this any time from the ? button in the top bar.",
  sections: [
    {
      heading: "Your tabs",
      points: [
        "Home — the companies attending, and their profiles.",
        "Events — talks and sessions, attendance and live Q&A.",
        "My Resume — build or link the CV employers see.",
        "Vacancies — jobs you can apply to.",
        "History — everything you have applied to, booked and attended.",
        "An admin can hide tabs for an event, so you may not see all five.",
      ],
      demo: <Demo label="Tabs"><Chip className="tone-accent" style={pill}>Home</Chip><Chip className="text-accent" style={pill}>Events</Chip><Chip className="text-accent" style={pill}>My Resume</Chip><Chip className="text-accent" style={pill}>Vacancies</Chip><Chip className="text-accent" style={pill}>History</Chip></Demo>,
    },
    {
      heading: "1 · Explore companies on Home",
      points: [
        "Every exhibitor appears as a card with its logo and booth number.",
        "Open a card for the full profile: description, website, corporate video and all its open vacancies.",
        "Companies whose vacancies match your course show a 🌟 Recommended for you ring — even if the company's industry looks unrelated (an F1 team hiring an AI engineer is still recommended to a Computer Science student).",
        "Sort the line-up by Recommended, Booth number, or Name A→Z / Z→A.",
      ],
      demo: <Demo><Chip className="tone-success" style={badge}>🌟 Recommended for you</Chip><Chip className="tone-neutral" style={badge}>Booth A1</Chip></Demo>,
    },
    {
      heading: "2 · Build your resume first",
      points: [
        "In My Resume you have two options — use one or both.",
        "Option 1: fill in your details (headline, summary, CGPA, final-year project, education, experience, skills, achievements, links) and a clean CV is generated live.",
        "Option 2: paste a link to your own resume (Google Drive / OneDrive / Dropbox, set to “anyone with the link”, PDF preferred).",
        "Preview updates as you type; Print → Save as PDF any time.",
        "Your QIU student/employee ID is picked up automatically from the directory and shown on your profile — employers see it with your application.",
        "You need a resume before you can apply, so do this early. Clearing a resume also withdraws the applications that shared it.",
      ],
      demo: <Demo><Chip className="tone-accent" style={pill}>My Resume</Chip><Chip className="save-job">Save CV details</Chip></Demo>,
    },
    {
      heading: "3 · Browse and filter vacancies",
      points: [
        "Roles that fit your course carry a 🌟 badge and sort to the top.",
        "Filter by company, specialization, opportunity type or maximum salary.",
        "Open any card for the full scope, requirements, salary and the company's job video.",
        "Jobs you have already applied to are stamped with a green ★ APPLIED marker so you never apply twice by accident.",
      ],
      demo: <Demo><Chip className="tone-success" style={badge}>🌟 Recommended for your course</Chip><Chip className="tone-success" style={{ ...badge, transform: "rotate(-8deg)" }}>★ APPLIED ★</Chip></Demo>,
    },
    {
      heading: "4 · Apply, and change your mind freely",
      points: [
        "Apply from a vacancy and choose which resume to attach (generated CV or your link).",
        "Everything you apply to is saved in History with the date.",
        "Withdraw at any time from History — nothing is permanent, and the company's applicant count updates.",
      ],
    },
    {
      heading: "5 · Book a mock interview or consultancy",
      points: [
        "On a company profile, open Book a session and pick an available time slot.",
        "Where the company offers both, you choose interview or consultancy for that slot.",
        "Slots have limited seats and you cannot book two sessions that overlap — the portal blocks the clash and names the one it conflicts with.",
        "Your bookings, and a Withdraw button, live in the History tab. The employer sees your course, ID and resume so they can prepare.",
      ],
      demo: <Demo><Chip className="ui-btn ui-btn-quiet">📅 Book a session →</Chip></Demo>,
    },
    {
      heading: "6 · Talks: interest, check-in, questions, reviews",
      points: [
        "Mark a talk Interested and it is added to your Google Calendar as a reminder.",
        "At the venue, scan the QR on the hall screen to CHECK IN, and scan again at the end to CHECK OUT.",
        "The QR changes every few seconds, so a screenshot cannot be reused — you must scan the live code.",
        "CCA credit needs enough time between the two scans, so stay for the session and remember to check out.",
        "While a talk runs a facilitator can open a live Q&A — only students who have checked in can ask. Your question is held until the facilitator approves it, then it can be shown on the big screen.",
        "After a talk ends, students who checked in can leave a star rating and a short review.",
      ],
      demo: <Demo><Chip className="tone-success" style={badge}>● Live now</Chip><Chip className="ui-btn ui-btn-primary">☆ Mark as interested</Chip></Demo>,
    },
    {
      heading: "7 · Chat with AI",
      points: [
        "Every company profile and vacancy has a Chat with AI box that answers only from that listing — it never invents details.",
        "Ask narrow questions (“where is it located?”, “what is the salary?”) for a precise answer.",
        "AI can make mistakes — always verify important details against the listing.",
        "Your questions are recorded with your name and visible to the company and to admins, so keep them professional.",
      ],
      demo: <Demo><Chip className="ui-btn ui-btn-primary">✦ Chat with AI</Chip></Demo>,
    },
    {
      heading: "8 · Track everything in History",
      points: [
        "Applications, session bookings and attended talks all gather here.",
        "Each attended talk shows whether you earned CCA credit.",
        "Search your history, and withdraw applications or bookings you changed your mind about.",
      ],
    },
  ],
};

const employer: GuideDoc = {
  title: "Welcome — your Company Dashboard",
  intro: "Post roles, meet students and see what they ask. Reopen this any time from the ? button.",
  sections: [
    {
      heading: "1 · Getting access",
      points: [
        "Register with your work email and a password — QIU accounts must use the Google button instead.",
        "State the company you represent in the same step; an admin reviews and approves before you can post anything.",
        "There is no verification email — admin approval is the gate. Until then your account can read nothing.",
        "After approval, if your profile is still empty a banner prompts you to complete it.",
      ],
    },
    {
      heading: "2 · Complete your company profile",
      points: [
        "Company profile tab: add your description, website, corporate video and booth number.",
        "This is exactly what students see on the Home page — an empty profile is a blank card.",
        "Edits to an already-approved profile are staged for a quick admin check before they go live; the current version stays up meanwhile.",
      ],
      demo: <Demo><Chip className="admin-button">Company profile</Chip></Demo>,
    },
    {
      heading: "3 · Post vacancies",
      points: [
        "Add vacancy fills in your company name automatically.",
        "As you type a job title, an indicative market salary range is suggested to guide your offer.",
        "New listings and edits go to an admin for approval before students see them.",
        "Manage vacancies to edit or remove anything you posted; the list exports to CSV.",
      ],
      demo: <Demo><Chip className="save-job">Add vacancy</Chip><Chip className="admin-button">Manage vacancies</Chip></Demo>,
    },
    {
      heading: "4 · Mock interviews & consultancies",
      points: [
        "Add mock interview: open a time slot with a date, time, location and capacity, and choose whether it is an interview, a consultancy, or either.",
        "Slots cannot overlap each other — the portal rejects a clashing time.",
        "Manage mock interviews shows who booked each slot, with their course, student ID and resume so you can prepare. Exports to CSV.",
      ],
      demo: <Demo><Chip className="admin-button">Add mock interview</Chip><Chip className="admin-button">Manage mock interviews</Chip></Demo>,
    },
    {
      heading: "5 · See who is interested",
      points: [
        "Your summary shows applications, assistant questions, mock-interview bookings and profile visits at a glance.",
        "Profile visits count each student once per browser session.",
        "View applicants lists each candidate with the resume they chose to share, plus course and ID.",
        "Activity is every application to your company; Chats are the questions students asked about you — shown with their name, not anonymous.",
        "Every list has an ⬇ Export CSV button.",
      ],
      demo: <Demo label="Tabs"><Chip className="tone-accent" style={pill}>View applicants</Chip><Chip className="text-accent" style={pill}>Activity</Chip><Chip className="text-accent" style={pill}>Chats</Chip></Demo>,
    },
  ],
};

const adminGuide: GuideDoc = {
  title: "Welcome — Admin overview",
  intro: "Approve companies, run the events and oversee everything. Reopen this any time from the ? button.",
  sections: [
    {
      heading: "Your tabs",
      points: [
        "Access control · Approvals · Manage companies · Add company · Import companies · Manage vacancies · Add vacancy · Activity · Resumes · Chats · Talk Q&A · Settings.",
        "The dashboard opens on Access control; your Summary sits above the tools.",
      ],
    },
    {
      heading: "1 · Companies & approvals",
      points: [
        "Approvals holds company registrations, vacancy submissions and staged profile edits — approve or reject each, or approve all at once.",
        "Approving a registration creates the company profile and grants that rep access in one step.",
        "The rep only supplies a name, so add the logo, video, booth and blurb yourself in Manage companies. Their email is a click-to-contact link in the queue.",
        "Import companies bulk-loads profiles from a JSON array (Company Name / Website / Nature of Business / Company Profile); names that already exist are skipped.",
      ],
      demo: <Demo><Chip className="admin-button">✓ Approve all (3)</Chip><Chip className="admin-button">⬆ Import JSON</Chip></Demo>,
    },
    {
      heading: "2 · Access control",
      points: [
        "Approve non-QIU (company) accounts and set each one's role.",
        "Assign company changes which company a rep represents without revoking them.",
        "Revoke removes access and deletes that company's profile and vacancies.",
        "QIU students and staff always sign in with Google; only company reps use a password.",
        "Export the account list (name, role, employee ID, course, company) to CSV.",
      ],
      demo: <Demo><Chip className="admin-button">Assign company</Chip><Chip className="access-revoke">Revoke &amp; delete company</Chip></Demo>,
    },
    {
      heading: "3 · Vacancies",
      points: [
        "Add vacancy on behalf of any company; Manage vacancies edits or removes any listing.",
        "The edit form opens as a pop-up so you never have to scroll to find it.",
        "Salary has no upper limit — enter any amount above zero.",
        "Filter, sort and Export CSV the whole list.",
      ],
    },
    {
      heading: "4 · Events, QR & the live Q&A",
      points: [
        "Add event with its time, location, one or more speakers (each with their own photo and links) and one or more target specializations so it is recommended to the right students.",
        "Present QR on the projector — the code rotates every ~30s so a screenshot cannot be reused.",
        "Add presenters & Q&A facilitators by email so a volunteer can run one event's QR and open its live Q&A, without being an admin.",
        "You or that facilitator open/close the Q&A, approve questions before they show, and can delete any message.",
        "Only students who checked in to the talk can ask a question.",
        "Presentation mode projects one approved question at a time; A− / A+ (or the +/- keys) enlarge or shrink it for the room.",
        "Attendance on any event shows who attended and exports to Excel/CSV.",
      ],
      demo: <Demo><Chip className="admin-button">＋ Add event</Chip><Chip className="edit-local">▶ Present QR</Chip><Chip className="ui-btn ui-btn-quiet">A+</Chip></Demo>,
    },
    {
      heading: "5 · Talk Q&A history & oversight",
      points: [
        "Talk Q&A is the full audit trail of every question asked during a talk — grouped by talk name, since presenters can delete from the live feed.",
        "Activity groups applications, job views and session bookings by student.",
        "Chats lists every assistant question with the student who asked it.",
        "Resumes opens what each student submitted, with their ID and course.",
        "Your summary totals check-ins, active students and company profile visits.",
        "Every one of these views has an ⬇ Export CSV button.",
      ],
      demo: <Demo><Chip className="admin-button">Talk Q&A</Chip><Chip className="admin-button">⬇ Export CSV</Chip></Demo>,
    },
    {
      heading: "6 · Settings (no code needed)",
      points: [
        "Change the portal title and tagline, tune the default QR rotation and the CCA threshold, and show or hide whole tabs for everyone.",
        "Data export downloads all vacancies, companies or events as CSV for reporting.",
      ],
      demo: <Demo><Chip className="tone-accent" style={pill}>Settings</Chip></Demo>,
    },
  ],
};

const superadmin: GuideDoc = {
  title: "Welcome — Super Admin overview",
  intro: "You have every admin tool, plus account oversight and the reset control. Reopen this any time from the ? button.",
  sections: [
    ...adminGuide.sections,
    {
      heading: "7 · Super-admin only",
      points: [
        "You can read the full account roster (every user, their role, course and employee ID) — this powers the accurate active-student count on the summary.",
        "Danger zone in Settings → Reset all data wipes every vacancy, application, resume, event, attendance record, company, booking and registration back to empty. Portal settings and your super-admin account are kept.",
        "The reset asks you to type CONFIRM-RESET and cannot be undone — use it only to clear a test run before the real event.",
        "Your super-admin account cannot be demoted or deleted, so you can never lock yourself out.",
      ],
      demo: <Demo><Chip className="access-revoke">Reset all data</Chip></Demo>,
    },
  ],
};

const GUIDES: Record<"student" | "employer" | "admin" | "superadmin", GuideDoc> = {
  student, employer, admin: adminGuide, superadmin,
};

export function Guide({ role, onClose }: { role: UserRole | null; onClose: () => void }) {
  const key = role === "superadmin" ? "superadmin" : role === "admin" ? "admin" : role === "employer" ? "employer" : "student";
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
