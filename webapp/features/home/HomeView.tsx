import { useState } from "react";
import type { Company } from "../../lib/data/types";
import { getYouTubeEmbedUrl } from "../../app/auth-policy";
import { Modal } from "../../components/Modal";
import { useLogoBackdrop } from "./useLogoBackdrop";

function CompanyDetail({ company, onClose }: { company: Company; onClose: () => void }) {
  const hasVideo = Boolean(company.videoUrl && company.videoUrl.trim());
  const backdrop = useLogoBackdrop(company.logoUrl, company.logoBackground ?? "auto");
  return (
    <Modal className="job-detail" labelledBy="company-detail-title" closeLabel="Close company profile" onClose={onClose}>
      <div className="detail-header">
        <div className="flex items-center gap-3">
          {company.logoUrl && <img className={`exhibitor-logo-lg logo-${backdrop}`} src={company.logoUrl} alt={company.name} />}
          <div>
            <h2 id="company-detail-title">{company.name}</h2>
            {company.website && <p><a href={company.website} target="_blank" rel="noreferrer">{company.website.replace(/^https?:\/\//i, "")} ↗</a></p>}
          </div>
        </div>
      </div>
      <div className="detail-main">
        {company.summary && <section><span className="detail-label">ABOUT</span><p style={{ whiteSpace: "pre-wrap" }}>{company.summary}</p></section>}
        {hasVideo && (
          <section className="mt-4">
            <span className="detail-label">🎬 COMPANY VIDEO</span>
            <div className="overflow-hidden rounded-xl border border-token mt-1.5">
              <iframe src={getYouTubeEmbedUrl(company.videoUrl)} title={`${company.name} video`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full aspect-video rounded-xl border-0" />
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}

function ExhibitorCard({ company, onOpen }: { company: Company; onOpen: () => void }) {
  const backdrop = useLogoBackdrop(company.logoUrl, company.logoBackground ?? "auto");
  return (
    <article className="exhibitor-card" role="button" tabIndex={0}
      aria-label={`View ${company.name}`}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}>
      <div className={`exhibitor-logo-wrap logo-${backdrop}`}>
        {company.logoUrl ? <img src={company.logoUrl} alt={company.name} /> : <span className="exhibitor-logo-fallback">{company.name.slice(0, 2).toUpperCase()}</span>}
      </div>
      <h3>{company.name}</h3>
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
  settings,
}: {
  companies: Company[];
  settings: { portalTitle: string; portalTagline: string };
}) {
  const [selected, setSelected] = useState<Company | null>(null);

  return (
    <section className="results" aria-labelledby="home-title">
      <div className="results-head">
        <div><span>WELCOME</span><h1 id="home-title">{settings.portalTitle}</h1></div>
        <p>{settings.portalTagline}</p>
      </div>

      <div className="section-heading"><div><span>EXHIBITORS</span><h2>Companies attending</h2></div></div>

      {companies.length ? (
        <div className="exhibitor-grid">
          {companies.map((c) => <ExhibitorCard key={c.id} company={c} onOpen={() => setSelected(c)} />)}
        </div>
      ) : (
        <div className="empty"><strong>Exhibitor line-up coming soon</strong><p>Companies attending Industry Day will appear here.</p></div>
      )}

      {selected && <CompanyDetail company={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}
