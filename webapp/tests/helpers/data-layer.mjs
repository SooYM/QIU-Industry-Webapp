import { readdir, readFile } from "node:fs/promises";

/**
 * The Firestore access layer's source, as one string.
 *
 * Several tests assert on the source text of this layer (e.g. "no client-writable
 * counter anywhere"). Reading the whole folder rather than one file means those
 * assertions keep working when the layer is split differently — and a rule like
 * "this must not appear anywhere in the data layer" is genuinely a statement
 * about the folder, not about one module.
 */
export async function dataLayerSource() {
  const dir = new URL("../../lib/data/", import.meta.url);
  const files = (await readdir(dir)).filter((f) => f.endsWith(".ts"));
  const sources = await Promise.all(files.map((f) => readFile(new URL(f, dir), "utf8")));
  return sources.join("\n");
}
