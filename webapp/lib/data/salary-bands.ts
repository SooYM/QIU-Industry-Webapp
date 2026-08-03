// Indicative Malaysian monthly salary ranges by job title, shown to employers as
// a reference while posting a vacancy. Matched loosely against the typed title;
// never enforced as a hiring or compensation requirement.

export const SALARY_REFERENCE_URL = "https://fastlanerecruit.com/blog/average-salary-in-malaysia-2025/#average-salary-by-job-role-and-industry-2025-in-malaysia";
export const SALARY_REFERENCE_LABEL = "FastLaneRecruit Malaysia salary guide 2025";

export interface SalaryBand { title: string; range: string; }

export const SALARY_BANDS: SalaryBand[] = [
  { title: "Software Developer / Engineer", range: "RM 5,000 - 8,000" },
  { title: "DevOps Engineer", range: "RM 7,000 - 12,000" },
  { title: "Cybersecurity Analyst", range: "RM 4,000 - 8,000" },
  { title: "Senior Penetration Tester", range: "RM 14,000 - 22,000" },
  { title: "Data Scientist / Data Analyst", range: "RM 6,500 - 10,500" },
  { title: "AI / Machine Learning Engineer", range: "RM 8,000 - 15,000" },
  { title: "IT Project Manager", range: "RM 9,000 - 14,000" },
  { title: "CTO / Head of Technology", range: "RM 18,000 - 30,000+" },
  { title: "Credit Analyst", range: "RM 4,500 - 6,500" },
  { title: "Relationship Manager (Corporate)", range: "RM 6,000 - 9,000" },
  { title: "Investment Analyst", range: "RM 6,500 - 10,000" },
  { title: "Financial Controller", range: "RM 8,500 - 14,000" },
  { title: "Risk & Compliance Manager", range: "RM 7,000 - 12,000" },
  { title: "Chief Financial Officer (CFO)", range: "RM 20,000 - 45,000+" },
  { title: "Registered Nurse", range: "RM 3,800 - 5,000" },
  { title: "General Practitioner (GP)", range: "RM 6,000 - 8,500" },
  { title: "Pharmacist", range: "RM 4,500 - 6,500" },
  { title: "Specialist Doctor (e.g., Cardiologist)", range: "RM 12,000 - 25,000+" },
  { title: "Medical Lab Technologist", range: "RM 3,500 - 5,500" },
  { title: "Hospital Administrator", range: "RM 6,000 - 10,000" },
  { title: "Mechanical Engineer", range: "RM 4,000 - 6,500" },
  { title: "Electrical Engineer", range: "RM 4,500 - 7,000" },
  { title: "Civil Engineer", range: "RM 4,000 - 6,800" },
  { title: "Project Engineer", range: "RM 5,000 - 7,500" },
  { title: "Engineering Manager", range: "RM 8,000 - 12,000" },
  { title: "Production Operator", range: "RM 2,200 - 3,000" },
  { title: "Quality Assurance Technician", range: "RM 3,200 - 4,500" },
  { title: "Production Supervisor", range: "RM 4,000 - 5,500" },
  { title: "Industrial Engineer", range: "RM 4,500 - 6,500" },
  { title: "Plant Manager", range: "RM 8,000 - 12,000" },
  { title: "Sales Executive", range: "RM 3,500 - 5,000" },
  { title: "Digital Marketing Specialist", range: "RM 4,000 - 6,500" },
  { title: "Key Account Manager", range: "RM 6,000 - 9,000" },
  { title: "Marketing Manager", range: "RM 6,500 - 10,000" },
  { title: "Chief Marketing Officer (CMO)", range: "RM 18,000 - 30,000+" },
  { title: "Primary School Teacher (Govt.)", range: "RM 2,800 - 4,000" },
  { title: "Secondary School Teacher (Private)", range: "RM 3,500 - 5,000" },
  { title: "University Lecturer", range: "RM 4,500 - 6,500" },
  { title: "Corporate Trainer", range: "RM 5,000 - 8,000" },
  { title: "Head of Academic Department", range: "RM 7,000 - 10,000" },
  { title: "Admin Assistant", range: "RM 2,500 - 3,500" },
  { title: "Customer Service Officer", range: "RM 2,800 - 4,000" },
  { title: "HR Assistant", range: "RM 3,000 - 4,200" },
  { title: "Office Manager", range: "RM 4,000 - 5,500" },
  { title: "Executive Assistant to CEO", range: "RM 5,500 - 7,500" },
  { title: "Retail Sales Associate", range: "RM 2,200 - 3,200" },
  { title: "Front Desk Officer (Hotel)", range: "RM 2,400 - 3,500" },
  { title: "Barista / Waitstaff", range: "RM 2,000 - 3,000" },
  { title: "Outlet Supervisor", range: "RM 3,500 - 4,800" },
  { title: "Hotel General Manager", range: "RM 8,000 - 12,000" },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * Best-effort salary range for a typed job title. Exact-ish match first, then a
 * token-overlap fallback so "Senior Software Engineer" still finds "Software
 * Developer / Engineer". Returns null when nothing is close enough.
 */
export function salaryBandFor(title: string): string | null {
  const q = norm(title);
  if (!q) return null;
  const qTokens = new Set(q.split(" ").filter((t) => t.length > 2));
  if (!qTokens.size) return null;
  let best: { range: string; score: number } | null = null;
  for (const band of SALARY_BANDS) {
    const bTokens = norm(band.title).split(" ").filter((t) => t.length > 2);
    if (!bTokens.length) continue;
    let hits = 0;
    for (const t of bTokens) if (qTokens.has(t)) hits++;
    const score = hits / bTokens.length;
    if (score > 0 && (!best || score > best.score)) best = { range: band.range, score };
  }
  return best && best.score >= 0.5 ? best.range : null;
}
