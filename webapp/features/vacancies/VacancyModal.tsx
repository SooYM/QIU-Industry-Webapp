import { FormEvent, useEffect, useRef, useState } from "react";
import type { Company, Job } from "../../lib/data/types";
import { getYouTubeEmbedUrl } from "../../app/auth-policy";
import { useAuth } from "../../app/auth-context";
import { logChat } from "../../lib/data/firestore";
import { RichText } from "../../app/RichText";
import { Modal } from "../../components/Modal";
import { formatSalary } from "./vacancy-utils";
import { AI_WARNING, withAiWarning } from "../../app/chat";

/** Deterministic answer grounded ONLY in this job's own fields — no cross-listing search. */
function answerAboutJob(question: string, job: Job): string {
  const q = question.toLowerCase();
  const has = (re: RegExp) => re.test(q);
  const scope = job.jobScope?.trim();
  const req = job.requirement?.trim();
  const parts: string[] = [];

  if (has(/prepare|require|qualif|skill|need|eligib|experience|criteria/)) {
    parts.push(req ? `**Qualifications:** ${req}` : `The listing states a minimum qualification of **${job.minimumRequirement}**. No further qualifications were provided.`);
  }
  if (has(/scope|description|responsib|\bdo\b|role|task|duties|day-to-day|involve/)) {
    if (scope) parts.push(`**Description:** ${scope}`);
  }
  if (has(/salary|pay|wage|rm|allowance|stipend/)) {
    parts.push(job.salary ? `The listed salary is **RM ${job.salary.toLocaleString()} / ${job.payFrequency.toLowerCase()}**.` : "The salary is not stated on this listing.");
  }
  if (has(/where|location|place|based|city|state/)) parts.push(`This role is based in **${job.location}**.`);
  if (has(/who|company|employer|organi|about the company/)) parts.push(`This role is offered by **${job.company}**.`);
  if (has(/apply|contact|email|reach|enquir/)) parts.push(job.email ? `To enquire or apply, contact **${job.email}**.` : "No enquiry email is listed — apply via the portal.");
  if (has(/intern|permanent|contract|part.?time|full.?time|\btype\b/)) parts.push(`This is a **${job.type}** position.`);
  if (has(/how many|vacan|slot|opening|positions available|places/)) parts.push(`There ${job.vacancies === 1 ? "is **1 place**" : `are **${job.vacancies} places**`} available.`);

  if (parts.length) return parts.join("\n\n");

  // No specific intent — summarise strictly from the listing's description fields.
  const summary = [scope && `**Description:** ${scope}`, req && `**Qualifications:** ${req}`].filter(Boolean).join("\n\n");
  if (summary) return `Here is what this listing says:\n\n${summary}`;
  return `This is a **${job.type} ${job.title}** role at **${job.company}** in ${job.location} (minimum qualification: ${job.minimumRequirement}). The listing has no further description — contact ${job.email || "the company"} for details.`;
}

