import assert from "node:assert/strict";
import test from "node:test";
import { AI_WARNING, answerFromJobs } from "../app/chat.ts";

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

test("matches misspelled company names deterministically", () => {
  assert.equal(answerFromJobs("Ledgr", jobs).sources[0].id, 3);
  assert.ok(answerFromJobs("Exampel Tech", jobs).sources.some((source) => source.company === "Example Tech"));
});

test("includes the AI warning in every generated answer", () => {
  for (const question of ["hi", "Ledger", "weather forecast"]) {
    assert.equal(answerFromJobs(question, jobs).answer.split(AI_WARNING).length, 2);
  }
});

test("handles conversational time and greeting intents gracefully without false job matches", () => {
  const timeResult = answerFromJobs("what is the time now", jobs);
  assert.match(timeResult.answer, /current local time/i);
  assert.deepEqual(timeResult.sources, []);

  const greetingResult = answerFromJobs("hi", jobs);
  assert.match(greetingResult.answer, /Hello! I am your QIU Industry Day AI Assistant/i);
  assert.deepEqual(greetingResult.sources, []);
});

test("matches culinary art queries to F&B/Culinary vacancies without false matching 'art' inside 'Smart'", () => {
  const testJobs = [
    { id: 10, title: "Culinary Intern", company: "Parkroyal Hotel", type: "Internship", specialization: "Hotel/Restaurant", vacancies: 1, location: "Kedah", salary: 400, salaryLabel: "MYR400", payFrequency: "Monthly", minimumRequirement: "Diploma", email: "", companySummary: "" },
    { id: 11, title: "Kindergarten Teacher", company: "Smart Talent Junior", type: "Permanent", specialization: "Education", vacancies: 1, location: "Perak", salary: 2000, salaryLabel: "MYR2000", payFrequency: "Monthly", minimumRequirement: "Diploma", email: "", companySummary: "" },
  ];

  const result = answerFromJobs("i study culinary art", testJobs);
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].id, 10);
  assert.doesNotMatch(result.answer, /Kindergarten Teacher/);
});
