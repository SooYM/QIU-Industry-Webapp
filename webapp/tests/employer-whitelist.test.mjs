import assert from "node:assert/strict";
import test from "node:test";
import { canEditOrDeleteJob, getYouTubeEmbedUrl, isAllowedAccessEmail, roleForEmail } from "../app/auth-policy.ts";

test("isAllowedAccessEmail allows @qiu.edu.my and whitelisted external accounts", () => {
  assert.equal(isAllowedAccessEmail("student@qiu.edu.my", []), true);
  assert.equal(isAllowedAccessEmail("external.employer@gmail.com", ["external.employer@gmail.com"]), true);
  assert.equal(isAllowedAccessEmail("unauthorized@gmail.com", ["external.employer@gmail.com"]), false);
});

test("roleForEmail assigns superadmin, admin, employer, and user roles", () => {
  assert.equal(roleForEmail("ai@qiu.edu.my"), "superadmin");
  assert.equal(roleForEmail("admin@qiu.edu.my", "admin"), "admin");
  assert.equal(roleForEmail("employer@company.com", "employer"), "employer");
  assert.equal(roleForEmail("student@qiu.edu.my"), "user");
});

test("canEditOrDeleteJob restricts employer role to own jobs only while admin/superadmin can edit all", () => {
  const ownJob = { id: 1, title: "Designer", createdBy: "employer@company.com" };
  const otherJob = { id: 2, title: "Developer", createdBy: "other@company.com" };

  // Employer permissions
  assert.equal(canEditOrDeleteJob(ownJob, "employer@company.com", "employer"), true);
  assert.equal(canEditOrDeleteJob(otherJob, "employer@company.com", "employer"), false);

  // Admin & Superadmin permissions
  assert.equal(canEditOrDeleteJob(otherJob, "admin@qiu.edu.my", "admin"), true);
  assert.equal(canEditOrDeleteJob(otherJob, "ai@qiu.edu.my", "superadmin"), true);
});

test("getYouTubeEmbedUrl converts standard YouTube links to valid embed iframe URLs", () => {
  assert.equal(getYouTubeEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "https://www.youtube.com/embed/dQw4w9WgXcQ");
  assert.equal(getYouTubeEmbedUrl("https://youtu.be/5qap5aO4i9A"), "https://www.youtube.com/embed/5qap5aO4i9A");
  assert.equal(getYouTubeEmbedUrl(""), "https://www.youtube.com/embed/5qap5aO4i9A");
});
