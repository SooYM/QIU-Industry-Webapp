import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Company, Job } from "../../lib/data/types";
import { isApprovedCompany } from "../../lib/data/types";
import { getYouTubeEmbedUrl } from "../../app/auth-policy";
import { useAuth } from "../../app/auth-context";
import { isApproved, logChat } from "../../lib/data/firestore";
import { jobMatchesCourse } from "../../lib/data/course-map";
import { companyNamesMatch } from "../../lib/data/company-matching";
import { AI_WARNING, withAiWarning } from "../../app/chat";
import { RichText } from "../../app/RichText";
import { Modal } from "../../components/Modal";
import { useLogoBackdrop } from "./useLogoBackdrop";

/** Deterministic answer grounded ONLY in this company's profile + its vacancies. */
function answerAboutCompany(question: string, company: Company, jobs: Job[]): string {
  const q = question.toLowerCase();
  const has = (re: RegExp) => re.test(q);
  const parts: string[] = [];

  if (has(/vacan|job|hir|role|position|opening|intern|apply|career/)) {
    parts.push(jobs.length
      ? `**${company.name}** currently lists ${jobs.length} ${jobs.length === 1 ? "vacancy" : "vacancies"}:\n\n${jobs.map((j) => `- **${j.title}** (${j.type}, ${j.location})`).join("\n")}`
      : `**${company.name}** has no open vacancies listed on the portal right now.`);
  }
  if (has(/booth|stand|where|find|located|location/) && company.boothNumber) parts.push(`Visit them at **booth ${company.boothNumber}**.`);
  if (has(/website|site|link|url/)) parts.push(company.website ? `Their website: ${company.website}` : "No website is listed on their profile.");
  if (has(/video|watch/)) parts.push(company.videoUrl ? "There's a corporate video on their profile — scroll up to watch it." : "No corporate video is listed on their profile.");
  if (has(/who|about|what.*do|company|overview|background/) && company.summary) parts.push(company.summary);

  if (parts.length) return parts.join("\n\n");
  const bits = [company.summary, company.boothNumber && `They are at booth ${company.boothNumber}.`, jobs.length && `They list ${jobs.length} ${jobs.length === 1 ? "vacancy" : "vacancies"}.`].filter(Boolean).join(" ");
  return bits || `This is **${company.name}**'s profile. Ask about their vacancies, booth or website.`;
}

/** Grounded assistant scoped to a SINGLE company. Streams the answer and auto-scrolls. */
function CompanyAssistant({ company, jobs }: { company: Company; jobs: Job[] }) {
  const { user, employeeId } = useAuth();
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
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, open]);

  function ask(event: FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || streaming) return;
    setInput("");
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
        <span aria-hidden="true">✦</span> Chat with AI about {company.name} <span aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <>
          <div className="job-assistant-messages" ref={boxRef} aria-live="polite">
            {messages.map((m, i) => <div key={i} className={`message ${m.role}`}><RichText content={m.content} /></div>)}
          </div>
          <form className="chat-form" onSubmit={ask}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Ask about ${company.name}…`} aria-label="Ask about this company" />
            <button disabled={!input.trim() || streaming} aria-label="Send question">↑</button>
          </form>
          <div ref={endRef} aria-hidden="true" />
        </>
      )}
    </section>
  );
}

function CompanyDetail({ company, jobs, isStudent, course, onOpenJob, onClose }: {
  company: Company;
  jobs: Job[];
  isStudent: boolean;
  course: string | null;
  onOpenJob: (job: Job) => void;
  onClose: () => void;
}) {
  const embedUrl = getYouTubeEmbedUrl(company.videoUrl);
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
                    {matched && <span className="rounded px-1.5 py-0.5 text-[10px] font-bold tone-success">🌟 Matches your profile</span>}
                    <span className="view-job">View →</span>
                  </button>
                );
              })}
            </div>
          ) : <p className="text-accent text-sm">No vacancies listed from this company yet.</p>}
        </section>

        {embedUrl && (
          <section className="mt-4">
            <span className="detail-label">🎬 CORPORATE VIDEO</span>
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
        {company.website && <span className="exhibitor-tag">🌐 Website</span>}
        {company.videoUrl && <span className="exhibitor-tag">🎬 Video</span>}
      </div>
      {recommended && <span className="rounded px-1.5 py-0.5 text-[10px] font-bold tone-success mt-1">🌟 Has vacancies matching your profile</span>}
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
}: {
  companies: Company[];
  jobs: Job[];
  isStudent: boolean;
  course: string | null;
  settings: { portalTitle: string; portalTagline: string };
  onOpenJob: (job: Job) => void;
}) {
  const [selected, setSelected] = useState<Company | null>(null);
  const [sort, setSort] = useState<"recommended" | "booth" | "az" | "za">("booth");

  // Companies worth recommending: any of their approved vacancies fits the student's
  // course — even when the company's own industry differs (an F1 team hiring an AI
  // engineer still fits a Computer Science student).
  const recommendedIds = useMemo(() => {
    if (!isStudent || !course) return new Set<number>();
    const ids = new Set<number>();
    for (const c of companies) {
      if (jobs.some((j) => companyNamesMatch(j.company, c.name) && isApproved(j) && jobMatchesCourse(j, course))) ids.add(c.id);
    }
    return ids;
  }, [companies, jobs, isStudent, course]);

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
              onOpen={() => setSelected(c)}
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
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
