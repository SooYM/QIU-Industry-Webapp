import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Company, Job } from "../../lib/data/types";
import { isApprovedCompany } from "../../lib/data/types";
import { getYouTubeEmbedUrl, type UserRole } from "../../app/auth-policy";
import { useAuth } from "../../app/auth-context";
import { countCompanyViews, isApproved, logChat, subscribeCompanyChats } from "../../lib/data/firestore";
import { estimateReplyHours, replyTimeLabel, whatsappLink } from "../../lib/data/reply-time";
import { courseArea, jobMatchesCourse } from "../../lib/data/course-map";
import { companyNamesMatch } from "../../lib/data/company-matching";
import { AI_WARNING, withAiWarning } from "../../app/chat";
import { RichText } from "../../app/RichText";
import { Modal } from "../../components/Modal";
import { useLogoBackdrop } from "./useLogoBackdrop";
import { checkToxicContent, TOXIC_REPLY } from "../../lib/toxic-filter";

/* Inline icons — the UI uses drawn glyphs, never emoji, so they inherit colour,
   size and stroke weight from the surrounding text. */
const ico = { width: "1em", height: "1em", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const IconSparkle = () => <svg {...ico}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /></svg>;
const IconChevron = ({ up }: { up?: boolean }) => <svg {...ico}><path d={up ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} /></svg>;
const IconArrowUp = () => <svg {...ico}><path d="M12 19V5M5 12l7-7 7 7" /></svg>;
const IconClock = () => <svg {...ico}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
const IconStar = () => <svg {...ico} fill="currentColor" stroke="none"><path d="M12 3l2.6 6.3 6.8.5-5.2 4.4 1.7 6.6L12 17.8 6.3 21.3 8 14.7 2.8 10.3l6.8-.5z" /></svg>;
const IconCalendar = () => <svg {...ico}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>;
const IconPlay = () => <svg {...ico}><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M10 9l5 3-5 3z" fill="currentColor" /></svg>;
const IconGlobe = () => <svg {...ico}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z" /></svg>;
const IconMail = () => <svg {...ico}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>;
const IconWhatsApp = () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2zm5.8 14.3c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.8-.6-3-1.3-5-4.4-5.2-4.6-.1-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .7.5l.9 2.1c.1.2.1.4 0 .6l-.4.6-.3.3c-.2.2-.4.4-.2.7.2.4.9 1.5 2 2.4 1.3 1.2 2.4 1.5 2.7 1.7.3.1.5.1.7-.1l.9-1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.5.4.1.2.1.7-.1 1.4z" /></svg>;

/** Deterministic answer grounded ONLY in this company's profile + its vacancies. */
/**
 * Answers a question about ONE company, scoped to what was actually asked.
 *
 * A catch-all used to concatenate the summary, booth and vacancy count whenever
 * no branch produced text — so "where is it located?" answered with the entire
 * profile the moment a booth number was missing. A recognised intent with no
 * data must say so, not hand back everything.
 */
function answerAboutCompany(question: string, company: Company, jobs: Job[]): string {
  const q = question.toLowerCase();
  const has = (re: RegExp) => re.test(q);
  const parts: string[] = [];
  let recognised = false;

  if (has(/vacan|job|hir|role|position|opening|intern|apply|career/)) {
    recognised = true;
    parts.push(jobs.length
      ? `**${company.name}** currently lists ${jobs.length} ${jobs.length === 1 ? "vacancy" : "vacancies"}:\n\n${jobs.map((j) => `- **${j.title}** (${j.type}, ${j.location})`).join("\n")}`
      : `**${company.name}** has no open vacancies listed on the portal right now.`);
  }
  if (has(/booth|stand\b|where|find them|located|location|which hall/)) {
    recognised = true;
    parts.push(company.boothNumber
      ? `**${company.name}** is at **booth ${company.boothNumber}**.`
      : `No booth number is listed for **${company.name}** yet — ask at the Industry Day help desk on the day.`);
  }
  if (has(/website|site\b|link|url|homepage/)) {
    recognised = true;
    parts.push(company.website ? `Their website: ${company.website}` : "No website is listed on their profile.");
  }
  if (has(/video|watch/)) {
    recognised = true;
    parts.push(company.videoUrl ? "There's a corporate video on their profile — scroll up to watch it." : "No corporate video is listed on their profile.");
  }
  if (has(/email|contact|reach|enquir|whatsapp|phone/)) {
    recognised = true;
    parts.push(company.whatsapp
      ? `You can message them on WhatsApp from their profile, or email ${company.email || "— no email is listed"}.`
      : company.email ? `You can contact them at ${company.email}.` : "No contact details are listed on their profile.");
  }
  if (has(/looking for|interested in|which course|what course|who do they want/)) {
    recognised = true;
    parts.push(company.interestedIn?.length
      ? `They are looking for students from: ${company.interestedIn.join(", ")}.`
      : "They have not said which areas of study they are looking for.");
  }
  if (has(/who|about|what.*(do|they)|overview|background|tell me/)) {
    recognised = true;
    parts.push(company.summary || `No company description is listed for **${company.name}** yet.`);
  }

  if (parts.length) return parts.join("\n\n");
  // Only when nothing at all was recognised do we offer the overview.
  if (!recognised) {
    const bits = [
      company.summary,
      company.boothNumber && `They are at booth ${company.boothNumber}.`,
      jobs.length && `They list ${jobs.length} ${jobs.length === 1 ? "vacancy" : "vacancies"}.`,
    ].filter(Boolean).join(" ");
    return bits || `This is **${company.name}**'s profile. Ask about their vacancies, booth, website or contact details.`;
  }
  return `Nothing is listed for that on **${company.name}**'s profile yet.`;
}

/**
 * The opener we pre-fill for WhatsApp. It used to say "I'm a QIU student" to
 * everyone — including an employer looking at another exhibitor's profile, and
 * an organiser — which put words in their mouth the moment they tapped through.
 */
function whatsappOpener(companyName: string, role: UserRole | null, viewerCompany: string | null) {
  if (role === "employer") {
    const from = viewerCompany ? ` from ${viewerCompany}` : "";
    return `Hi ${companyName}, I'm a fellow exhibitor${from} at QIU Industry Day 2026 — I saw your profile on the portal and wanted to connect.`;
  }
  if (role === "admin" || role === "superadmin") {
    return `Hi ${companyName}, I'm from the QIU Industry Day 2026 organising team — reaching out about your participation.`;
  }
  return `Hi ${companyName}, I'm a QIU student — I saw your profile on the Industry Day portal and wanted to ask about your opportunities.`;
}

function CompanyAssistant({ company, jobs }: { company: Company; jobs: Job[] }) {
  const { user, employeeId, role, company: viewerCompany } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: withAiWarning(`Ask me about **${company.name}** — their vacancies, booth or profile. I only answer from this company's details.`) },
  ]);
  const boxRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Keep the newest answer AND the input visible: pin the message list to its
  // bottom, and scroll the whole conversation's end into the modal on every turn
  // and while the answer streams (the assistant sits below the modal fold).
  useEffect(() => {
    const el = boxRef.current; if (el) el.scrollTop = el.scrollHeight;
    if (open) endRef.current?.scrollIntoView({ behavior: streaming ? "auto" : "smooth", block: "end" });
  }, [messages, open]);

  async function ask(event: FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || streaming) return;
    setInput("");

    // Students address this box as if a person from the company were reading it,
    // so abuse is screened before it reaches the answer or the employer's log.
    if ((await checkToxicContent(question)).isToxic) {
      setMessages((m) => [...m, { role: "user", content: question }, { role: "assistant", content: TOXIC_REPLY }]);
      return;
    }

    const answer = answerAboutCompany(question, company, jobs);
    const loggedAnswer = withAiWarning(answer);
    setMessages((m) => [...m, { role: "user", content: question }, { role: "assistant", content: AI_WARNING }]);
    setStreaming(true);
    let i = 0;
    const stream = () => {
      i += 3;
      setMessages((m) => { const copy = m.slice(); copy[copy.length - 1] = { role: "assistant", content: `${AI_WARNING}\n\n${answer.slice(0, i)}` }; return copy; });
      if (i < answer.length) window.setTimeout(stream, 16); else setStreaming(false);
    };
    window.setTimeout(stream, 60);
    if (user) {
      logChat({ id: `${user.uid}_${Date.now()}`, studentUid: user.uid, ...(employeeId ? { studentEmployeeId: employeeId } : {}), studentEmail: user.email ?? "", studentName: user.displayName || user.email || "Anonymous", company: company.name, question, answer: loggedAnswer }).catch(() => {});
    }
  }

  return (
    <section className="job-assistant mt-4">
      <button type="button" className="job-assistant-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <IconSparkle /> Chat with AI about {company.name} <IconChevron up={open} />
      </button>
      {open && (
        <>
          <div className="job-assistant-messages" ref={boxRef} aria-live="polite">
            {messages.map((m, i) => <div key={i} className={`message ${m.role}`}><RichText content={m.content} /></div>)}
          </div>
          <form className="chat-form" onSubmit={ask}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Ask about ${company.name}…`} aria-label="Ask about this company" />
            <button disabled={!input.trim() || streaming} aria-label="Send question"><IconArrowUp /></button>
          </form>
          <div ref={endRef} aria-hidden="true" />
        </>
      )}
      {company.whatsapp ? (
        <a
          className="ui-btn ui-btn-success company-whatsapp-cta"
          href={whatsappLink(company.whatsapp, whatsappOpener(company.name, role, viewerCompany))}
          target="_blank"
          rel="noreferrer"
        >
          <IconWhatsApp /> Chat with us on WhatsApp
        </a>
      ) : (
        <button type="button" className="ui-btn company-whatsapp-cta" disabled aria-label="WhatsApp unavailable — this company has not added a number">
          <IconWhatsApp /> WhatsApp not available
        </button>
      )}
      {company.email ? (
        <a className="ui-btn ui-btn-quiet company-whatsapp-cta" href={`mailto:${company.email}?subject=${encodeURIComponent(`QIU Industry Day enquiry — ${company.name}`)}`}>
          <IconMail /> Email us
        </a>
      ) : (
        <button type="button" className="ui-btn company-whatsapp-cta" disabled aria-label="Email unavailable — this company has not added an address">
          <IconMail /> Email not available
        </button>
      )}
    </section>
  );
}

function CompanyDetail({ company, jobs, isStudent, course, canSeeVisits, onOpenJob, onBookInterview, onClose }: {
  company: Company;
  jobs: Job[];
  isStudent: boolean;
  course: string | null;
  canSeeVisits?: boolean;
  onOpenJob: (job: Job) => void;
  onBookInterview?: (companyName: string) => void;
  onClose: () => void;
}) {
  const embedUrl = getYouTubeEmbedUrl(company.videoUrl);
  const [visits, setVisits] = useState<number | null>(null);
  const [replyHours, setReplyHours] = useState<number | null>(null);

  // Visit documents carry student ids, so only staff may read them — the count
  // is shown to admins and employers, not on the public profile.
  useEffect(() => {
    if (!canSeeVisits) return;
    let live = true;
    countCompanyViews(company.name)
      .then((total) => { if (live) setVisits(total); })
      .catch(() => { /* Informational only; never block the profile. */ });
    return () => { live = false; };
  }, [canSeeVisits, company.name]);

  // Estimated from this company's own chat history — see lib/data/reply-time.ts
  // for why it is an estimate and when it stays hidden.
  useEffect(() => subscribeCompanyChats(company.name, (logs) => setReplyHours(estimateReplyHours(logs))), [company.name]);
  const backdrop = useLogoBackdrop(company.logoUrl, company.logoBackground ?? "auto");
  const companyJobs = jobs.filter((j) => companyNamesMatch(j.company, company.name) && isApproved(j));

  return (
    <Modal className="job-detail" labelledBy="company-detail-title" closeLabel="Close company profile" onClose={onClose}>
      <div className="detail-header">
        <div className="flex items-center gap-3">
          {company.logoUrl && <img className={`exhibitor-logo-lg logo-${backdrop}`} src={company.logoUrl} alt={company.name} />}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 id="company-detail-title">{company.name}</h2>
              {company.boothNumber && <span className="booth-chip">Booth {company.boothNumber}</span>}
            </div>
            {company.website && <p><a href={company.website} target="_blank" rel="noreferrer">{company.website.replace(/^https?:\/\//i, "")} ↗</a></p>}
          </div>
        </div>
      </div>
      <div className="detail-main">
        {replyTimeLabel(company.replyHours ?? replyHours) && (
          <section>
            <span className="detail-label">CONTACT</span>
            <p className="text-xs ui-muted mt-1.5 inline-flex items-center gap-1">
              <IconClock /> {company.name} {replyTimeLabel(company.replyHours ?? replyHours)} <span className="italic">(estimated from past enquiries)</span>
            </p>
          </section>
        )}

        {(company.interestedIn?.length ?? 0) > 0 && (
          <section>
            <span className="detail-label">LOOKING FOR</span>
            <div className="exhibitor-tags mt-1.5">
              {company.interestedIn!.map((field) => <span key={field} className="exhibitor-tag">{field}</span>)}
            </div>
          </section>
        )}

        {canSeeVisits && (
          <section>
            <span className="detail-label">PROFILE VISITS</span>
            <p className="text-sm ui-strong mt-1">
              <b>{visits ?? "—"}</b> visit{visits === 1 ? "" : "s"}
              <span className="ui-muted"> · counted once per student per browser session</span>
            </p>
          </section>
        )}

        {company.summary && <section><span className="detail-label">ABOUT</span><p style={{ whiteSpace: "pre-wrap" }}>{company.summary}</p></section>}

        <section>
          <span className="detail-label">AVAILABLE VACANCIES</span>
          {companyJobs.length ? (
            <div className="company-vacancies">
              {companyJobs.map((j) => {
                const matched = isStudent && jobMatchesCourse(j, course);
                return (
                  <button type="button" key={j.id} className={`company-vacancy${matched ? " is-recommended" : ""}`} onClick={() => onOpenJob(j)}>
                    <span><b>{j.title}</b><small>{j.type} · {j.location} · {j.specialization}</small></span>
                    {matched && <span className="rounded px-1.5 py-0.5 text-[10px] font-bold tone-success inline-flex items-center gap-1"><IconStar /> Matches your profile</span>}
                    <span className="view-job">View →</span>
                  </button>
                );
              })}
            </div>
          ) : <p className="text-accent text-sm">No vacancies listed from this company yet.</p>}
          {isStudent && onBookInterview && (
            <button
              type="button"
              className="w-full mt-3 ui-btn ui-btn-quiet company-book-cta"
              onClick={() => onBookInterview(company.name)}
            >
              <IconCalendar /> Book mock interview or consultancy
            </button>
          )}
        </section>

        {embedUrl && (
          <section className="mt-4">
            <span className="detail-label inline-flex items-center gap-1"><IconPlay /> CORPORATE VIDEO</span>
            <div className="overflow-hidden rounded-xl border border-token mt-1.5">
              <iframe src={embedUrl} title={`${company.name} corporate video`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full aspect-video rounded-xl border-0" />
            </div>
          </section>
        )}

        <CompanyAssistant company={company} jobs={companyJobs} />
      </div>
    </Modal>
  );
}

function ExhibitorCard({ company, onOpen, recommended }: { company: Company; onOpen: () => void; recommended?: boolean }) {
  const backdrop = useLogoBackdrop(company.logoUrl, company.logoBackground ?? "auto");
  const [logoOk, setLogoOk] = useState(true);
  return (
    <article className={`exhibitor-card ${recommended ? "recommended" : ""}`} role="button" tabIndex={0}
      aria-label={`View ${company.name}`}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}>
      <div className={`exhibitor-logo-wrap logo-${backdrop}`}>
        {company.logoUrl && logoOk ? <img src={company.logoUrl} alt={company.name} onError={() => setLogoOk(false)} /> : <span className="exhibitor-logo-fallback">{company.name.slice(0, 2).toUpperCase()}</span>}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <h3>{company.name}</h3>
        {company.boothNumber && <span className="booth-chip">Booth {company.boothNumber}</span>}
      </div>
      {company.summary && <p className="exhibitor-blurb">{company.summary}</p>}
      <div className="exhibitor-tags">
        {company.website && <span className="exhibitor-tag inline-flex items-center gap-1"><IconGlobe /> Website</span>}
        {company.videoUrl && <span className="exhibitor-tag inline-flex items-center gap-1"><IconPlay /> Video</span>}
      </div>
      {recommended && <span className="rounded px-1.5 py-0.5 text-[10px] font-bold tone-success mt-1 inline-flex items-center gap-1"><IconStar /> Looking for your course</span>}
      <p className="view-job mt-2">View profile <span>→</span></p>
    </article>
  );
}

/** The Home landing: companies attending Industry Day, shown first. */
export function HomeView({
  companies,
  jobs,
  isStudent,
  course,
  settings,
  onOpenJob,
  onOpenCompany,
  onBookInterview,
  canSeeVisits,
}: {
  companies: Company[];
  jobs: Job[];
  isStudent: boolean;
  course: string | null;
  settings: { portalTitle: string; portalTagline: string };
  onOpenJob: (job: Job) => void;
  onOpenCompany?: (company: Company) => void;
  onBookInterview?: (companyName: string) => void;
  canSeeVisits?: boolean;
}) {
  const [selected, setSelected] = useState<Company | null>(null);
  const [sort, setSort] = useState<"recommended" | "booth" | "az" | "za">("booth");

  // Companies worth recommending: any of their approved vacancies fits the student's
  // course — even when the company's own industry differs (an F1 team hiring an AI
  // engineer still fits a Computer Science student).
  // Which companies want THIS student, from what each company says it is looking
  // for. It used to be derived from whether any of their vacancies matched —
  // recommending a company purely for having posted a relevant job, even when
  // they had no interest in that course.
  const recommendedIds = useMemo(() => {
    if (!isStudent || !course) return new Set<number>();
    const ids = new Set<number>();
    // Companies pick areas of study, so the student's programme is resolved to
    // its area before matching. The raw course name is still accepted so profiles
    // saved when this field held individual programmes keep working.
    const wanted = course.trim().toLowerCase();
    const area = courseArea(course)?.toLowerCase();
    for (const c of companies) {
      if ((c.interestedIn ?? []).some((field) => {
        const v = field.trim().toLowerCase();
        return v === "all students" || v === wanted || (area !== undefined && v === area);
      })) ids.add(c.id);
    }
    return ids;
  }, [companies, isStudent, course]);

  const visible = useMemo(() => {
    const rows = companies.filter(isApprovedCompany);
    const byName = (a: Company, b: Company) => a.name.localeCompare(b.name, undefined, { numeric: true });
    const byBooth = (a: Company, b: Company) => {
      // Booth-less companies sink to the bottom; the rest sort naturally (A12 before A100).
      if (!a.boothNumber) return b.boothNumber ? 1 : byName(a, b);
      if (!b.boothNumber) return -1;
      return a.boothNumber.localeCompare(b.boothNumber, undefined, { numeric: true }) || byName(a, b);
    };
    if (sort === "za") return rows.slice().sort((a, b) => byName(b, a));
    if (sort === "booth") return rows.slice().sort(byBooth);
    if (sort === "recommended") return rows.slice().sort((a, b) =>
      (recommendedIds.has(b.id) ? 1 : 0) - (recommendedIds.has(a.id) ? 1 : 0) || byBooth(a, b));
    return rows.slice().sort(byName);
  }, [companies, sort, recommendedIds]);

  return (
    <section className="results" aria-labelledby="home-title">
      <div className="results-head">
        <div><span>WELCOME</span><h1 id="home-title">{settings.portalTitle}</h1></div>
        <p>{settings.portalTagline}</p>
      </div>

      <div className="section-heading">
        <div><span>COMPANIES</span><h2>Companies attending</h2></div>
        {visible.length > 1 && (
          <label className="event-sort">Sort
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort companies">
              {recommendedIds.size > 0 && <option value="recommended">Recommended for you</option>}
              <option value="booth">Booth number</option>
              <option value="az">Name A → Z</option>
              <option value="za">Name Z → A</option>
            </select>
          </label>
        )}
      </div>

      {visible.length ? (
        <div className="exhibitor-grid">
          {visible.map((c) => (
            <ExhibitorCard
              key={c.id}
              company={c}
              onOpen={() => { setSelected(c); onOpenCompany?.(c); }}
              recommended={recommendedIds.has(c.id)}
            />
          ))}
        </div>
      ) : (
        <div className="empty"><strong>Company line-up coming soon</strong><p>Companies attending Industry Day will appear here.</p></div>
      )}

      {selected && (
        <CompanyDetail
          company={selected}
          jobs={jobs}
          isStudent={isStudent}
          course={course}
          onOpenJob={(job) => { setSelected(null); onOpenJob(job); }}
          onBookInterview={onBookInterview}
          canSeeVisits={canSeeVisits}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
