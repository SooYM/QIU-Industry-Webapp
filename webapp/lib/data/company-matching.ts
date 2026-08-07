import type { Company } from "./types";

const COMPANY_SUFFIXES = new Set(["sdn", "bhd", "berhad", "plc", "ltd", "limited", "inc", "incorporated", "llc", "corp", "corporation", "company", "co"]);

export function companyNameKey(value: string) {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim()
    .split(/\s+/).filter((part) => part && !COMPANY_SUFFIXES.has(part)).join(" ");
}

function editDistance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const previous = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + Number(a[i - 1] !== b[j - 1]));
      diagonal = previous;
    }
  }
  return row[b.length];
}

/**
 * Do these two strings name the same company?
 *
 * Matching is on the normalised key, so legal suffixes and punctuation are
 * ignored — "Acme Solutions Sdn Bhd" and "Acme Solutions" are one company.
 *
 * Substring containment is deliberately NOT a match. It used to be, which made
 * "Red Bull" the same company as "Oracle Red Bull Racing" — a distinct exhibitor
 * registering a shorter name would silently absorb an existing profile. What
 * remains is an exact key match plus a tight edit distance for genuine typos,
 * and only when the two names are close in length so one cannot swallow another.
 */
export function companyNamesMatch(left: string, right: string) {
  const a = companyNameKey(left);
  const b = companyNameKey(right);
  if (!a || !b) return false;
  if (a === b) return true;
  // A typo is a character or two, not a missing word.
  if (Math.abs(a.length - b.length) > 2) return false;
  return editDistance(a, b) <= (Math.max(a.length, b.length) >= 12 ? 2 : 1);
}

export function findCompanyByName(companies: readonly Company[], name: string) {
  return companies.find((company) => companyNamesMatch(company.name, name));
}

export function companyListIncludes(companies: readonly string[], name: string) {
  return companies.some((company) => companyNamesMatch(company, name));
}
