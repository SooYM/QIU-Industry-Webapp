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

const stopWords = new Set(["the", "a", "an", "and", "or", "is", "are", "for", "to", "of", "in", "on", "with", "that", "which", "what", "show", "find", "me", "job", "jobs", "company", "companies", "any"]);

function tokens(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((word) => word.length > 1 && !stopWords.has(word));
}

function isComputingStudyArea(question: string) {
  return /\b(computer scienc(?:es?)?|software engineering|information technology|information systems|programming|coding)\b/i.test(question);
}

export function retrieveJobs(question: string, jobs: JobRecord[]) {
  const queryTokens = tokens(question);
  const salaryMatch = question.match(/(?:rm|myr)\s*([\d,]+)/i);
  const requestedSalary = salaryMatch ? Number(salaryMatch[1].replace(",", "")) : 0;
  const wantsMinimum = /at least|minimum|above|more than|over/i.test(question);
  const wantsMaximum = /at most|maximum|below|less than|under/i.test(question);

  return jobs.map((job) => {
    const text = `${job.title} ${job.company} ${job.type} ${job.specialization} ${job.location} ${job.minimumRequirement}`.toLowerCase();
    let score = queryTokens.reduce((total, token) => total + (text.includes(token) ? (job.title.toLowerCase().includes(token) ? 4 : 2) : 0), 0);
    if (isComputingStudyArea(question)) {
      if (job.specialization === "IT - Software") score += 12;
      else if (["IT - Network/Sys/DB Admin", "IT - Hardware"].includes(job.specialization)) score += 7;
    }
    if (/intern/i.test(question) && /intern/i.test(job.type + job.title)) score += 8;
    if (requestedSalary && job.salary) {
      if (wantsMinimum && job.salary >= requestedSalary) score += 6;
      else if (wantsMaximum && job.salary <= requestedSalary) score += 6;
      else if (!wantsMinimum && !wantsMaximum && Math.abs(job.salary - requestedSalary) <= 300) score += 4;
    }
    return { job, score };
  }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score || b.job.salary - a.job.salary).slice(0, 8).map(({ job }) => job);
}

export function answerFromJobs(question: string, jobs: JobRecord[]) {
  const results = retrieveJobs(question, jobs);
  if (!results.length) return { answer: "I couldn’t find that in the supplied vacancy or company records. Try asking with a role, specialization, company, salary, or internship type that appears in the list.", sources: [] };
  const intro = isComputingStudyArea(question)
    ? "Based on the study area you mentioned, these supplied vacancies have the closest specialization match:"
    : /intern/i.test(question) ? "Here are the closest internship records I found:" : "Here are the closest matching vacancy records:";
  return {
    answer: `${intro}\n\n${results.slice(0, 5).map((job) => `• ${job.title} at ${job.company} — ${job.salaryLabel} ${job.payFrequency}, ${job.location}, ${job.minimumRequirement} minimum`).join("\n")}\n\nThis response is generated directly from the supplied records.`,
    sources: results.slice(0, 5),
  };
}
