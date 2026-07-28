import assert from "node:assert/strict";
import test from "node:test";
import { extractSlmIntent, generateSlmResponse, SLM_MODEL_INFO } from "../app/slm-engine.ts";

const sampleJobs = [
  { id: 101, title: "Senior AI Engineer", company: "Cyberdyne Systems", type: "Permanent", specialization: "IT - Software", vacancies: 2, location: "Kuala Lumpur", salary: 8500, salaryLabel: "MYR8500", payFrequency: "Monthly", minimumRequirement: "Degree", email: "careers@cyberdyne.my", companySummary: "AI R&D company." },
  { id: 102, title: "Machine Learning Intern", company: "DeepMind Tech", type: "Internship", specialization: "IT - Software", vacancies: 1, location: "Selangor", salary: 1200, salaryLabel: "MYR1200", payFrequency: "Monthly", minimumRequirement: "Degree", email: "hr@deepmind.my", companySummary: "AI research lab." }
];

test("extractSlmIntent classifies conversational, time, internship, and search queries correctly", () => {
  assert.equal(extractSlmIntent("what is the time now").intent, "TIME_DATE");
  assert.equal(extractSlmIntent("hello").intent, "GREETING");
  assert.equal(extractSlmIntent("highest paying jobs").intent, "SALARY_COMPARISON");
  assert.equal(extractSlmIntent("machine learning intern").intent, "INTERNSHIP_SEARCH");
  assert.equal(extractSlmIntent("computer science degree").intent, "ACADEMIC_MATCH");
});

test("generateSlmResponse synthesizes grounded responses with SLM metadata", () => {
  const result = generateSlmResponse("Machine Learning Intern", sampleJobs);
  assert.equal(result.modelInfo.name, "SLM-Lite");
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].id, 102);
  assert.match(result.answer, /Synthesized on-device by SLM-Lite/);
});
