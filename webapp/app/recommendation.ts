import type { CourseGrade, StudentProfile } from "./student-data.ts";

export interface JobRecommendationResult {
  jobId: number;
  matchScore: number; // 0 to 100
  status: "recommended" | "neutral" | "excluded";
  highlights: string[];
  exclusions: string[];
  primarySubjectMatch?: string;
}

const subjectKeywords: Record<CourseGrade["subjectArea"], string[]> = {
  "machine-learning": ["machine learning", "ai", "artificial intelligence", "deep learning", "data science", "data scientist", "computer vision", "neural", "nlp", "predictive"],
  "cybersecurity": ["cybersecurity", "cyber security", "security analyst", "penetration", "ethical hacker", "soc", "network security", "forensics", "infosec", "vulnerability", "threat"],
  "web-dev": ["web developer", "frontend", "backend", "full stack", "fullstack", "react", "node", "javascript", "typescript", "web engineering"],
  "data-analytics": ["data analyst", "business intelligence", "bi analyst", "data engineer", "analytics", "sql", "data warehouse"],
  "software-engineering": ["software engineer", "software developer", "application developer", "systems engineer", "programmer", "software architecture"],
  "networking": ["network engineer", "sysadmin", "system administrator", "cloud engineer", "devops", "telecommunication"],
  "accounting": ["accounting", "auditing", "tax", "general/cost accounting", "accounts", "corporate finance/investment", "finance", "acca", "cpa", "balance sheet"],
  "finance": ["finance", "corporate finance", "investment", "banking", "treasury", "capital markets", "financial analyst"],
  "business": ["business", "marketing/business dev", "management", "operations", "supply chain", "strategy", "administration", "business administration"],
  "hospitality": ["hotel", "tourism", "hotel/tourism", "food/beverage/restaurant", "hospitality", "culinary", "restaurant", "resort", "front desk", "guest"],
  "marketing": ["digital marketing", "advertising", "marketing/business dev", "copywriting", "public relations", "content creator", "media", "brand"],
  "engineering": ["engineering", "mechatronics", "robotics", "automation", "manufacturing", "plc", "electronics", "control systems"],
  "food-tech": ["food tech", "nutritionist", "food tech/nutritionist", "food science", "microbiology", "haccp", "quality assurance", "food safety"],
  "education": ["education", "teaching", "tesl", "teacher", "e-learning", "instructional", "academic", "kindergarten"],
  "psychology": ["psychology", "human resources", "counselor", "behavior", "psychometrics", "recruitment", "organizational"],
  "pharmacy": ["pharmacy", "pharmacist", "pharmacology", "clinical", "therapeutics", "healthcare", "medical", "biomedical"],
  "general": ["it support", "technology", "digital", "consultant", "general"],
};

export function evaluateJobForStudent(
  job: { id: number; title: string; specialization: string; minimumRequirement?: string },
  student: StudentProfile
): JobRecommendationResult {
  const haystack = `${job.title} ${job.specialization}`.toLowerCase();
  
  let matchScore = 50; // base score for matching degree level
  const highlights: string[] = [];
  const exclusions: string[] = [];
  let status: "recommended" | "neutral" | "excluded" = "neutral";
  let primarySubjectMatch: string | undefined;

  for (const course of student.courses) {
    const keywords = subjectKeywords[course.subjectArea] ?? [];
    const isSubjectMatch = keywords.some((kw) => haystack.includes(kw));

    if (isSubjectMatch) {
      if (course.grade === "A+" || course.grade === "A" || course.grade === "A-") {
        // High Grade Boost!
        matchScore += course.grade === "A+" ? 45 : course.grade === "A" ? 40 : 35;
        highlights.push(`Recommended due to grade ${course.grade} in ${course.name}`);
        status = "recommended";
        primarySubjectMatch = course.name;
      } else if (["C+", "C", "D+", "D", "F"].includes(course.grade)) {
        // Low Grade Penalty & Exclusion Rule!
        matchScore -= 60;
        const exclusionNote = course.grade === "F"
          ? `Strictly excluded due to failed grade (F) in ${course.name}`
          : `Not recommended due to poor grade (${course.grade}) in ${course.name}`;
        exclusions.push(exclusionNote);
        status = "excluded";
      } else if (["B+", "B", "B-"].includes(course.grade)) {
        matchScore += 15;
        highlights.push(`Relevant course: ${course.name} (Grade ${course.grade})`);
      }
    }
  }

  // Check FYP relevance
  if (student.fyp) {
    const fypKeywords = [...student.fyp.technologies, ...student.fyp.title.split(" ")].map((w) => w.toLowerCase());
    const matchesFyp = fypKeywords.some((kw) => kw.length > 3 && haystack.includes(kw));
    if (matchesFyp && status !== "excluded") {
      matchScore += 15;
      highlights.push(`Matches FYP topic: "${student.fyp.title.slice(0, 45)}..."`);
      if (status !== "recommended") status = "recommended";
    }
  }

  // Clamp score
  const finalScore = Math.max(0, Math.min(99, matchScore));
  
  if (exclusions.length > 0) {
    status = "excluded";
  }

  return {
    jobId: job.id,
    matchScore: finalScore,
    status,
    highlights,
    exclusions,
    primarySubjectMatch,
  };
}

export function rankJobsForStudent<T extends { id: number; title: string; specialization: string }>(
  jobs: T[],
  student: StudentProfile
): (T & { recommendation: JobRecommendationResult })[] {
  return jobs
    .map((job) => ({
      ...job,
      recommendation: evaluateJobForStudent(job, student),
    }))
    .sort((a, b) => {
      // Excluded jobs go to the bottom
      if (a.recommendation.status === "excluded" && b.recommendation.status !== "excluded") return 1;
      if (a.recommendation.status !== "excluded" && b.recommendation.status === "excluded") return -1;
      return b.recommendation.matchScore - a.recommendation.matchScore;
    });
}
