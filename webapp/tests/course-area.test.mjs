import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { AREAS_OF_STUDY, PROGRAMMES, courseArea } from "../lib/data/course-map.ts";

// The 12 areas a company picks in "Students you are looking for" come from
// Programes/qiu_programmes_industry_mapping.csv. If that CSV gains a programme
// or renames an area, these tests fail until course-map.ts is regenerated.
const CSV = new URL("../../Programes/qiu_programmes_industry_mapping.csv", import.meta.url);

/** Minimal CSV reader — the mapping file has quoted fields in the last column. */
function parseCsv(text) {
  const rows = [];
  for (const line of text.trim().split(/\r?\n/)) {
    const cells = [];
    let cur = "", quoted = false;
    for (const ch of line) {
      if (ch === '"') quoted = !quoted;
      else if (ch === "," && !quoted) { cells.push(cur); cur = ""; }
      else cur += ch;
    }
    cells.push(cur);
    rows.push(cells);
  }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

test("every programme carries the area of study the CSV gives it", async () => {
  const rows = parseCsv(await readFile(CSV, "utf8"));
  const areaByName = new Map(rows.map((r) => [r["Program Name"].toLowerCase(), r["Primary Area of Study"]]));

  for (const [code, programme] of Object.entries(PROGRAMMES)) {
    assert.ok(programme.area, `${code} has no area of study`);
    const fromCsv = areaByName.get(programme.name.toLowerCase());
    if (fromCsv) assert.equal(programme.area, fromCsv, `${code} (${programme.name}) disagrees with the CSV`);
  }

  const csvAreas = [...new Set(rows.map((r) => r["Primary Area of Study"]))].sort();
  assert.deepEqual(AREAS_OF_STUDY, csvAreas);
  assert.equal(AREAS_OF_STUDY.length, 12);
});

test("a student's course resolves to its area, by code or by full name", () => {
  assert.equal(courseArea("BCS"), "Computer Science & Information Technology");
  assert.equal(courseArea("BCS - Year 2"), "Computer Science & Information Technology");
  assert.equal(courseArea("Bachelor of Computer Science (Hons)"), "Computer Science & Information Technology");
  assert.equal(courseArea("BAC"), "Accounting & Finance");
  assert.equal(courseArea("MBBS"), "Medicine Biomedical & Healthcare");
  // Longest code wins, so the ODL master does not resolve as plain "MBA".
  assert.equal(courseArea("MBA-ODL"), "Business Management & Administration");
  // A course we do not know sits in no area, and so recommends nothing.
  assert.equal(courseArea("Bachelor of Underwater Basket Weaving"), null);
  assert.equal(courseArea(""), null);
  assert.equal(courseArea(null), null);
});

test("the pickers offer areas, and drop the ones already chosen", async () => {
  for (const file of ["../features/admin/CompanyManager.tsx", "../app/auth-context.tsx"]) {
    const src = await readFile(new URL(file, import.meta.url), "utf8");
    assert.match(src, /AREAS_OF_STUDY/, `${file} should offer areas of study`);
    assert.match(src, /Add an area of study/, `${file} should say what is being added`);
    assert.match(src, /AREAS_OF_STUDY\.filter\(\(a\) => !\w+\.has\(a\.toLowerCase\(\)\)\)/,
      `${file} should hide areas that are already selected`);
  }
});
