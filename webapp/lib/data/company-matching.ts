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

export function companyNamesMatch(left: string, right: string) {
  const a = companyNameKey(left);
  const b = companyNameKey(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (Math.min(a.length, b.length) >= 6 && (a.includes(b) || b.includes(a))) return true;
  return editDistance(a, b) <= (Math.max(a.length, b.length) >= 10 ? 2 : 1);
}

export function findCompanyByName(companies: readonly Company[], name: string) {
  return companies.find((company) => companyNamesMatch(company.name, name));
}

export function companyListIncludes(companies: readonly string[], name: string) {
  return companies.some((company) => companyNamesMatch(company, name));
}
