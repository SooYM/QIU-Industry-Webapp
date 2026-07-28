import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { positionTooltip } from "../app/map-tooltip.ts";

const [page, styles] = await Promise.all([
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
]);

test("country labels stay inside the map at every edge", () => {
  const container = { width: 300, height: 150 };
  const tooltip = { width: 80, height: 24 };
  const cases = [
    { pointer: [0, 75], expected: { left: 8, top: 43 } },
    { pointer: [300, 75], expected: { left: 212, top: 43 } },
    { pointer: [150, 0], expected: { left: 158, top: 8 } },
    { pointer: [150, 150], expected: { left: 158, top: 118 } },
  ];

  for (const { pointer, expected } of cases) {
    const position = positionTooltip(pointer[0], pointer[1], container.width, container.height, tooltip.width, tooltip.height);
    assert.deepEqual(position, expected);
    assert.ok(position.left >= 0 && position.top >= 0);
    assert.ok(position.left + tooltip.width <= container.width);
    assert.ok(position.top + tooltip.height <= container.height);
  }

  assert.match(page, /positionTooltip\(hoveredCountry\.x, hoveredCountry\.y/);
  const tooltipRule = styles.match(/\.country-tooltip\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.doesNotMatch(tooltipRule, /transform:/);
  assert.match(tooltipRule, /max-width:calc\(100% - 1rem\)/);
});
