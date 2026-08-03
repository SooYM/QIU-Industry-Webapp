import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const panel = await readFile(new URL("../features/admin/AdminPanel.tsx", import.meta.url), "utf8");
const bands = await readFile(new URL("../lib/data/salary-bands.ts", import.meta.url), "utf8");

test("company salary suggestion is clearly advisory and cites its source", () => {
  assert.match(panel, /For reference purposes only/);
  assert.match(panel, /actual pay varies by experience, location, responsibilities, and company/);
  assert.match(panel, /href={SALARY_REFERENCE_URL}/);
  assert.match(bands, /https:\/\/fastlanerecruit\.com\/blog\/average-salary-in-malaysia-2025\/#average-salary-by-job-role-and-industry-2025-in-malaysia/);
});
