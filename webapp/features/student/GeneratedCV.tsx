import type { ResumeProfile } from "../../lib/data/types";

/** A block that only renders when its multiline body has content. */
function Block({ label, body }: { label: string; body?: string }) {
  if (!body || !body.trim()) return null;
  return (
    <section className="cv-block">
      <h3>{label}</h3>
      <p style={{ whiteSpace: "pre-wrap" }}>{body.trim()}</p>
    </section>
  );
}

/**
 * Renders a student's structured profile into a clean, printable CV. Shared by
 * the student's My Resume preview and the employer/admin resume viewer, so both
 * sides see exactly the same document. No file hosting needed.
 */
export function GeneratedCV({
  name,
  email,
  course,
  profile,
}: {
  name: string;
  email: string;
  course?: string | null;
  profile: ResumeProfile;
}) {
  const skills = (profile.skills ?? "").split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
  const links = (profile.links ?? []).map((l) => l.trim()).filter(Boolean);

  return (
    <article className="cv-sheet" aria-label={`Generated CV for ${name}`}>
      <header className="cv-head">
        <h2>{name}</h2>
        {profile.headline && <p className="cv-headline">{profile.headline}</p>}
        <p className="cv-contact">
          {[email, profile.phone, course].filter(Boolean).join("  ·  ")}
        </p>
        {links.length > 0 && (
          <p className="cv-links">
            {links.map((href) => (
              <a key={href} href={/^https?:\/\//i.test(href) ? href : `https://${href}`} target="_blank" rel="noreferrer">{href.replace(/^https?:\/\//i, "")}</a>
            ))}
          </p>
        )}
      </header>

      <Block label="Profile" body={profile.summary} />

      {(profile.fypTitle || profile.fypSummary) && (
        <section className="cv-block">
          <h3>Final-Year Project</h3>
          {profile.fypTitle && <p className="cv-fyp-title"><b>{profile.fypTitle}</b></p>}
          {profile.fypSummary && <p style={{ whiteSpace: "pre-wrap" }}>{profile.fypSummary.trim()}</p>}
        </section>
      )}

      {(profile.education || profile.cgpa) && (
        <section className="cv-block">
          <h3>Education</h3>
          {profile.cgpa && <p className="cv-cgpa"><b>CGPA:</b> {profile.cgpa}</p>}
          {profile.education && <p style={{ whiteSpace: "pre-wrap" }}>{profile.education.trim()}</p>}
        </section>
      )}

      <Block label="Experience" body={profile.experience} />

      {skills.length > 0 && (
        <section className="cv-block">
          <h3>Skills</h3>
          <div className="cv-skills">{skills.map((s) => <span key={s} className="cv-skill">{s}</span>)}</div>
        </section>
      )}

      <Block label="Achievements" body={profile.achievements} />
    </article>
  );
}
