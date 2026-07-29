// Pure helpers, constants, and view-only types for the vacancy feature.
// Extracted verbatim from the former app/page.tsx monolith — no behaviour change.
import type { Job } from "../../lib/data/types";
import { DEFAULT_YOUTUBE_PLACEHOLDER } from "../../app/auth-policy";

export type ChatMessage = { role: "user" | "assistant"; content: string; sources?: Job[] };
export type Theme = "light" | "dark";
export type TextScale = "default" | "large" | "xlarge";
export type CountryShape = { name: string; path: string };
export type GeoFeature = { properties: { name: string }; geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] } };
export type AdminDraft = Pick<Job, "title" | "company" | "type" | "specialization" | "vacancies" | "minimumRequirement" | "email"> & {
  salary: string;
  locationMode: "malaysia" | "international";
  state: string;
  country: string;
  youtubeUrl?: string;
  customSpecialization?: string;
  mapX?: number;
  mapY?: number;
};

export const DOSM_SOURCE = "https://www.dosm.gov.my/portal-main/release-content/salaries-and-wages-survey-report-2024";
export const PREFS_KEY = "vacancyportal-view-prefs";
export const emptyDraft: AdminDraft = { title: "", company: "", type: "Permanent", specialization: "", customSpecialization: "", locationMode: "malaysia", state: "", country: "", salary: "", vacancies: 1, minimumRequirement: "Diploma", email: "", youtubeUrl: DEFAULT_YOUTUBE_PLACEHOLDER };
export const malaysiaStates = ["Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan", "Pahang", "Pulau Pinang", "Perak", "Perlis", "Sabah", "Sarawak", "Selangor", "Terengganu", "W.P. Kuala Lumpur", "W.P. Labuan", "W.P. Putrajaya"];
export const malaysiaStateAliases: Record<string, string> = { "Kuala Lumpur": "W.P. Kuala Lumpur" };

export function countryPath(feature: GeoFeature) {
  const polygons = feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates as number[][][]]
    : feature.geometry.coordinates as number[][][][];
  return polygons.flatMap((polygon) => polygon.map((ring) => {
    let previousX: number | undefined;
    return ring.map(([longitude, latitude], index) => {
      const x = ((longitude + 180) / 360) * 1000;
      const y = ((90 - latitude) / 180) * 500;
      const command = index === 0 || (previousX !== undefined && Math.abs(x - previousX) > 500) ? "M" : "L";
      previousX = x;
      return `${command}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ") + " Z";
  })).join(" ");
}

export const salaryBenchmarks = [
  { match: /manufactur|engineering|quality|production|machine|operator/i, amount: 3278, label: "Manufacturing sector mean" },
  { match: /construction|architect|quantity|building|civil/i, amount: 3035, label: "Construction sector mean" },
  { match: /agri|farm|plantation/i, amount: 2409, label: "Agriculture sector mean" },
  { match: /clerical|administrative|secretarial|reception/i, amount: 2931, label: "Clerical support mean" },
  { match: /sales|retail|hotel|tourism|food|beverage|restaurant|customer service/i, amount: 2561, label: "Services and sales mean" },
  { match: /mining|quarry/i, amount: 5904, label: "Mining and quarrying sector mean" },
  { match: /software|information|technology|account|audit|bank|finance|education|health|marketing|design/i, amount: 3831, label: "Services sector mean" },
];

export function formatSalary(job: Pick<Job, "salary" | "payFrequency">) {
  return job.salary ? `RM ${job.salary.toLocaleString()} / ${job.payFrequency.toLowerCase()}` : "Salary not stated";
}

export function benchmarkFor(job: Pick<Job, "title" | "specialization">) {
  const haystack = `${job.title} ${job.specialization}`;
  const benchmark = salaryBenchmarks.find((item) => item.match.test(haystack)) ?? { amount: 3652, label: "Malaysia employee mean" };
  const minSalary = Math.round((benchmark.amount * 0.8) / 50) * 50;
  const maxSalary = Math.round((benchmark.amount * 1.25) / 50) * 50;
  return {
    ...benchmark,
    minSalary,
    maxSalary,
    rangeLabel: `RM ${minSalary.toLocaleString()} – RM ${maxSalary.toLocaleString()}`,
  };
}

export function roleDescription(job: Job) {
  const role = job.title.toLowerCase();
  const specialization = job.specialization.toLowerCase();
  let focus = `support day-to-day work in ${job.specialization.toLowerCase()}, coordinate assigned tasks, maintain accurate records, and communicate progress with the team`;
  if (/account|audit|tax|finance|bank/.test(role + specialization)) focus = "support financial records, reconciliations, reporting, documentation, and routine compliance work";
  else if (/software|developer|program|technology|digital/.test(role + specialization)) focus = "support digital systems, troubleshoot issues, document work, and contribute to assigned technical or product tasks";
  else if (/marketing|design|creative|content/.test(role + specialization)) focus = "help prepare campaigns or creative materials, coordinate content, and track the delivery of assigned marketing work";
  else if (/hotel|tourism|restaurant|food|chef|hospitality/.test(role + specialization)) focus = "support guest or food-service operations, follow service procedures, and help maintain a safe, organised customer experience";
  else if (/admin|clerical|reception|secretar/.test(role + specialization)) focus = "handle routine administration, organise documents, coordinate enquiries, and keep office information up to date";
  else if (/sales|retail|customer/.test(role + specialization)) focus = "assist customers, explain available products or services, follow up on enquiries, and maintain accurate sales records";
  else if (/engineer|technician|maintenance|production|quality/.test(role + specialization)) focus = "support technical or production work, follow safety and quality procedures, document findings, and escalate operational issues";
  return `This ${job.type.toLowerCase()} opportunity is expected to ${focus}. The listing asks for at least ${job.minimumRequirement.toLowerCase()} level and is based in ${job.location}. This overview is generated from the vacancy title and specialization; confirm exact duties with the employer.`;
}