/** Grounded assistant scoped to a SINGLE job. Streams the answer and auto-scrolls. */
function JobAssistant({ job }: { job: Job }) {
  const { user, employeeId } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: withAiWarning(`Ask me about the **${job.title}** role at **${job.company}**. I only answer from this listing.`) },
  ]);
  const boxRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Keep the newest answer and the input in view: pin the message list to its
  // bottom and scroll the conversation's end into the modal on every turn / stream.
  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, open]);

  function ask(event: FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || streaming) return;
    setInput("");
    const answer = answerAboutJob(question, job);
    const loggedAnswer = withAiWarning(answer);
    setMessages((m) => [...m, { role: "user", content: question }, { role: "assistant", content: AI_WARNING }]);
    setStreaming(true);
    // Typewriter streaming.
    let i = 0;
    const stream = () => {
      i += 3;
      setMessages((m) => {
        const copy = m.slice();
        copy[copy.length - 1] = { role: "assistant", content: `${AI_WARNING}\n\n${answer.slice(0, i)}` };
        return copy;
      });
      if (i < answer.length) window.setTimeout(stream, 16);
      else setStreaming(false);
    };
    window.setTimeout(stream, 60);
    if (user) {
      logChat({
        id: `${user.uid}_${Date.now()}`, studentUid: user.uid,
        ...(employeeId ? { studentEmployeeId: employeeId } : {}),
        studentEmail: user.email ?? "", studentName: user.displayName || user.email || "Anonymous",
        company: job.company, question, answer: loggedAnswer,
      }).catch(() => { /* best-effort */ });
    }
  }

  return (
    <section className="job-assistant">
      <button type="button" className="job-assistant-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span aria-hidden="true">✦</span> Chat with AI about this job <span aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <>
          <div className="job-assistant-messages" ref={boxRef} aria-live="polite">
            {messages.map((m, i) => <div key={i} className={`message ${m.role}`}><RichText content={m.content} /></div>)}
          </div>
          <form className="chat-form" onSubmit={ask}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Ask about ${job.title}…`} aria-label="Ask about this job" />
            <button disabled={!input.trim() || streaming} aria-label="Send question">↑</button>
          </form>
          <div ref={endRef} aria-hidden="true" />
        </>
      )}
    </section>
  );
}

export function VacancyModal({
  job,
  company,
  isStudent,
  recommended = false,
  applied = false,
  hasGeneratedResume = false,
  hasResumeLink = false,
  applicantCount = 0,
  onApply,
  onWithdraw,
  onGoToResume,
  onClose,
}: {
  job: Job;
  company?: Company;
  isStudent: boolean;
  recommended?: boolean;
  applied?: boolean;
  hasGeneratedResume?: boolean;
  hasResumeLink?: boolean;
  applicantCount?: number;
  onApply?: (choice: "generated" | "link") => void;
  onWithdraw?: () => void;
  onGoToResume?: () => void;
  onClose: () => void;
}) {
  const jobEmbedUrl = getYouTubeEmbedUrl(job.youtubeUrl);
  const corporateEmbedUrl = getYouTubeEmbedUrl(company?.videoUrl);
  const embedUrl = jobEmbedUrl || corporateEmbedUrl;
  const isJobVideo = Boolean(jobEmbedUrl);
  const hasVideo = Boolean(embedUrl);
  const hasResume = hasGeneratedResume || hasResumeLink;
  // Default the choice to whichever the student has (generated preferred when both).
  const [resumeChoice, setResumeChoice] = useState<"generated" | "link">(hasGeneratedResume ? "generated" : "link");
  return (
    <Modal className="job-detail" labelledBy="job-detail-title" closeLabel="Close job details" onClose={onClose}>
      <div className="detail-header">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`type ${job.type.toLowerCase().includes("intern") ? "intern" : ""}`}>{job.type}</span>
            {recommended && (
              <span className="rounded-lg px-2 py-0.5 text-xs font-bold tone-success">🌟 Recommended for your profile</span>
            )}
          </div>
          <h2 id="job-detail-title">{job.title}</h2>
          <p>{job.company} · {job.location}</p>
        </div>
        <div className="detail-salary"><small>LISTED SALARY</small><strong>{formatSalary(job)}</strong></div>
      </div>
      <div className="detail-grid">
        <div className="detail-main">
          {job.jobScope && job.jobScope.trim()
            ? <section><span className="detail-label">DESCRIPTION</span><p style={{ whiteSpace: "pre-wrap" }}>{job.jobScope}</p></section>
            : null}
          {job.requirement && job.requirement.trim()
            ? <section><span className="detail-label">QUALIFICATIONS</span><p style={{ whiteSpace: "pre-wrap" }}>{job.requirement}</p></section>
            : null}
          {!(job.jobScope && job.jobScope.trim()) && !(job.requirement && job.requirement.trim()) && (
            <section><span className="detail-label">ABOUT THIS ROLE</span><p>Full description and qualifications to be confirmed with the company.</p></section>
          )}
          <section><span className="detail-label">LISTING DETAILS</span><dl><div><dt>Specialization</dt><dd>{job.specialization}</dd></div><div><dt>Minimum qualification</dt><dd>{job.minimumRequirement}</dd></div><div><dt>Available places</dt><dd>{job.vacancies}</dd></div><div><dt>Pay frequency</dt><dd>{job.payFrequency}</dd></div></dl></section>
          {hasVideo && (
            <section className="mt-4">
              <span className="detail-label">{isJobVideo ? "JOB VIDEO" : "CORPORATE VIDEO"}</span>
              <div className="overflow-hidden rounded-xl border border-token mt-1.5">
                <iframe
                  src={embedUrl}
                  title={isJobVideo ? `${job.title} job video` : `${job.company} corporate video`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full aspect-video rounded-xl border-0"
                />
              </div>
              <small className="text-[11px] text-accent mt-1 block">{isJobVideo ? `Job video supplied by ${job.company}.` : `Corporate video supplied by ${job.company}.`}</small>
            </section>
          )}
        </div>
        <aside className="market-card"><span className="detail-label">CONTACT</span>{job.email ? <a className="enquire-main" href={`mailto:${job.email}?subject=${encodeURIComponent(`Enquiry: ${job.title}`)}`}>Email company →</a> : <p>No enquiry email supplied.</p>}
        {isStudent && (
          <>
            <hr/>
            <span className="detail-label">APPLICATION</span>
            {applied ? (
              <>
                <p className="rounded-lg px-3 py-2 text-xs font-bold tone-success" role="status">✓ Applied — saved to your History.</p>
                <button type="button" className="cancel-edit" style={{ width: "100%", marginTop: ".5rem" }} onClick={onWithdraw}>Withdraw application</button>
              </>
            ) : hasResume ? (
              <>
                {hasGeneratedResume && hasResumeLink && (
                  <fieldset className="resume-choice">
                    <legend>Attach which resume?</legend>
                    <label><input type="radio" name="resume-choice" checked={resumeChoice === "generated"} onChange={() => setResumeChoice("generated")} /> My generated CV</label>
                    <label><input type="radio" name="resume-choice" checked={resumeChoice === "link"} onChange={() => setResumeChoice("link")} /> My uploaded resume link</label>
                  </fieldset>
                )}
                <button type="button" className="enquire-main" onClick={() => {
                  const label = resumeChoice === "generated" ? "generated CV" : "resume link";
                  if (window.confirm(`Consent to apply\n\nBy applying, you agree to share your ${label}, name and email address with ${job.company} and Quest International University, to be used for recruitment and QIU Industry Day purposes.\n\nDo you want to continue?`)) onApply?.(resumeChoice);
                }}>Apply to this vacancy →</button>
                <small className="text-accent">By applying, you consent to sharing your {hasGeneratedResume && hasResumeLink ? "chosen resume" : hasGeneratedResume ? "generated CV" : "resume link"}, name and email with <b>{job.company}</b> and <b>QIU</b> for recruitment purposes.</small>
              </>
            ) : (
              <>
                <p className="rounded-lg px-3 py-2 text-xs font-bold tone-neutral" role="status">Add a resume before you can apply.</p>
                <button type="button" className="enquire-main" onClick={onGoToResume}>Build or link your resume →</button>
              </>
            )}
          </>
        )}
        <hr/>
        <p className="applicant-stat"><b>{applicantCount}</b> {applicantCount === 1 ? "student has" : "students have"} applied</p>
        <JobAssistant job={job} />
        </aside>
      </div>
    </Modal>
  );
}
