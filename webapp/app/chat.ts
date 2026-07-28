import { generateSlmResponse, SLM_MODEL_INFO } from "./slm-engine";

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
};

const stopWords = new Set([
  "the", "a", "an", "and", "or", "is", "are", "for", "to", "of", "in", "on", "with", "that", "which", "what",
  "show", "find", "me", "job", "jobs", "company", "companies", "any", "time", "now", "today", "date", "tell",
  "say", "get", "please", "how", "when", "where", "why", "who", "can", "you", "would", "could", "should", "it"
]);

function tokens(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !stopWords.has(word));
}

function isComputingStudyArea(question: string) {
  return /\b(computer scienc(?:es?)?|software engineering|information technology|information systems|programming|coding)\b/i.test(question);
}

function checkConversationalIntent(question: string): { isConversational: boolean; response?: string } {
  const q = question.trim().toLowerCase();

  // Time / Date intent
  if (/\b(what.*time|current time|time now|clock|what.*date|today.*date)\b/i.test(q)) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    return {
      isConversational: true,
      response: `The current local time is **${timeStr}** (${dateStr}).\n\nAs the VacancyPortal Job Assistant, I specialize in searching job listings, comparing salaries, and matching roles to your academic profile. How can I help with your job search today?`
    };
  }

  // Greetings intent
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|greetings)[\s!.]*$/i.test(q) || /^who are you\??$/i.test(q) || /^what can you do\??$/i.test(q)) {
    return {
      isConversational: true,
      response: `Hello! I am your VacancyPortal AI Assistant. I can help you search vacancies, compare salaries, find internships, or match jobs to your academic results. What type of role or specialization are you looking for?`
    };
  }

  return { isConversational: false };
}

export function retrieveJobs(question: string, jobs: JobRecord[]) {
  const queryTokens = tokens(question);
  const salaryMatch = question.match(/(?:rm|myr)\s*([\d,]+)/i);
  const requestedSalary = salaryMatch ? Number(salaryMatch[1].replace(",", "")) : 0;
  const wantsMinimum = /at least|minimum|above|more than|over/i.test(question);
  const wantsMaximum = /at most|maximum|below|less than|under/i.test(question);
  const mentionsIntern = /intern/i.test(question);
  const mentionsComputing = isComputingStudyArea(question);

  if (!queryTokens.length && !requestedSalary && !mentionsIntern && !mentionsComputing) {
    return [];
  }

  return jobs
    .map((job) => {
      const text = `${job.title} ${job.company} ${job.type} ${job.specialization} ${job.location} ${job.minimumRequirement}`.toLowerCase();
      let score = queryTokens.reduce((total, token) => {
        const inTitle = job.title.toLowerCase().includes(token);
        const inCompany = job.company.toLowerCase().includes(token);
        const inSpec = job.specialization.toLowerCase().includes(token);
        const inLoc = job.location.toLowerCase().includes(token);
        
        if (inTitle) return total + 5;
        if (inSpec) return total + 4;
        if (inCompany) return total + 3;
        if (inLoc) return total + 3;
        if (text.includes(token)) return total + 2;
        return total;
      }, 0);

      if (mentionsComputing) {
        if (job.specialization === "IT - Software") score += 12;
        else if (["IT - Network/Sys/DB Admin", "IT - Hardware"].includes(job.specialization)) score += 7;
      }
      if (mentionsIntern && /intern/i.test(job.type + job.title)) score += 8;
      if (requestedSalary && job.salary) {
        if (wantsMinimum && job.salary >= requestedSalary) score += 6;
        else if (wantsMaximum && job.salary <= requestedSalary) score += 6;
        else if (!wantsMinimum && !wantsMaximum && Math.abs(job.salary - requestedSalary) <= 300) score += 4;
      }
      return { job, score };
    })
    .filter(({ score }) => score >= 3)
    .sort((a, b) => b.score - a.score || b.job.salary - a.job.salary)
    .slice(0, 8)
    .map(({ job }) => job);
}

export function answerFromJobs(question: string, jobs: JobRecord[]) {
  return generateSlmResponse(question, jobs);
}
