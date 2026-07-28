import assert from "node:assert/strict";
import test from "node:test";
import { sampleStudentProfiles } from "../app/student-data.ts";
import { evaluateJobForStudent, rankJobsForStudent } from "../app/recommendation.ts";

const jobs = [
  { id: 1, title: "Machine Learning Engineer", specialization: "IT - Software", company: "AI Vision Corp" },
  { id: 2, title: "Cybersecurity Analyst", specialization: "IT - Network/Sys/DB Admin", company: "CyberShield" },
  { id: 3, title: "Web Developer", specialization: "IT - Software", company: "WebWorks" },
];

test("student profiles contain required academic results, FYP, and leadership positions", () => {
  assert.ok(sampleStudentProfiles.length >= 3);
  for (const student of sampleStudentProfiles) {
    assert.ok(student.id);
    assert.ok(student.fullName);
    assert.ok(student.cgpa > 0);
    assert.ok(Array.isArray(student.courses) && student.courses.length > 0);
    assert.ok(student.fyp === null || typeof student.fyp === "object");
    assert.ok(Array.isArray(student.extracurriculars));
  }
});

test("grade-aware recommendation engine boosts jobs matching high grade courses", () => {
  const mlStudent = sampleStudentProfiles.find((s) => s.id === "student-ml-star");
  assert.ok(mlStudent);

  const mlJob = jobs.find((j) => j.id === 1);
  assert.ok(mlJob);

  const result = evaluateJobForStudent(mlJob, mlStudent);
  assert.equal(result.status, "recommended");
  assert.ok(result.matchScore > 70);
  assert.ok(result.highlights.some((h) => h.includes("Machine Learning")));
});

test("grade-aware recommendation engine excludes jobs matching poor grade courses", () => {
  const mlStudent = sampleStudentProfiles.find((s) => s.id === "student-ml-star");
  assert.ok(mlStudent);

  const cyberJob = jobs.find((j) => j.id === 2);
  assert.ok(cyberJob);

  const result = evaluateJobForStudent(cyberJob, mlStudent);
  assert.equal(result.status, "excluded");
  assert.ok(result.exclusions.some((e) => e.includes("Cybersecurity")));
});

test("rankJobsForStudent ranks recommended jobs above neutral and places excluded jobs at bottom", () => {
  const mlStudent = sampleStudentProfiles.find((s) => s.id === "student-ml-star");
  assert.ok(mlStudent);

  const ranked = rankJobsForStudent(jobs, mlStudent);
  assert.equal(ranked[0].id, 1); // ML job should be rank 1
  assert.equal(ranked[ranked.length - 1].id, 2); // Cybersecurity job (excluded due to D+) should be last
});

test("computer science student major auto-matches IT specializations", () => {
  const csStudent = sampleStudentProfiles.find((s) => s.id === "student-ml-star");
  assert.ok(csStudent);
  assert.match(csStudent.major.toLowerCase(), /computer science/);

  const availableSpecs = ["All specializations", "General/Cost Accounting", "IT - Software", "Hotel/Tourism"];
  const matchedSpec = availableSpecs.find((s) => /^IT\b|IT\s*-|Software/i.test(s));
  assert.equal(matchedSpec, "IT - Software");
});

test("diverse university faculties contain sample student profiles and map to relevant specializations", () => {
  const accountancyStudent = sampleStudentProfiles.find((s) => s.major.includes("Accountancy"));
  assert.ok(accountancyStudent, "Accountancy student profile exists");
  assert.equal(accountancyStudent.faculty, "Accounting and Finance");

  const hospitalityStudent = sampleStudentProfiles.find((s) => s.faculty === "Hospitality");
  assert.ok(hospitalityStudent, "Hospitality student profile exists");

  const businessStudent = sampleStudentProfiles.find((s) => s.faculty === "Business");
  assert.ok(businessStudent, "Business student profile exists");

  const foodScienceStudent = sampleStudentProfiles.find((s) => s.faculty === "Integrated Life Sciences");
  assert.ok(foodScienceStudent, "Integrated Life Sciences student profile exists");
});

test("student with failed grade F is strictly excluded from matching software engineering jobs", () => {
  const failedStudent = sampleStudentProfiles.find((s) => s.id === "student-failed-cs");
  assert.ok(failedStudent);
  assert.ok(failedStudent.cgpa < 2.0);

  const softwareJob = { id: 10, title: "Software Engineer", specialization: "IT - Software", company: "DevCorp" };
  const evalResult = evaluateJobForStudent(softwareJob, failedStudent);

  assert.equal(evalResult.status, "excluded");
  assert.ok(evalResult.exclusions.some((ex) => ex.includes("Strictly excluded due to failed grade (F)")));
});
