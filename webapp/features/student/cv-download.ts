import type { Resume } from "../../lib/data/types";

const esc = (s?: string) => (s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
const para = (s: string) => esc(s).replace(/\n/g, "<br>");

/**
 * Downloads a student's generated CV as a self-contained HTML file (no Storage
 * needed). Opening the file shows a clean CV that prints straight to PDF.
 * Shared by the student, employer and admin views.
 */
export function downloadCV(resume: Resume) {
  const p = resume.profile ?? {};
  const name = resume.studentName || resume.studentEmail || "Student";
  const block = (label: string, body?: string) => body && body.trim() ? `<section><h3>${esc(label)}</h3><p>${para(body.trim())}</p></section>` : "";
  const skills = (p.skills ?? "").split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
  const links = (p.links ?? []).map((l) => l.trim()).filter(Boolean);
  const contact = [resume.studentEmail, p.phone, resume.course].filter(Boolean).map(esc).join("  ·  ");

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(name)} — CV</title>
<style>
  *{box-sizing:border-box} body{margin:0;background:#eceef1;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#14181f}
  .sheet{max-width:800px;margin:2rem auto;background:#fff;padding:2.4rem 2.6rem;border-radius:.4rem;box-shadow:0 1rem 3rem rgba(0,0,0,.12);line-height:1.55;font-size:14px}
  h1{margin:0;font-size:2rem;letter-spacing:-.02em} .headline{margin:.25rem 0 0;font-weight:700;color:#3a4557}
  .contact{margin:.4rem 0 0;font-size:.8rem;color:#5a6474} .links{margin:.3rem 0 0;font-size:.8rem} .links a{color:#1a52c4;margin-right:.9rem}
  .head{border-bottom:2px solid #14181f;padding-bottom:.8rem;margin-bottom:1rem}
  section{margin-top:1.1rem} h3{margin:0 0 .35rem;font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;color:#1a52c4} p{margin:0;color:#2a3240}
  .skills span{display:inline-block;font-size:.78rem;font-weight:700;color:#1a52c4;background:#eef3fd;border:1px solid #d6e2fb;border-radius:.35rem;padding:.24rem .5rem;margin:0 .35rem .35rem 0}
  @media print{body{background:#fff}.sheet{box-shadow:none;margin:0;max-width:none}}
</style></head><body><div class="sheet">
  <div class="head"><h1>${esc(name)}</h1>${p.headline ? `<p class="headline">${esc(p.headline)}</p>` : ""}
    ${contact ? `<p class="contact">${contact}</p>` : ""}
    ${links.length ? `<p class="links">${links.map((h) => `<a href="${esc(/^https?:\/\//i.test(h) ? h : "https://" + h)}">${esc(h.replace(/^https?:\/\//i, ""))}</a>`).join("")}</p>` : ""}
  </div>
  ${block("Profile", p.summary)}
  ${(p.fypTitle || p.fypSummary) ? `<section><h3>Final-Year Project</h3>${p.fypTitle ? `<p><b>${esc(p.fypTitle)}</b></p>` : ""}${p.fypSummary ? `<p>${para(p.fypSummary)}</p>` : ""}</section>` : ""}
  ${(p.education || p.cgpa) ? `<section><h3>Education</h3>${p.cgpa ? `<p><b>CGPA:</b> ${esc(p.cgpa)}</p>` : ""}${p.education ? `<p>${para(p.education)}</p>` : ""}</section>` : ""}
  ${block("Experience", p.experience)}
  ${skills.length ? `<section><h3>Skills</h3><div class="skills">${skills.map((s) => `<span>${esc(s)}</span>`).join("")}</div></section>` : ""}
  ${block("Achievements", p.achievements)}
</div></body></html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `CV_${name.replace(/[^\w]+/g, "_")}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
