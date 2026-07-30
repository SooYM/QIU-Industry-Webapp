import { FormEvent, useEffect, useRef, useState } from "react";
import type { Company, Job } from "../../lib/data/types";
import { isApprovedCompany } from "../../lib/data/types";
import { getYouTubeEmbedUrl } from "../../app/auth-policy";
import { useAuth } from "../../app/auth-context";
import { isApproved, logChat } from "../../lib/data/firestore";
import { jobMatchesCourse } from "../../lib/data/course-map";
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
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: `Ask me about **${company.name}** — their vacancies, booth or profile. I only answer from this company's details.` },
  ]);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => { const el = boxRef.current; if (el) el.scrollTop = el.scrollHeight; }, [messages, open]);

  function ask(event: FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || streaming) return;
    setInput("");
    const answer = answerAboutCompany(question, company, jobs);
    setMessages((m) => [...m, { role: "user", content: question }, { role: "assistant", content: "" }]);
    setStreaming(true);
    let i = 0;
    const stream = () => {
      i += 3;
      setMessages((m) => { const copy = m.slice(); copy[copy.length - 1] = { role: "assistant", content: answer.slice(0, i) }; return copy; });
      if (i < answer.length) window.setTimeout(stream, 16); else setStreaming(false);
    };
    window.setTimeout(stream, 60);
    if (user) {
      logChat({ id: `${user.uid}_${Date.now()}`, studentUid: user.uid, studentEmail: user.email ?? "", studentName: user.displayName || user.email || "Anonymous", company: company.name, question, answer }).catch(() => {});
    }
  }

  return (
    <section className="job-assistant mt-4">
      <button type="button" className="job-assistant-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span aria-hidden="true">✦</span> Ask about {company.name} <span aria-hidden="true">{open ? "▲" : "▼"}</span>
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
  const hasVideo = Boolean(company.videoUrl && company.videoUrl.trim());
  const backdrop = useLogoBackdrop(company.logoUrl, company.logoBackground ?? "auto");
  const companyJobs = jobs.filter((j) => j.company === company.name && isApproved(j));

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

        {hasVideo && (
          <section className="mt-4">
            <span className="detail-label">🎬 CORPORATE VIDEO</span>
            <div className="overflow-hidden rounded-xl border border-token mt-1.5">
              <iframe src={getYouTubeEmbedUrl(company.videoUrl)} title={`${company.name} corporate video`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full aspect-video rounded-xl border-0" />
            </div>
          </section>
        )}

        <CompanyAssistant company={company} jobs={companyJobs} />
      </div>
    </Modal>
  );
}

function ExhibitorCard({ company, onOpen }: { company: Company; onOpen: () => void }) {
  const backdrop = useLogoBackdrop(company.logoUrl, company.logoBackground ?? "auto");
  const [logoOk, setLogoOk] = useState(true);
  return (
    <article className="exhibitor-card" role="button" tabIndex={0}
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
  const visible = companies.filter(isApprovedCompany);

  return (
    <section className="results" aria-labelledby="home-title">
      <div className="results-head">
        <div><span>WELCOME</span><h1 id="home-title">{settings.portalTitle}</h1></div>
        <p>{settings.portalTagline}</p>
      </div>

      <div className="section-heading"><div><span>EXHIBITORS</span><h2>Companies attending</h2></div></div>

      {visible.length ? (
        <div className="exhibitor-grid">
          {visible.map((c) => <ExhibitorCard key={c.id} company={c} onOpen={() => setSelected(c)} />)}
        </div>
      ) : (
        <div className="empty"><strong>Exhibitor line-up coming soon</strong><p>Companies attending Industry Day will appear here.</p></div>
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
