// A company's "nature of business", picked from a dropdown (or typed as a custom
// value). Students whose course sits in a matching field see the company
// recommended on Home. Matching is keyword-based so it also works for the
// free-text natures that arrive via the JSON company import.

export const BUSINESS_NATURES: string[] = [
  "Information Technology & Software",
  "Banking & Financial Services",
  "Insurance",
  "Healthcare & Medical",
  "Pharmacy",
  "Engineering & Industrial",
  "Manufacturing & Production",
  "Sales, Marketing & Advertising",
  "Media & Communications",
  "Education & Training",
  "Hospitality, Tourism & Culinary",
  "Food Science & Biotechnology",
  "Environmental & Sustainability",
  "Business, Consulting & Management",
  "Retail & E-commerce",
  "Psychology & Human Resources",
];

// Each rule: if the company's nature text matches `nature` AND the student's
// course matches `course`, the company is recommended to that student.
const RULES: { nature: RegExp; course: RegExp }[] = [
  { nature: /tech|software|\bit\b|information technology|computer|data|digital|cyber|program|web|cloud|network/i, course: /computer|information technology|computing|software|actuarial|data|mechatronic|electronic/i },
  { nature: /financ|bank|insur|account|invest|fintech|audit|tax/i, course: /accountanc|accounting|finance|business|administration|actuarial/i },
  { nature: /health|medic|hospital|clinic|nursing|care/i, course: /medic|biomed|nursing|health|mbbs|science/i },
  { nature: /pharmac|drug|medicine retail/i, course: /pharmac|biomed|science/i },
  { nature: /engineer|electr|mechatron|industrial|automation|construction|manufactur|product|factory|plant/i, course: /engineer|mechatronic|electronic|manufactur/i },
  { nature: /market|advertis|\bsales\b|media|communicat|public relation|\bpr\b|journalis|broadcast|content|creative|design/i, course: /communication|journalism|advertis|mass comm|business|marketing|media|design/i },
  { nature: /education|training|teach|school|academ|tuition|learning/i, course: /education|teaching|tesl|early childhood|special needs/i },
  { nature: /hospitality|hotel|tourism|culinary|restaurant|f&b|food.*service|resort|travel|catering/i, course: /hospitality|hotel|tourism|culinary/i },
  { nature: /food|biotech|environment|agri|sustainab|green|renewable|ecolog/i, course: /food science|biotechnolog|environmental|science/i },
  { nature: /business|management|consult|retail|commerce|logistics|supply|e-?commerce|trading|corporate/i, course: /business|management|administration|finance|accountanc|marketing/i },
  { nature: /psycholog|human resource|\bhr\b|counsel|recruit|talent/i, course: /psychology|human resource|business/i },
];

/** True when a company whose business is `nature` should be recommended to a
 *  student on `course`. "All students" always matches; blank never does. */
export function businessNatureMatchesCourse(nature: string | undefined, course: string | undefined): boolean {
  const n = (nature ?? "").trim();
  const c = (course ?? "").trim();
  if (!n || !c) return false;
  if (n.toLowerCase() === "all students") return true;
  return RULES.some((rule) => rule.nature.test(n) && rule.course.test(c));
}
