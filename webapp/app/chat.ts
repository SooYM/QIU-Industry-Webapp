import { generateSlmResponse } from "./slm-engine.ts";

export const AI_WARNING = "⚠️ AI can make mistakes — verify important details.";

export function withAiWarning(message: string) {
  return message.includes(AI_WARNING) ? message : `${message}\n\n${AI_WARNING}`;
}

export type JobRecord = {
  id: number;
  title: string;
  company: string;
  type: string;
  specialization: string;
  vacancies: number;
  location: string;
  salaryLabel: string;
  salary: number;
  payFrequency: string;
  minimumRequirement: string;
  email: string;
  companySummary: string;
  youtubeUrl?: string;
  createdBy?: string;
};

const stopWords = new Set([
  "the", "a", "an", "and", "or", "is", "are", "for", "to", "of", "in", "on", "with", "that", "which", "what",
  "show", "find", "me", "job", "jobs", "company", "companies", "any", "time", "now", "today", "date", "tell",
  "say", "get", "please", "how", "when", "where", "why", "who", "can", "you", "would", "could", "should", "it",
  "study", "studying", "student", "major", "majoring", "course", "faculty", "field", "learn", "learning", "taking",
  "want", "looking", "need"
]);

function tokens(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !stopWords.has(word));
}

/** Small typo matcher for company-name words only. */
function companyTokenMatches(queryToken: string, companyToken: string) {
  if (queryToken === companyToken) return true;
  if (queryToken.length < 4 || companyToken.length < 4 || Math.abs(queryToken.length - companyToken.length) > 2) return false;

  const rows = Array.from({ length: queryToken.length + 1 }, (_, i) =>
    Array.from({ length: companyToken.length + 1 }, (_, j) => i || j),
  );
  for (let i = 1; i <= queryToken.length; i += 1) {
    for (let j = 1; j <= companyToken.length; j += 1) {
      const cost = queryToken[i - 1] === companyToken[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && queryToken[i - 1] === companyToken[j - 2] && queryToken[i - 2] === companyToken[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
  }
  const maxDistance = Math.max(queryToken.length, companyToken.length) >= 8 ? 2 : 1;
  return rows[queryToken.length][companyToken.length] <= maxDistance;
}

function isComputingStudyArea(question: string) {
  return /\b(computer scienc(?:es?)?|software engineering|information technology|information systems|programming|coding)\b/i.test(question);
}

function isCulinaryStudyArea(question: string) {
  return /\b(culinary|culinary arts?|f&b|food|hotel|hospitality|gastronomy|baking|pastry|kitchen)\b/i.test(question);
}

export function retrieveJobs(question: string, jobs: JobRecord[]) {
  const queryTokens = tokens(question);
  const salaryMatch = question.match(/(?:rm|myr)\s*([\d,]+)/i);
  const requestedSalary = salaryMatch ? Number(salaryMatch[1].replace(",", "")) : 0;
  const wantsMinimum = /at least|minimum|above|more than|over/i.test(question);
  const wantsMaximum = /at most|maximum|below|less than|under/i.test(question);
  const mentionsIntern = /intern/i.test(question);
  const mentionsComputing = isComputingStudyArea(question);
  const mentionsCulinary = isCulinaryStudyArea(question);

  if (!queryTokens.length && !requestedSalary && !mentionsIntern && !mentionsComputing && !mentionsCulinary) {
    return [];
  }

  return jobs
    .map((job) => {
      let score = 0;
      const companyTokens = tokens(job.company);

      queryTokens.forEach((token) => {
        // Enforce exact word-boundary matching so "art" never matches "Smart" or "Department"
        const boundaryRegex = new RegExp(`\\b${token}\\b`, "i");

        const inTitle = boundaryRegex.test(job.title);
        const inSpec = boundaryRegex.test(job.specialization);
        const inCompany = companyTokens.some((companyToken) => companyTokenMatches(token, companyToken));
        const inLoc = boundaryRegex.test(job.location);
        const inReq = boundaryRegex.test(job.minimumRequirement);

        if (inTitle) score += 6;
        else if (inSpec) score += 5;
        else if (inCompany) score += 4;
        else if (inLoc) score += 3;
        else if (inReq) score += 2;
      });

      // Domain-specific faculty knowledge boosts
      if (mentionsComputing) {
        if (job.specialization === "IT - Software") score += 14;
        else if (["IT - Network/Sys/DB Admin", "IT - Hardware"].includes(job.specialization)) score += 8;
      }

      if (mentionsCulinary) {
        const culinaryRegex = /\b(culinary|f&b|food|hotel|hospitality|restaurant|catering|baking|chef)\b/i;
        const text = `${job.title} ${job.specialization} ${job.company}`.toLowerCase();
        if (culinaryRegex.test(text)) score += 16;
      }

      if (mentionsIntern && /intern/i.test(job.type + job.title)) score += 8;

      if (requestedSalary && job.salary) {
        if (wantsMinimum && job.salary >= requestedSalary) score += 6;
        else if (wantsMaximum && job.salary <= requestedSalary) score += 6;
        else if (!wantsMinimum && !wantsMaximum && Math.abs(job.salary - requestedSalary) <= 300) score += 4;
      }

      return { job, score };
    })
    .filter(({ score }) => score >= 4)
    .sort((a, b) => b.score - a.score || b.job.salary - a.job.salary)
    .slice(0, 8)
    .map(({ job }) => job);
}

export function answerFromJobs(question: string, jobs: JobRecord[]) {
  const response = generateSlmResponse(question, jobs);
  return { ...response, answer: withAiWarning(response.answer) };
}
