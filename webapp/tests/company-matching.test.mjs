import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { companyNamesMatch } from "../lib/data/company-matching.ts";

const helper = await readFile(new URL("../lib/data/company-matching.ts", import.meta.url), "utf8");
const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const home = await readFile(new URL("../features/home/HomeView.tsx", import.meta.url), "utf8");

test("company matching normalizes legal suffixes and tolerates small typos", () => {
  assert.match(helper, /COMPANY_SUFFIXES/);
  assert.match(helper, /editDistance/);
  assert.equal(companyNamesMatch("Quest International Sdn. Bhd.", "Quest International"), true);
  assert.equal(companyNamesMatch("FastLane Recruit", "Fastlane Recrut"), true);
  assert.equal(companyNamesMatch("Quest International", "Maybank"), false);
});

test("company media and vacancy joins use fuzzy matching", () => {
  assert.match(page, /findCompanyByName\(approved, job\.company\)/);
  assert.match(home, /companyNamesMatch\(j\.company, company\.name\)/);
});
