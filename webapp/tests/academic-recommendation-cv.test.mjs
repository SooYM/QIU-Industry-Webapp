import assert from "node:assert/strict";
import test from "node:test";
import { sampleStudentProfiles } from "../app/student-data.ts";
import { evaluateJobForStudent, rankJobsForStudent } from "../app/recommendation.ts";

test("recommendation engine boosts Machine Learning jobs for student with A+ in Machine Learning", () => {
  const mlStudent = sampleStudentProfiles.find((s) => s.id === "student-ml-star");
  assert.ok(mlStudent, "ML student profile exists");

  const mlJob = {
    id: 101,
    title: "Senior Machine Learning Engineer",
    specialization: "Artificial Intelligence & Data Science",
  };

  const result = evaluateJobForStudent(mlJob, mlStudent);
  assert.equal(result.status, "recommended");
  assert.ok(result.matchScore >= 80, `Expected high match score, got ${result.matchScore}`);
  assert.ok(result.highlights.some((h) => h.includes("Machine Learning")), "Highlights include Machine Learning grade boost");
});

test("recommendation engine EXCLUDES Cybersecurity jobs for student bad at Cybersecurity (Grade D+)", () => {
  const mlStudent = sampleStudentProfiles.find((s) => s.id === "student-ml-star");
  assert.ok(mlStudent, "ML student profile exists");

  const cyberJob = {
    id: 102,
    title: "Cybersecurity Analyst & Penetration Tester",
    specialization: "Information Security & SOC",
  };

  const result = evaluateJobForStudent(cyberJob, mlStudent);
  assert.equal(result.status, "excluded");
  assert.ok(result.exclusions.some((e) => e.includes("Cybersecurity")), "Exclusion reason mentions poor grade in Cybersecurity");
});

test("recommendation engine prioritizes Cybersecurity for student with A+ in Network Security", () => {
  const cyberStudent = sampleStudentProfiles.find((s) => s.id === "student-cyber-sec");
  assert.ok(cyberStudent, "Cyber student profile exists");

  const cyberJob = {
    id: 102,
    title: "Cybersecurity Analyst & Penetration Tester",
    specialization: "Information Security & SOC",
  };

  const result = evaluateJobForStudent(cyberJob, cyberStudent);
  assert.equal(result.status, "recommended");
  assert.ok(result.matchScore >= 80);
});

test("ranking sorts recommended jobs above excluded jobs", () => {
  const mlStudent = sampleStudentProfiles.find((s) => s.id === "student-ml-star");
  const testJobs = [
    { id: 1, title: "Cybersecurity Specialist", specialization: "Security" },
    { id: 2, title: "Machine Learning Researcher", specialization: "AI" },
  ];

  const ranked = rankJobsForStudent(testJobs, mlStudent);
  assert.equal(ranked[0].id, 2, "Machine Learning job should be ranked first");
  assert.equal(ranked[1].id, 1, "Cybersecurity job should be ranked last due to low grade");
});
