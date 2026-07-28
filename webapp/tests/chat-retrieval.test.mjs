import assert from "node:assert/strict";
import test from "node:test";
import { answerFromJobs } from "../app/chat.ts";

const jobs = [
  { id: 1, title: "Software Developer", company: "Example Tech", type: "Permanent", specialization: "IT - Software", vacancies: 1, location: "Selangor", salary: 3500, salaryLabel: "MYR3500", payFrequency: "Monthly", minimumRequirement: "Degree", email: "", companySummary: "" },
  { id: 2, title: "Network Intern", company: "Example Tech", type: "Internship", specialization: "IT - Network/Sys/DB Admin", vacancies: 1, location: "Perak", salary: 1000, salaryLabel: "MYR1000", payFrequency: "Monthly", minimumRequirement: "Diploma", email: "", companySummary: "" },
  { id: 3, title: "Accounts Assistant", company: "Ledger Sdn Bhd", type: "Permanent", specialization: "Accounting/Finance", vacancies: 1, location: "Johor", salary: 2500, salaryLabel: "MYR2500", payFrequency: "Monthly", minimumRequirement: "Diploma", email: "", companySummary: "" },
];

test("matches computer science wording and typo to loaded IT vacancies", () => {
  for (const question of ["I study computer science", "i study computer scienc"]) {
    const result = answerFromJobs(question, jobs);
    assert.doesNotMatch(result.answer, /couldn.t find/i);
    assert.match(result.answer, /study area.*closest specialization match/is);
    assert.ok(result.sources.length > 0);
    assert.ok(result.sources.some((source) => source.specialization === "IT - Software"));
    assert.ok(result.sources.every((source) => source.specialization.startsWith("IT - ")));
  }
});

test("keeps unrelated study fields outside loaded records", () => {
  const result = answerFromJobs("I study marine biology", jobs);
  assert.match(result.answer, /couldn.t find/i);
  assert.deepEqual(result.sources, []);
});

test("answers from newly loaded Firestore records", () => {
  const result = answerFromJobs("Ledger", jobs);
  assert.match(result.answer, /Accounts Assistant at Ledger Sdn Bhd/);
  assert.equal(result.sources[0].id, 3);
});
