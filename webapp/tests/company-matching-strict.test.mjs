import assert from "node:assert/strict";
import test from "node:test";
import { companyNamesMatch } from "../lib/data/company-matching.ts";
test("distinct companies stay distinct", () => {
  assert.equal(companyNamesMatch("Oracle Red Bull Racing", "Red Bull"), false);
  assert.equal(companyNamesMatch("Red Bull", "Red Bull Racing"), false);
  assert.equal(companyNamesMatch("Oracle Red Bull Racing", "Oracle Red Bull Racing"), true);
  assert.equal(companyNamesMatch("Acme Solutions Sdn Bhd", "Acme Solutions"), true);
  assert.equal(companyNamesMatch("ORACLE RED BULL RACING", "oracle red bull racing"), true);
  assert.equal(companyNamesMatch("Petronas", "Petronaz"), true);
});
