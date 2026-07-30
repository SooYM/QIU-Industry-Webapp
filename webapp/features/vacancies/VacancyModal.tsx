import { FormEvent, useEffect, useRef, useState } from "react";
import type { Job } from "../../lib/data/types";
import { getYouTubeEmbedUrl } from "../../app/auth-policy";
import { useAuth } from "../../app/auth-context";
import { logChat } from "../../lib/data/firestore";
import { RichText } from "../../app/RichText";
import { Modal } from "../../components/Modal";
import { benchmarkFor, formatSalary, DOSM_SOURCE } from "./vacancy-utils";

/** Deterministic answer grounded ONLY in this job's own fields — no cross-listing search. */
function answerAboutJob(question: string, job: Job): string {
  const q = question.toLowerCase();
  const has = (re: RegExp) => re.test(q);
  const scope = job.jobScope?.trim();
  const req = job.requirement?.trim();
  const parts: string[] = [];

  if (has(/prepare|require|qualif|skill|need|eligib|experience|criteria/)) {
    parts.push(req ? `**Requirements:** ${req}` : `The listing states a minimum requirement of **${job.minimumRequirement}**. No further requirements were provided.`);
  }
  if (has(/scope|responsib|\bdo\b|role|task|duties|day-to-day|involve/)) {
    if (scope) parts.push(`**Job scope:** ${scope}`);
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
  const summary = [scope && `**Scope:** ${scope}`, req && `**Requirements:** ${req}`].filter(Boolean).join("\n\n");
  if (summary) return `Here is what this listing says:\n\n${summary}`;
  return `This is a **${job.type} ${job.title}** role at **${job.company}** in ${job.location} (minimum ${job.minimumRequirement}). The listing has no further description — contact ${job.email || "the employer"} for details.`;
}

/** Grounded assistant scoped to a SINGLE job. Streams the answer and auto-scrolls. */
function JobAssistant({ job }: { job: Job }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: `Ask me about the **${job.title}** role at **${job.company}**. I only answer from this listing.` },
  ]);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight; // auto-scroll to newest
  }, [messages, open]);

  function ask(event: FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || streaming) return;
    setInput("");
    const answer = answerAboutJob(question, job);
    setMessages((m) => [...m, { role: "user", content: question }, { role: "assistant", content: "" }]);
    setStreaming(true);
    // Typewriter streaming.
    let i = 0;
    const stream = () => {
      i += 3;
      setMessages((m) => {
        const copy = m.slice();
        copy[copy.length - 1] = { role: "assistant", content: answer.slice(0, i) };
        return copy;
      });
      if (i < answer.length) window.setTimeout(stream, 16);
      else setStreaming(false);
    };
    window.setTimeout(stream, 60);
    if (user) {
      logChat({
        id: `${user.uid}_${Date.now()}`, studentUid: user.uid,
        studentEmail: user.email ?? "", studentName: user.displayName || user.email || "Anonymous",
        company: job.company, question, answer,
      }).catch(() => { /* best-effort */ });
    }
  }

  return (
    <section className="job-assistant">
      <button type="button" className="job-assistant-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span aria-hidden="true">✦</span> Ask about this job <span aria-hidden="true">{open ? "▲" : "▼"}</span>
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
        </>
      )}
    </section>
  );
}

export function VacancyModal({
  job,
  isStudent,
  recommended = false,
  applied = false,
  hasResume = false,
  onApply,
  onGoToResume,
  onClose,
}: {
  job: Job;
  isStudent: boolean;
  recommended?: boolean;
  applied?: boolean;
  hasResume?: boolean;
  onApply?: () => void;
  onGoToResume?: () => void;
  onClose: () => void;
}) {
  const benchmark = benchmarkFor(job);
  const hasVideo = Boolean(job.youtubeUrl && job.youtubeUrl.trim());
  return (
    <Modal className="job-detail" labelledBy="job-detail-title" closeLabel="Close job details" onClose={onClose}>
      <div className="detail-header">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`type ${job.type.toLowerCase().includes("intern") ? "intern" : ""}`}>{job.type}</span>
            {recommended && (
              <span className="rounded-lg px-2 py-0.5 text-xs font-bold tone-success">🌟 Recommended for your course</span>
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
            ? <section><span className="detail-label">JOB SCOPE</span><p style={{ whiteSpace: "pre-wrap" }}>{job.jobScope}</p></section>
            : null}
          {job.requirement && job.requirement.trim()
            ? <section><span className="detail-label">REQUIREMENTS</span><p style={{ whiteSpace: "pre-wrap" }}>{job.requirement}</p></section>
            : null}
          {!(job.jobScope && job.jobScope.trim()) && !(job.requirement && job.requirement.trim()) && (
            <section><span className="detail-label">ABOUT THIS ROLE</span><p>Full scope and requirements to be confirmed with the employer.</p></section>
          )}
          <section><span className="detail-label">LISTING DETAILS</span><dl><div><dt>Specialization</dt><dd>{job.specialization}</dd></div><div><dt>Minimum requirement</dt><dd>{job.minimumRequirement}</dd></div><div><dt>Available places</dt><dd>{job.vacancies}</dd></div><div><dt>Pay frequency</dt><dd>{job.payFrequency}</dd></div></dl></section>
          {hasVideo && (
            <section className="mt-4">
              <span className="detail-label flex items-center gap-1.5">🎬 CORPORATE INTRO VIDEO</span>
              <div className="overflow-hidden rounded-xl border border-token mt-1.5">
                <iframe
                  src={getYouTubeEmbedUrl(job.youtubeUrl)}
                  title={`${job.company} Corporate Video`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full aspect-video rounded-xl border-0"
                />
              </div>
              <small className="text-[11px] text-accent mt-1 block">Corporate video supplied by {job.company}.</small>
            </section>
          )}
        </div>
        <aside className="market-card"><span className="detail-label">MALAYSIA MARKET CONTEXT</span><strong>RM {benchmark.amount.toLocaleString()}</strong><p>{benchmark.label}, monthly, DOSM Salaries & Wages Survey 2024.</p>{job.type.toLowerCase().includes("intern") && <div className="benchmark-note">This workforce benchmark is not an internship allowance estimate.</div>}<a href={DOSM_SOURCE} target="_blank" rel="noreferrer">View official source ↗</a><hr/><span className="detail-label">CONTACT</span>{job.email ? <a className="enquire-main" href={`mailto:${job.email}?subject=${encodeURIComponent(`Enquiry: ${job.title}`)}`}>Email employer →</a> : <p>No enquiry email supplied.</p>}
        {isStudent && (
          <>
            <hr/>
            <span className="detail-label">APPLICATION</span>
            {applied ? (
              <p className="rounded-lg px-3 py-2 text-xs font-bold tone-success" role="status">✓ Applied — saved to your History.</p>
            ) : hasResume ? (
              <>
                <button type="button" className="enquire-main" onClick={onApply}>Apply to this vacancy →</button>
                <small className="text-accent">Applying records your interest and attaches your submitted resume.</small>
              </>
            ) : (
              <>
                <p className="rounded-lg px-3 py-2 text-xs font-bold tone-neutral" role="status">Submit your resume before you can apply.</p>
                <button type="button" className="enquire-main" onClick={onGoToResume}>Submit your resume →</button>
              </>
            )}
          </>
        )}
        <JobAssistant job={job} />
        </aside>
      </div>
    </Modal>
  );
}
