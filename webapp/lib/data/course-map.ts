// QIU programme catalogue — the single source of truth for course knowledge.
// Generated from Programes/qiu_all_programmes.csv (Faculty, Name, Abbreviation, Level).
// A student's Google Workspace directory field carries an abbreviation (e.g. "BCS");
// we resolve it to the full programme, its level, and the vacancy specialization
// it should recommend. Keep this in sync with the CSV as programmes change.

export type ProgrammeLevel = "Foundation" | "Diploma" | "Bachelor" | "Master" | "Doctorate";

export interface Programme {
  name: string;
  /** Primary area of study, from Programes/qiu_programmes_industry_mapping.csv.
   *  This is what a company picks in "Students you are looking for" — 12 areas
   *  instead of 43 individual programmes. */
  area: string;
  level: ProgrammeLevel;
  faculty: string;
}

// Keyed by abbreviation. Note: "FIA" is shared by two programmes in the CSV
// (ACCA Foundation in Accountancy / Foundation in Arts); the Accountancy entry
// is kept here — both are Foundation level so recommendation impact is minimal.
export const PROGRAMMES: Record<string, Programme> = {
  // Faculty of Business and Management
  FIA: { name: "ACCA Foundation in Accountancy", area: "Accounting & Finance", level: "Foundation", faculty: "Business and Management" },
  FIB: { name: "Foundation in Business", area: "Business Management & Administration", level: "Foundation", faculty: "Business and Management" },
  DBM: { name: "Diploma in Business Management", area: "Business Management & Administration", level: "Diploma", faculty: "Business and Management" },
  DCA: { name: "Diploma in Culinary Arts", area: "Hospitality Tourism & Culinary Arts", level: "Diploma", faculty: "Business and Management" },
  DHM: { name: "Diploma in Hotel Management", area: "Hospitality Tourism & Culinary Arts", level: "Diploma", faculty: "Business and Management" },
  BBA: { name: "Bachelor of Business Administration (Honours)", area: "Business Management & Administration", level: "Bachelor", faculty: "Business and Management" },
  BAC: { name: "Bachelor of Accountancy (Honours)", area: "Accounting & Finance", level: "Bachelor", faculty: "Business and Management" },
  BHM: { name: "Bachelor of Hospitality Management (Honours)", area: "Hospitality Tourism & Culinary Arts", level: "Bachelor", faculty: "Business and Management" },
  BCA: { name: "Bachelor in Culinary Arts (Honours)", area: "Hospitality Tourism & Culinary Arts", level: "Bachelor", faculty: "Business and Management" },
  BFN: { name: "Bachelor of Finance (Hons)", area: "Accounting & Finance", level: "Bachelor", faculty: "Business and Management" },
  MBA: { name: "Master of Business Administration (Blended & Modular)", area: "Business Management & Administration", level: "Master", faculty: "Business and Management" },
  "MBA-ODL": { name: "Master of Business Administration (ODL)", area: "Business Management & Administration", level: "Master", faculty: "Business and Management" },
  "PhD-BA": { name: "Doctor of Philosophy in Business Administration", area: "Business Management & Administration", level: "Doctorate", faculty: "Business and Management" },

  // Faculty of Computing and Engineering
  DME: { name: "Diploma in Mechatronics Engineering", area: "Engineering & Industrial Technology", level: "Diploma", faculty: "Computing and Engineering" },
  DIT: { name: "Diploma in Information Technology", area: "Computer Science & Information Technology", level: "Diploma", faculty: "Computing and Engineering" },
  BME: { name: "Bachelor of Mechatronics Engineering With Honours", area: "Engineering & Industrial Technology", level: "Bachelor", faculty: "Computing and Engineering" },
  BCS: { name: "Bachelor of Computer Science (Hons)", area: "Computer Science & Information Technology", level: "Bachelor", faculty: "Computing and Engineering" },
  BIT: { name: "Bachelor of Information Technology (Hons)", area: "Computer Science & Information Technology", level: "Bachelor", faculty: "Computing and Engineering" },
  BAS: { name: "Bachelor of Science (Honours) Actuarial Sciences", area: "Actuarial Science Mathematics & Statistics", level: "Bachelor", faculty: "Computing and Engineering" },
  BET: { name: "Bachelor of Electronics Technology with Honours", area: "Engineering & Industrial Technology", level: "Bachelor", faculty: "Computing and Engineering" },
  MCP: { name: "Master in Computing", area: "Computer Science & Information Technology", level: "Master", faculty: "Computing and Engineering" },
  "PhD-CP": { name: "Doctor of Philosophy in Computing", area: "Computer Science & Information Technology", level: "Doctorate", faculty: "Computing and Engineering" },

  // Faculty of Integrated Life Sciences
  FIS: { name: "Foundation in Science", area: "Biological Environmental & Life Sciences", level: "Foundation", faculty: "Integrated Life Sciences" },
  DET: { name: "Diploma in Environmental Technology", area: "Biological Environmental & Life Sciences", level: "Diploma", faculty: "Integrated Life Sciences" },
  BEN: { name: "Bachelor of Environmental Technology (Honours)", area: "Biological Environmental & Life Sciences", level: "Bachelor", faculty: "Integrated Life Sciences" },
  BFS: { name: "Bachelor in Food Science with Management (Honours)", area: "Biological Environmental & Life Sciences", level: "Bachelor", faculty: "Integrated Life Sciences" },
  BBT: { name: "Bachelor of Science in Biotechnology (Honours)", area: "Biological Environmental & Life Sciences", level: "Bachelor", faculty: "Integrated Life Sciences" },
  MSC: { name: "Master of Science", area: "Biological Environmental & Life Sciences", level: "Master", faculty: "Integrated Life Sciences" },
  "PhD-SC": { name: "Doctor of Philosophy in Science", area: "Biological Environmental & Life Sciences", level: "Doctorate", faculty: "Integrated Life Sciences" },

  // Faculty of Social Sciences
  DEC: { name: "Diploma in Early Childhood Education", area: "Education & Pedagogy", level: "Diploma", faculty: "Social Sciences" },
  BCC: { name: "Bachelor of Corporate Communication (Honours)", area: "Media Communication & Advertising", level: "Bachelor", faculty: "Social Sciences" },
  BMJ: { name: "Bachelor of Mass Communication (Honours) Journalism", area: "Media Communication & Advertising", level: "Bachelor", faculty: "Social Sciences" },
  BMA: { name: "Bachelor of Mass Communication (Honours) Advertising", area: "Media Communication & Advertising", level: "Bachelor", faculty: "Social Sciences" },
  BEC: { name: "Bachelor in Early Childhood Education (Honours)", area: "Education & Pedagogy", level: "Bachelor", faculty: "Social Sciences" },
  BPY: { name: "Bachelor of Psychology (Honours)", area: "Social Sciences & Psychology", level: "Bachelor", faculty: "Social Sciences" },
  BSN: { name: "Bachelor of Special Needs Education (Honours)", area: "Education & Pedagogy", level: "Bachelor", faculty: "Social Sciences" },
  BTE: { name: "Bachelor of Arts (Honours) Teaching of English as a Second Language", area: "Education & Pedagogy", level: "Bachelor", faculty: "Social Sciences" },
  MED: { name: "Master of Education", area: "Education & Pedagogy", level: "Master", faculty: "Social Sciences" },
  MTE: { name: "Master of Arts in Teaching of English as a Second Language", area: "Education & Pedagogy", level: "Master", faculty: "Social Sciences" },
  MCM: { name: "Master of Communication", area: "Media Communication & Advertising", level: "Master", faculty: "Social Sciences" },
  MSN: { name: "Master in Special Needs Education", area: "Education & Pedagogy", level: "Master", faculty: "Social Sciences" },

  // Faculty of Medicine
  MBBS: { name: "Bachelor of Medicine and Bachelor of Surgery (MBBS)", area: "Medicine Biomedical & Healthcare", level: "Bachelor", faculty: "Medicine" },
  BMS: { name: "Bachelor of Biomedical Sciences (Hons)", area: "Medicine Biomedical & Healthcare", level: "Bachelor", faculty: "Medicine" },
  MMS: { name: "Master of Medical Science", area: "Medicine Biomedical & Healthcare", level: "Master", faculty: "Medicine" },
  "PhD-MS": { name: "Doctor of Philosophy in Medical Science", area: "Medicine Biomedical & Healthcare", level: "Doctorate", faculty: "Medicine" },

  // Faculty of Pharmacy
  BPH: { name: "Bachelor of Pharmacy with Honours", area: "Pharmacy & Pharmaceutical Sciences", level: "Bachelor", faculty: "Pharmacy" },
  PharmD: { name: "Pharmacy Bridge Programme (Doctor of Pharmacy USA)", area: "Pharmacy & Pharmaceutical Sciences", level: "Doctorate", faculty: "Pharmacy" },
  MPS: { name: "Master in Pharmaceutical Sciences", area: "Pharmacy & Pharmaceutical Sciences", level: "Master", faculty: "Pharmacy" },
  "PhD-PS": { name: "Doctor of Philosophy in Pharmaceutical Sciences", area: "Pharmacy & Pharmaceutical Sciences", level: "Doctorate", faculty: "Pharmacy" },
};

