import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { dataLayerSource } from "./helpers/data-layer.mjs";

const form = await readFile(new URL("../features/events/EventForm.tsx", import.meta.url), "utf8");
const settings = await readFile(new URL("../features/admin/SettingsPanel.tsx", import.meta.url), "utf8");
const firestore = await dataLayerSource();
const types = await readFile(new URL("../lib/data/types.ts", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("event presenters are added and removed as validated email entries", () => {
  assert.match(form, /function addPresenter\(\)/);
  assert.match(form, /type="email"/);
  assert.match(form, />Add presenter</);
  assert.match(form, /setPresenters\(presenters\.filter/);
  assert.match(form, /Add this email or clear the field before saving/);
  assert.doesNotMatch(form, /presentersText|comma or space separated/);
});

test("target specializations use a compact responsive dropdown", () => {
  assert.match(form, /<details className="specialization-select">/);
  assert.match(form, /className="specialization-options"/);
  assert.match(form, /className="specialization-selection"/);
  assert.match(form, /specializations,/);
  assert.match(styles, /\.specialization-options\s*{[^}]*grid-template-columns:repeat\(2/s);
  assert.match(styles, /@media \(max-width:520px\)[^{]*\{[^}]*\.specialization-options/s);
});

test("CCA eligibility uses session percentage without a minutes floor", () => {
  assert.doesNotMatch(settings, /ccaFloorMinutes|CCA minimum minutes floor/);
  assert.doesNotMatch(types, /ccaFloorMinutes/);
  assert.doesNotMatch(firestore, /ccaFloorMinutes/);
  assert.match(firestore, /Math\.ceil\(\(percent \/ 100\) \* sessionMinutes\)/);
  assert.match(firestore, /event\.sessionMinutes > 0 && durationMinutes >=/);
  assert.match(form, /End time must be after start time/);
});