/** Legacy shape kept for callers that only need abbreviation → programme name. */
export const COURSE_CODES: Record<string, string> = Object.fromEntries(
  Object.entries(PROGRAMMES).map(([code, p]) => [code, p.name]),
);

/**
 * The 12 areas of study, derived from the catalogue above so the list can never
 * drift from the programmes. A company picks from these in "Students you are
 * looking for"; a student is recommended a company when their programme's area
 * is among them.
 */
export const AREAS_OF_STUDY: string[] = [...new Set(Object.values(PROGRAMMES).map((p) => p.area))]
  .sort((a, b) => a.localeCompare(b));

/**
 * The area of study behind a raw course value ("BCS", "Bachelor of Computer
 * Science", "BCS - Year 2"). Null when the value matches no known programme —
 * a free-text course cannot be placed in an area, so it recommends nothing.
 */
export function courseArea(raw: string | null | undefined): string | null {
  const resolved = resolveCourse(raw);
  if (!resolved?.code) return null;
  return PROGRAMMES[resolved.code]?.area ?? null;
}

export interface ResolvedCourse {
  code: string;
  name: string;
  level: ProgrammeLevel | null;
  faculty: string | null;
}

/**
 * Normalise a raw directory value ("BCS", "BCS - Year 2", "Bachelor of Computer
 * Science") to a known programme. Matches an abbreviation first (longest code
 * first so "MBA-ODL" wins over "MBA"), then falls back to a programme-name match,
 * then to free text.
 */
export function resolveCourse(raw: string | null | undefined): ResolvedCourse | null {
  if (!raw) return null;
  const upper = raw.toUpperCase();
  const code = Object.keys(PROGRAMMES)
    .sort((a, b) => b.length - a.length)
    .find((c) => new RegExp(`\\b${c}\\b`).test(upper));
  if (code) {
    const p = PROGRAMMES[code];
    return { code, name: p.name, level: p.level, faculty: p.faculty };
  }
  const byName = Object.entries(PROGRAMMES).find(([, p]) => raw.toLowerCase().includes(p.name.toLowerCase()));
  if (byName) {
    const [c, p] = byName;
    return { code: c, name: p.name, level: p.level, faculty: p.faculty };
  }
  return { code: "", name: raw.trim(), level: null, faculty: null };
}

/**
 * Given a programme name (or faculty), return a regex matching the vacancy
 * `specialization` values it should surface, or null to show all.
 */
export function courseToSpecializationPattern(course: string): RegExp | null {
  const h = course.toLowerCase();
  if (/computer science|information technology|computing|software|actuarial/.test(h)) return /^IT\b|IT\s*-|Software/i;
  if (/mechatronics|electronic|engineering/.test(h)) return /manufacturing|engineering/i;
  if (/accountanc|accounting|finance|acca/.test(h)) return /accounting|finance/i;
  if (/business|management|administration/.test(h)) return /marketing\/business|business/i;
  if (/communication|journalism|advertising|media/.test(h)) return /digital marketing|advertising|creative|journalist/i;
  if (/hospitality|hotel|tourism|culinary/.test(h)) return /hotel|tourism|food/i;
  if (/food science|biotechnology|environmental/.test(h)) return /food tech|nutritionist|manufacturing/i;
  if (/education|early childhood|tesl|teaching|special needs/.test(h)) return /education/i;
  if (/psychology/.test(h)) return /human resources|education/i;
  // Medicine & Pharmacy have no matching Industry Day specialization yet → show all.
  return null;
}

/** True when a vacancy fits the student's course (by specialization or title). */
export function jobMatchesCourse(
  job: { title: string; specialization: string },
  course: string | null | undefined,
): boolean {
  if (!course) return false;
  const pattern = courseToSpecializationPattern(course);
  if (!pattern) return false;
  return pattern.test(job.specialization) || pattern.test(job.title);
}
